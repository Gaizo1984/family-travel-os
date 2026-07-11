'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { compressImageForStorage } from '@/lib/image-compression'
import { computeDHash, hammingDistance, DUPLICATE_HASH_THRESHOLD } from '@/lib/image-hash'
import { assessPhotoBatch, MAX_PHOTOS_ANALYZED_PER_CALL } from '@/lib/photo-quality-analysis'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_PHOTOS_PER_UPLOAD = 20
/** §"Maximal 30 Erinnerungsbilder je Reise": Kappung als Auswahl (is_selected), kein Löschen. */
const MAX_SELECTED_PHOTOS_PER_TRIP = 30

/**
 * Deterministische Reise-Zuordnung (kein Raten) — 1:1 nach dem Muster von
 * `suggestStageId` in lib/actions/bookings.ts: nur bei eindeutigem
 * Datums-Treffer, sonst bleibt das Foto unzugeordnet.
 */
async function suggestTripId(supabase: SupabaseClient, familyId: string, takenAt: string | null): Promise<string | null> {
  if (!takenAt) return null
  const { data: trips } = await supabase.from('trips').select('id, start_date, end_date').eq('family_id', familyId)
  const matches = (trips ?? []).filter(
    (t) => t.start_date && t.end_date && takenAt >= t.start_date && takenAt <= t.end_date,
  )
  return matches.length === 1 ? matches[0].id : null
}

export async function uploadMemoryPhotos(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const uploadedByPersonId = String(formData.get('uploaded_by_person_id') ?? '').trim() || null
  const takenAt = String(formData.get('taken_at') ?? '').trim() || null
  const caption = String(formData.get('caption') ?? '').trim() || null

  const backPath = '/memories'

  if (!familyId) redirect(`${backPath}?error=${encodeURIComponent('Familie nicht gefunden')}`)

  const rawFiles = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (rawFiles.length === 0)
    redirect(`${backPath}?error=${encodeURIComponent('Bitte mindestens ein Foto auswählen.')}`)
  if (rawFiles.length > MAX_PHOTOS_PER_UPLOAD)
    redirect(`${backPath}?error=${encodeURIComponent(`Maximal ${MAX_PHOTOS_PER_UPLOAD} Fotos pro Upload.`)}`)

  for (const f of rawFiles) {
    if (!f.type.startsWith('image/'))
      redirect(`${backPath}?error=${encodeURIComponent('Nur Fotos werden unterstützt (JPEG, PNG, WebP).')}`)
    if (f.size > 15 * 1024 * 1024)
      redirect(`${backPath}?error=${encodeURIComponent('Mindestens eine Datei ist zu groß (maximal 15 MB pro Foto).')}`)
  }

  const supabase = await createClient()
  const tripId = String(formData.get('trip_id') ?? '').trim() || await suggestTripId(supabase, familyId, takenAt)

  // §Robustere Fehlerbehandlung: ein Fehler bei Foto N darf die bereits
  // erfolgreich verarbeiteten Fotos 1..N-1 nicht als verwirrenden
  // "Totalfehler" melden — stattdessen weiterverarbeiten und am Ende exakt
  // berichten, wie viele Fotos gespeichert wurden bzw. fehlgeschlagen sind.
  let savedCount = 0
  let failedCount = 0
  for (const file of rawFiles) {
    try {
      const rawBuffer = Buffer.from(await file.arrayBuffer())
      const compressed = await compressImageForStorage(rawBuffer)
      const storagePath = `memories/${familyId}/${crypto.randomUUID()}.webp`

      const { error: uploadError } = await supabase.storage.from('documents')
        .upload(storagePath, compressed, { contentType: 'image/webp' })
      if (uploadError) { failedCount++; continue }

      const { error: insertError } = await supabase.from('memory_photos').insert({
        family_id: familyId,
        trip_id: tripId,
        uploaded_by_person_id: uploadedByPersonId,
        storage_path: storagePath,
        taken_at: takenAt,
        caption,
      })
      if (insertError) {
        await supabase.storage.from('documents').remove([storagePath])
        failedCount++
        continue
      }
      savedCount++
    } catch {
      failedCount++
    }
  }

  // §"Keine Fehlerseite": Analyse ist Best-Effort und darf einen bereits
  // erfolgreichen Upload nie zu Fall bringen (z. B. bei einem Netzwerkfehler
  // beim Foto-Abruf aus Storage) — sonst würde Next.js hier eine generische
  // Fehlerseite zeigen, obwohl die Fotos technisch gespeichert wurden.
  if (tripId && savedCount > 0) {
    try {
      await analyzeTripMemoryPhotos(supabase, tripId)
    } catch {
      // bewusst verschluckt — Fotos sind bereits gespeichert, Analyse kann später nachlaufen
    }
  }

  if (savedCount === 0)
    redirect(`${backPath}?error=${encodeURIComponent('Keines der Fotos konnte gespeichert werden.')}`)
  if (failedCount > 0)
    redirect(`${backPath}?uploaded=${savedCount}&error=${encodeURIComponent(`${failedCount} von ${rawFiles.length} Fotos konnten nicht gespeichert werden.`)}`)

  redirect(`${backPath}?uploaded=${savedCount}`)
}

/**
 * §"Beliebig viele Fotos analysieren, KI schlägt beste 30 vor, maximal 30 je
 * Reise": nutzt AUSSCHLIESSLICH die gemeinsame Foto-Analyse-Pipeline
 * (lib/photo-quality-analysis.ts) — keine zweite, parallele
 * Bildanalyse-Implementierung. Dubletten werden wie in Content Studio nie
 * per KI erkannt, nur per Perceptual Hash. Läuft automatisch nach jedem
 * Upload mit Reise-Zuordnung.
 */
