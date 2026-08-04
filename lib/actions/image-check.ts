'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { createUploadSlots, downloadAndClearStagedUpload, type UploadSlot } from '@/lib/actions/photo-staging'
import { parseStagedPaths } from '@/lib/staged-paths'
import { compressImageForStorage } from '@/lib/image-compression'
import { assessImageCheckBatch, compressForAiAnalysis, type ImageCheckAssessment } from '@/lib/photo-quality-analysis'
import { MAX_IMAGE_CHECK_PHOTOS, MAX_RETAINED_MEMORIES_PER_TRIP } from '@/lib/content-session-limits'
import { buildTripDigest } from '@/lib/trip-digest'
import {
  computeVacationPostExpiresAt, curateVacationPostSelection, MAX_VACATION_POST_PHOTOS,
  type VacationPostCandidate,
} from '@/lib/vacation-post-curation'

const TEMP_IMAGE_TTL_HOURS = 24

/**
 * §"Bild-Check ist kein neuer Content-Typ" (Nutzervorgabe, wörtlich):
 * eigener `project_type='image_check'` -- `content_projects.project_type`
 * hat kein CHECK-Constraint, daher keine Migration nötig, exakt das
 * etablierte Muster jedes bisherigen Content-Studio-Features.
 */
export async function startImageCheckProject(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const newPath = '/content-studio/bild-check/new'
  if (!tripId) redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const { data: trip } = await supabase.from('trips').select('title').eq('id', tripId).maybeSingle()

  const { data: project, error } = await supabase.from('content_projects').insert({
    family_id: familyId,
    trip_id: tripId,
    title: trip?.title ? `Bild-Check · ${trip.title}` : 'Bild-Check',
    status: 'uploading',
    project_type: 'image_check',
  }).select('id').single()

  if (error || !project)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  redirect(`/content-studio/bild-check/${project.id}`)
}

/** Dünner Wrapper um das bestehende Signed-Upload-URL-Muster (lib/actions/photo-staging.ts) -- exakt wie createContentSessionUploadSlots. */
export async function createImageCheckUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

/**
 * §"Maximal fünf Bilder" (Nutzervorgabe, wörtlich): wie
 * uploadContentSessionPhotos, aber auf MAX_IMAGE_CHECK_PHOTOS begrenzt und
 * ohne dHash-Duplikaterkennung (bei ≤5 Fotos in einem Rutsch nicht nötig --
 * die KI-Vergleichsbewertung erkennt ähnliche Motive ohnehin selbst).
 */