async function analyzeTripMemoryPhotos(supabase: SupabaseClient, tripId: string): Promise<void> {
  const { data: photosRaw } = await supabase
    .from('memory_photos')
    .select('id, storage_path, phash, quality_score, analyzed_at, is_duplicate_of')
    .eq('trip_id', tripId)
  const photos = photosRaw ?? []

  // Dubletten-Erkennung: fehlende Hashes nachrechnen, dann gegen alle anderen Fotos derselben Reise abgleichen.
  const hashById = new Map<string, string>()
  for (const p of photos) {
    if (p.phash) { hashById.set(p.id, p.phash); continue }
    try {
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(p.storage_path, 60)
      if (!signed?.signedUrl) continue
      const res = await fetch(signed.signedUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      const phash = await computeDHash(buffer)
      if (phash) {
        hashById.set(p.id, phash)
        await supabase.from('memory_photos').update({ phash }).eq('id', p.id)
      }
    } catch {
      // ein fehlerhaftes Foto darf die Dublettenerkennung der übrigen Fotos nicht abbrechen
      continue
    }
  }

  // Nur gegen frühere Fotos in der Liste prüfen (Index-Vergleich), damit
  // Duplikat-Ketten eindeutig auf das jeweils erste Foto zeigen.
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    if (p.is_duplicate_of || !hashById.has(p.id)) continue
    const ownHash = hashById.get(p.id)!
    let duplicateOfId: string | null = null
    for (let j = 0; j < i; j++) {
      const other = photos[j]
      if (hashById.has(other.id) && hammingDistance(hashById.get(other.id)!, ownHash) <= DUPLICATE_HASH_THRESHOLD) {
        duplicateOfId = other.id
        break
      }
    }
    if (duplicateOfId) {
      await supabase.from('memory_photos').update({ is_duplicate_of: duplicateOfId, is_selected: false }).eq('id', p.id)
    }
  }

  // Nicht-doppelte, noch nicht analysierte Fotos in Batches der KI-Qualitätsbewertung übergeben.
  const { data: toAnalyzeRaw } = await supabase
    .from('memory_photos')
    .select('id, storage_path')
    .eq('trip_id', tripId)
    .is('analyzed_at', null)
    .is('is_duplicate_of', null)
  const toAnalyze = toAnalyzeRaw ?? []

  for (let i = 0; i < toAnalyze.length; i += MAX_PHOTOS_ANALYZED_PER_CALL) {
    const batch = toAnalyze.slice(i, i + MAX_PHOTOS_ANALYZED_PER_CALL)
    const batchPhotos = await Promise.all(batch.map(async (p) => {
      try {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(p.storage_path, 60)
        if (!signed?.signedUrl) return null
        const res = await fetch(signed.signedUrl)
        return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: 'image/webp' }
      } catch {
        return null
      }
    }))

    const validIndices = batchPhotos.map((p, idx) => (p ? idx : -1)).filter((idx) => idx !== -1)
    const validPhotos = validIndices.map((idx) => batchPhotos[idx]!)
    if (validPhotos.length === 0) continue

    const assessments = await assessPhotoBatch(validPhotos, 'Bewerte diese Urlaubs-/Reisefotos einer Familie für eine Erinnerungsgalerie.')
    if (!assessments) continue

    await Promise.all(assessments.map((a) => {
      const originalIdx = validIndices[a.photoIndex]
      const photo = batch[originalIdx]
      if (!photo) return Promise.resolve()
      return supabase.from('memory_photos').update({
        quality_score: a.qualityScore,
        analyzed_at: new Date().toISOString(),
      }).eq('id', photo.id)
    }))
  }

  // Top-30-Kappung: alle nicht-doppelten, analysierten Fotos dieser Reise nach Qualität sortieren.
  const { data: rankedRaw } = await supabase
    .from('memory_photos')
    .select('id, quality_score')
    .eq('trip_id', tripId)
    .is('is_duplicate_of', null)
    .not('quality_score', 'is', null)
    .order('quality_score', { ascending: false })
  const ranked = rankedRaw ?? []

  if (ranked.length > MAX_SELECTED_PHOTOS_PER_TRIP) {
    const selectedIds = ranked.slice(0, MAX_SELECTED_PHOTOS_PER_TRIP).map((p) => p.id)
    const overflowIds = ranked.slice(MAX_SELECTED_PHOTOS_PER_TRIP).map((p) => p.id)
    await Promise.all([
      supabase.from('memory_photos').update({ is_selected: true }).in('id', selectedIds),
      supabase.from('memory_photos').update({ is_selected: false }).in('id', overflowIds),
    ])
  }
}

/** Gehärtetes Löschmuster wie lib/actions/documents.ts: Storage zuerst, DB-Zeile nur bei Erfolg. */
export async function deleteMemoryPhoto(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/memories'

  const supabase = await createClient()
  const { data: photo } = await supabase.from('memory_photos').select('storage_path').eq('id', photoId).maybeSingle()

  if (photo?.storage_path) {
    const { error: storageError } = await supabase.storage.from('documents').remove([photo.storage_path])
    if (storageError)
      redirect(`${returnTo}?error=${encodeURIComponent('Datei konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('memory_photos').delete().eq('id', photoId)
  if (error)
    redirect(`${returnTo}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo)
}

export async function toggleMemoryHighlight(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const nextValue = formData.get('next_value') === 'true'
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/memories'

  const supabase = await createClient()
  await supabase.from('memory_photos').update({ is_highlight: nextValue }).eq('id', photoId)

  redirect(returnTo)
}