export async function uploadImageCheckPhotos(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!projectId) redirect('/content-studio/bild-check/new')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('content_projects').select('id, family_id')
    .eq('id', projectId).eq('project_type', 'image_check').maybeSingle()
  if (!project) redirect('/content-studio/bild-check/new')

  let stagedPaths = parseStagedPaths(formData.get('uploaded_paths'))
  if (stagedPaths.length === 0) redirect(returnPath)

  const { count: existingCount } = await supabase
    .from('content_project_photos').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  const remainingSlots = Math.max(0, MAX_IMAGE_CHECK_PHOTOS - (existingCount ?? 0))

  if (remainingSlots === 0)
    redirect(`${returnPath}?error=${encodeURIComponent(`Es sind bereits maximal ${MAX_IMAGE_CHECK_PHOTOS} Fotos hochgeladen.`)}`)

  const cappedCount = Math.max(0, stagedPaths.length - remainingSlots)
  stagedPaths = stagedPaths.slice(0, remainingSlots)

  const expiresAt = new Date(Date.now() + TEMP_IMAGE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  let savedCount = 0
  let failedCount = 0

  for (const stagingPath of stagedPaths) {
    try {
      const staged = await downloadAndClearStagedUpload(stagingPath)
      if (!staged || !staged.mimeType.startsWith('image/') || staged.buffer.length > 15 * 1024 * 1024) {
        failedCount++
        continue
      }

      const compressed = await compressImageForStorage(staged.buffer)
      const storagePath = `content-session/${project.family_id}/${projectId}/${crypto.randomUUID()}.webp`

      const { error: uploadError } = await supabase.storage.from('documents')
        .upload(storagePath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp', cacheControl: '31536000' })
      if (uploadError) { failedCount++; continue }

      const { error: insertError } = await supabase.from('content_project_photos').insert({
        project_id: projectId, storage_path: storagePath, temporary: true, expires_at: expiresAt,
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

  if (savedCount > 0) await supabase.from('content_projects').update({ status: 'ready_for_analysis' }).eq('id', projectId)

  const capMessage = cappedCount > 0
    ? ` ${cappedCount} Foto${cappedCount === 1 ? '' : 's'} wurde${cappedCount === 1 ? '' : 'n'} wegen des Limits von ${MAX_IMAGE_CHECK_PHOTOS} Fotos nicht hochgeladen.`
    : ''

  if (savedCount === 0 && failedCount > 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Keines der Fotos konnte gespeichert werden.' + capMessage)}`)
  if (failedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(`${failedCount} von ${stagedPaths.length} Fotos konnten nicht gespeichert werden.${capMessage}`)}`)
  if (cappedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(capMessage.trim())}`)
  redirect(`${returnPath}?uploaded=${savedCount}`)
}

export type ImageCheckResultItem = ImageCheckAssessment & { photoId: string }
export type ImageCheckResult = { ok: boolean; results?: ImageCheckResultItem[]; error?: string }

/**
 * §"Analyse nur durch ausdrücklichen Klick" (Nutzervorgabe, wörtlich): kein
 * FormData-Action, client-aufgerufen wie startReelRender -- läuft komplett
 * in einem try/catch (gleiches Absturz-Schutz-Muster wie zuletzt bei
 * reel-render.ts), damit ein unerwarteter Fehler nie die Seite abstürzen
 * lässt. Schreibt NICHTS in die Datenbank -- das Ergebnis lebt nur im
 * Client-State der aufrufenden Komponente (Datenschutz-Vorgabe: keine
 * dauerhafte Speicherung ohne ausdrückliche Nutzeraktion).
 */
export async function runImageCheckAnalysis(projectId: string): Promise<ImageCheckResult> {
  try {
    const supabase = await createClient()
    const { id: familyId } = await getFamily()
    const { data: project } = await supabase
      .from('content_projects').select('id, trip_id')
      .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
    if (!project) return { ok: false, error: 'Projekt nicht gefunden.' }

    const { data: photoRows } = await supabase
      .from('content_project_photos').select('id, storage_path')
      .eq('project_id', projectId).order('created_at', { ascending: true })
    const rows = photoRows ?? []
    if (rows.length === 0) return { ok: false, error: 'Bitte zuerst Fotos hochladen.' }

    const loaded = await Promise.all(rows.map(async (row) => {
      try {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, 60)
        if (!signed?.signedUrl) return null
        const res = await fetch(signed.signedUrl)
        const buffer = Buffer.from(await res.arrayBuffer())
        const aiBuffer = await compressForAiAnalysis(buffer)
        return { id: row.id, buffer: aiBuffer, mimeType: 'image/webp' as const }
      } catch {
        return null
      }
    }))
    const photos = loaded.filter((p): p is { id: string; buffer: Buffer; mimeType: 'image/webp' } => p !== null)
    if (photos.length === 0) return { ok: false, error: 'Fotos konnten nicht geladen werden.' }

    const assessments = await assessImageCheckBatch(
      photos.map((p) => ({ buffer: p.buffer, mimeType: p.mimeType })),
      'Bewerte diese Reisefotos einer Familie für die Weiterverwendung als Beitrag, Story oder Reel.',
    )
    if (!assessments) return { ok: false, error: 'Die Analyse ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.' }

    const results: ImageCheckResultItem[] = assessments
      .map((a) => ({ ...a, photoId: photos[a.photoIndex]?.id ?? '' }))
      .filter((r) => r.photoId)

    return { ok: true, results }
  } catch (e) {
    console.error('[image-check] runImageCheckAnalysis: unerwarteter Fehler', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: 'Analyse fehlgeschlagen (unerwarteter Fehler). Bitte gleich noch einmal versuchen.' }
  }
}

/**
 * §"Erst durch diesen Button soll das Bild in den bestehenden Beitrag- oder
 * Story-Workflow übernommen werden" (Nutzervorgabe, wörtlich): legt eine
 * neue Content-Session an (kleine, bewusst eigenständige Insert-Logik statt
 * Umbau von startContentSession, das selbst redirected und sich daher nicht
 * zwischenschalten lässt) und hängt die vorhandene Foto-Zeile per
 * `UPDATE ... SET project_id` um -- kein erneuter Upload, keine zweite
 * Kompression (schema-legal, siehe Migration content_project_photos: keine
 * Immutability-Regel auf project_id).
 */
export async function adoptImageCheckPhotoToSession(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const format = String(formData.get('format') ?? '')
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!photoId || !projectId || (format !== 'carousel' && format !== 'story')) redirect(returnPath)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()

  const { data: bildCheckProject } = await supabase
    .from('content_projects').select('id, trip_id')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
  if (!bildCheckProject) redirect(returnPath)

  const { data: photo } = await supabase
    .from('content_project_photos').select('id').eq('id', photoId).eq('project_id', projectId).maybeSingle()
  if (!photo) redirect(`${returnPath}?error=${encodeURIComponent('Foto nicht gefunden.')}`)

  const { data: trip } = bildCheckProject.trip_id
    ? await supabase.from('trips').select('title').eq('id', bildCheckProject.trip_id).maybeSingle()
    : { data: null }

  const formatLabel = format === 'story' ? 'Story' : 'Beitrag'
  const { data: newSession, error } = await supabase.from('content_projects').insert({
    family_id: familyId, trip_id: bildCheckProject.trip_id,
    title: trip?.title ? `${formatLabel} · ${trip.title}` : formatLabel,
    status: 'ready_for_analysis', project_type: 'session', output_format: format,
  }).select('id').single()

  if (error || !newSession)
    redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  const expiresAt = new Date(Date.now() + TEMP_IMAGE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  await supabase.from('content_project_photos')
    .update({ project_id: newSession.id, temporary: true, expires_at: expiresAt })
    .eq('id', photoId)

  redirect(`/content-studio/session/${newSession.id}`)
}

/**
 * §"Erst durch diesen Button soll das Bild in den bestehenden Reel-Workflow
 * übernommen werden" (Nutzervorgabe, wörtlich): Reels lesen ausschließlich
 * aus memory_photos (nicht aus content_project_photos) -- hier ist ein
 * Umhängen NICHT möglich, es braucht denselben Copy-Pattern wie
 * retainContentSessionPhotoAsMemory (eigenständige Funktion wegen des
 * anderen Redirect-Ziels).
 */
export async function adoptImageCheckPhotoToReel(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!photoId || !projectId) redirect(returnPath)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()

  const { data: bildCheckProject } = await supabase
    .from('content_projects').select('id, trip_id')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
  if (!bildCheckProject?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Diese Auswahl ist keiner Reise zugeordnet.')}`)

  const { data: photo } = await supabase
    .from('content_project_photos').select('id, storage_path').eq('id', photoId).eq('project_id', projectId).maybeSingle()
  if (!photo) redirect(`${returnPath}?error=${encodeURIComponent('Foto nicht gefunden.')}`)

  const { count } = await supabase
    .from('memory_photos').select('id', { count: 'exact', head: true })
    .eq('trip_id', bildCheckProject.trip_id).eq('is_selected', true)
  if ((count ?? 0) >= MAX_RETAINED_MEMORIES_PER_TRIP)
    redirect(`${returnPath}?error=${encodeURIComponent('Für diese Reise sind bereits 25 Erinnerungen gespeichert. Bitte zuerst ein Bild ersetzen oder entfernen.')}`)

  const { data: downloaded, error: downloadError } = await supabase.storage.from('documents').download(photo.storage_path)
  if (downloadError || !downloaded) redirect(`${returnPath}?error=${encodeURIComponent('Foto konnte nicht geladen werden.')}`)

  const buffer = Buffer.from(await downloaded.arrayBuffer())
  const compressed = await compressImageForStorage(buffer)
  const memoryPath = `memories/${familyId}/${crypto.randomUUID()}.webp`

  const { error: uploadError } = await supabase.storage.from('documents')
    .upload(memoryPath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp', cacheControl: '31536000' })
  if (uploadError) redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + uploadError.message)}`)

  const { error: insertError } = await supabase.from('memory_photos').insert({
    family_id: familyId, trip_id: bildCheckProject.trip_id, storage_path: memoryPath, is_selected: true,
  })
  if (insertError) {
    await supabase.storage.from('documents').remove([memoryPath])
    redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + insertError.message)}`)
  }

  redirect('/content-studio/reel/new')
}

/**
 * §"Nach der Analyse eines Bildes zusätzlich die Aktion 'Für Urlaubsbeitrag
 * vormerken' anbieten. Die Vormerkung muss immer einer konkreten Reise
 * zugeordnet sein" (Nutzervorgabe, wörtlich): schreibt das Bild-Check-
 * Ergebnis (bisher rein Client-State, siehe runImageCheckAnalysis) erstmals
 * dauerhaft auf die bestehende Foto-Zeile -- kein neuer Upload, keine neue
 * Tabelle. Überschreibt zugleich die ursprüngliche 24h-Upload-TTL mit
 * Reiseende+7 Tage, damit der bestehende Cleanup-Cron
 * (cleanupExpiredContentSessionPhotos) die Löschung automatisch übernimmt.
 */
export async function markImageCheckPhotoForVacationPost(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const scoreRaw = Number(formData.get('score') ?? NaN)
  const reasoning = String(formData.get('reasoning') ?? '').trim()
  const isSimilarOrWeaker = formData.get('is_similar_or_weaker') === 'true'
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!photoId || !projectId) redirect(returnPath)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()

  const { data: bildCheckProject } = await supabase
    .from('content_projects').select('id, trip_id')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
  if (!bildCheckProject?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Diese Auswahl ist keiner Reise zugeordnet.')}`)

  const { data: photo } = await supabase
    .from('content_project_photos').select('id').eq('id', photoId).eq('project_id', projectId).maybeSingle()
  if (!photo) redirect(`${returnPath}?error=${encodeURIComponent('Foto nicht gefunden.')}`)

  const { data: trip } = await supabase.from('trips').select('end_date').eq('id', bildCheckProject.trip_id).maybeSingle()

  const reasoningText = [reasoning || null, isSimilarOrWeaker ? 'Ähnlich zu einem anderen Foto der Auswahl.' : null]
    .filter(Boolean).join(' ') || null

  const { error } = await supabase.from('content_project_photos').update({
    vacation_post_marked_at: new Date().toISOString(),
    vacation_post_score: Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : null,
    vacation_post_reasoning: reasoningText,
    temporary: true,
    expires_at: computeVacationPostExpiresAt(trip?.end_date ?? null),
  }).eq('id', photoId)

  if (error) redirect(`${returnPath}?error=${encodeURIComponent('Vormerken fehlgeschlagen: ' + error.message)}`)

  redirect(`${returnPath}?marked=1`)
}

/** Gegenstück zu markImageCheckPhotoForVacationPost -- entfernt die Vormerkung wieder (setzt keinen neuen Ablauf, das bisherige expires_at bleibt bestehen). */
export async function unmarkImageCheckPhotoForVacationPost(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = String(formData.get('return_to') ?? `/content-studio/bild-check/${projectId}`)
  if (!photoId) redirect(returnPath)

  const supabase = await createClient()
  await supabase.from('content_project_photos').update({
    vacation_post_marked_at: null, vacation_post_score: null, vacation_post_reasoning: null,
    vacation_post_rank: null, vacation_post_pinned: false,
  }).eq('id', photoId)

  redirect(returnPath)
}

// ─────────────────────────── Urlaubsbeitrag-Verwaltung ───────────────────────────
// §"Bilder fixieren, entfernen, austauschen, Reihenfolge ändern, Auswahl neu
// kuratieren lassen, weniger als 15 Bilder verwenden, gesamte temporäre
// Auswahl löschen" (Nutzervorgabe, wörtlich): siehe
// app/(app)/content-studio/urlaubsbeitrag/[tripId]/page.tsx.

async function loadImageCheckProjectIdsForTrip(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string): Promise<string[]> {
  const { data } = await supabase.from('content_projects').select('id').eq('trip_id', tripId).eq('project_type', 'image_check')
  return (data ?? []).map((p) => p.id)
}

/** §"Bilder entfernen"/"austauschen"/"weniger als 15 verwenden": EIN Umschalt-Button je Foto -- aus der finalen Auswahl entfernen (rank->null, bleibt weiter im vorgemerkten Pool) oder aus dem Pool in die Auswahl aufnehmen (nächster freier Platz bis MAX_VACATION_POST_PHOTOS). "Austauschen" ergibt sich aus zwei solchen Klicks (eins raus, eins rein). */
export async function toggleVacationPostSelection(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const returnPath = `/content-studio/urlaubsbeitrag/${tripId}`
  if (!photoId || !tripId) redirect(returnPath)

  const supabase = await createClient()
  const { data: photo } = await supabase.from('content_project_photos').select('id, vacation_post_rank').eq('id', photoId).maybeSingle()
  if (!photo) redirect(returnPath)

  if (photo.vacation_post_rank !== null) {
    await supabase.from('content_project_photos').update({ vacation_post_rank: null }).eq('id', photoId)
    redirect(returnPath)
  }

  const projectIds = await loadImageCheckProjectIdsForTrip(supabase, tripId)
  const { data: rankedRows } = await supabase
    .from('content_project_photos').select('vacation_post_rank').in('project_id', projectIds).not('vacation_post_rank', 'is', null)
  const usedRanks = new Set((rankedRows ?? []).map((r) => r.vacation_post_rank as number))
  let nextRank = 1
  while (usedRanks.has(nextRank) && nextRank <= MAX_VACATION_POST_PHOTOS) nextRank++
  if (nextRank > MAX_VACATION_POST_PHOTOS) redirect(`${returnPath}?error=${encodeURIComponent(`Es sind bereits ${MAX_VACATION_POST_PHOTOS} Bilder ausgewählt -- bitte zuerst eins entfernen.`)}`)

  await supabase.from('content_project_photos').update({ vacation_post_rank: nextRank }).eq('id', photoId)
  redirect(returnPath)
}

/** §"Bilder fixieren": geschützt vor Überschreiben durch eine erneute KI-Kuration (siehe mergeCurationWithPinned). */
export async function toggleVacationPostPinned(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const returnPath = `/content-studio/urlaubsbeitrag/${tripId}`
  if (!photoId) redirect(returnPath)

  const supabase = await createClient()
  const { data: photo } = await supabase.from('content_project_photos').select('vacation_post_pinned').eq('id', photoId).maybeSingle()
  if (!photo) redirect(returnPath)

  await supabase.from('content_project_photos').update({ vacation_post_pinned: !photo.vacation_post_pinned }).eq('id', photoId)
  redirect(returnPath)
}

/** §"Reihenfolge... ändern" -- gleiches Auf-/Ab-Muster wie reorderMemoryPhoto/moveContentSessionDraftItem, kein Drag-and-Drop (Nutzer-Entscheidung, kein neues Paket). */
export async function reorderVacationPostSelection(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const direction = String(formData.get('direction') ?? '')
  const returnPath = `/content-studio/urlaubsbeitrag/${tripId}`
  if (!photoId || !tripId) redirect(returnPath)

  const supabase = await createClient()
  const projectIds = await loadImageCheckProjectIdsForTrip(supabase, tripId)
  const { data: rowsRaw } = await supabase
    .from('content_project_photos').select('id, vacation_post_rank')
    .in('project_id', projectIds).not('vacation_post_rank', 'is', null)
    .order('vacation_post_rank', { ascending: true })
  const rows = rowsRaw ?? []

  const index = rows.findIndex((r) => r.id === photoId)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= rows.length) redirect(returnPath)

  await Promise.all([
    supabase.from('content_project_photos').update({ vacation_post_rank: rows[swapWith].vacation_post_rank }).eq('id', rows[index].id),
    supabase.from('content_project_photos').update({ vacation_post_rank: rows[index].vacation_post_rank }).eq('id', rows[swapWith].id),
  ])
  redirect(returnPath)
}

/**
 * §"Auswahl neu kuratieren lassen": manueller Aufruf derselben
 * Kurationslogik wie der automatische Reiseende-Trigger
 * (triggerDueVacationPostCuration, lib/trip-debrief-generation.ts) -- hier
 * bewusst mit dem cookie-basierten Nutzer-Client statt Service-Role (läuft
 * interaktiv, nicht im Cron), deshalb eigenständig statt geteilter Funktion
 * über die beiden unterschiedlichen Client-Typen hinweg.
 */
export async function recurateVacationPostSelectionNow(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const returnPath = `/content-studio/urlaubsbeitrag/${tripId}`
  if (!tripId) redirect('/content-studio')
  if (!process.env.OPENAI_API_KEY) redirect(`${returnPath}?error=${encodeURIComponent('Die Kuration ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { data: trip } = await supabase.from('trips').select('end_date').eq('id', tripId).maybeSingle()
  const projectIds = await loadImageCheckProjectIdsForTrip(supabase, tripId)

  const { data: candidateRows } = projectIds.length > 0
    ? await supabase
      .from('content_project_photos')
      .select('id, vacation_post_score, vacation_post_reasoning, vacation_post_rank, vacation_post_pinned')
      .in('project_id', projectIds).not('vacation_post_marked_at', 'is', null)
    : { data: [] }
  const candidates = candidateRows ?? []
  if (candidates.length === 0) redirect(`${returnPath}?error=${encodeURIComponent('Keine vorgemerkten Bilder vorhanden.')}`)

  const tripDigest = await buildTripDigest(tripId)
  const vacationPostCandidates: VacationPostCandidate[] = candidates.map((c) => ({
    photoId: c.id, score: c.vacation_post_score, reasoning: c.vacation_post_reasoning,
    pinned: c.vacation_post_pinned, existingRank: c.vacation_post_rank,
  }))
  const selection = await curateVacationPostSelection(vacationPostCandidates, tripDigest)
  if (!selection) redirect(`${returnPath}?error=${encodeURIComponent('Die Kuration ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)

  const rankByPhotoId = new Map(selection.map((s) => [s.photoId, s.rank]))
  const expiresAt = computeVacationPostExpiresAt(trip?.end_date ?? null)
  await Promise.all(candidates.map((c) =>
    supabase.from('content_project_photos').update({
      vacation_post_rank: rankByPhotoId.get(c.id) ?? null,
      expires_at: expiresAt,
    }).eq('id', c.id),
  ))

  redirect(returnPath)
}

/** §"Gesamte temporäre Auswahl löschen": entfernt die Vormerkung ALLER Bilder dieser Reise (nicht nur die finale Auswahl) -- die Fotos selbst und ihre Bild-Check-Projekte bleiben unangetastet, nur die Urlaubsbeitrag-Zuordnung verschwindet. */
export async function deleteVacationPostSelection(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  if (!tripId) redirect('/content-studio')

  const supabase = await createClient()
  const projectIds = await loadImageCheckProjectIdsForTrip(supabase, tripId)
  if (projectIds.length > 0) {
    await supabase.from('content_project_photos').update({
      vacation_post_marked_at: null, vacation_post_score: null, vacation_post_reasoning: null,
      vacation_post_rank: null, vacation_post_pinned: false,
    }).in('project_id', projectIds).not('vacation_post_marked_at', 'is', null)
  }

  redirect('/content-studio')
}
