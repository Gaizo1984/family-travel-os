'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { readDateGroupFromFormData } from '@/lib/documents'
import { getFamily } from '@/lib/family'
import { createUploadSlots, downloadAndClearStagedUpload, type UploadSlot } from '@/lib/actions/photo-staging'
import { parseStagedPaths } from '@/lib/staged-paths'
import { compressImageForStorage } from '@/lib/image-compression'

/** §"Optionales Titelbild bei der Reiseanlage": dünner Wrapper wie bei Content-Session/-Ideen -- Signed-Upload-URL statt Rohdaten im Server-Action-Body (Vercel-4,5-MB-Limit). */
export async function createTripCoverUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * §"Reiseanlage vereinfachen": Pflicht sind nur noch Reiseziel/Ort und
 * Reisende -- Titel, Titelbild und Start-/Enddatum sind optional. Ohne
 * Titel wird das Reiseziel selbst zum Titel. Das Reiseziel legt zusätzlich
 * sofort eine erste Etappe (stages, ohne Datum) an -- Grundlage für die
 * spätere automatische Zeitraum-Ableitung aus Etappen (lib/trip-dates.ts),
 * bevor überhaupt Buchungen existieren.
 */
export async function createTrip(formData: FormData) {
  const title       = String(formData.get('title') ?? '').trim()
  const destination = String(formData.get('subtitle') ?? '').trim()
  const statusRaw   = String(formData.get('status') ?? '').trim()
  const status      = (['planned', 'active', 'completed'] as const).includes(statusRaw as 'planned' | 'active' | 'completed')
    ? (statusRaw as 'planned' | 'active' | 'completed')
    : 'planned'
  const memberIds = formData.getAll('members').map(String)
  const sourceTripIdeaId = String(formData.get('source_trip_idea_id') ?? '').trim()

  // Beide Einstiege ("Reise selbst anlegen" unter /trips/new und der bestehende
  // Formular-Teil von /plan) posten hierher — Redirect-Ziel bei Fehlern richtet
  // sich nach dem Referer, damit beide Formulare ihre eigene Fehleranzeige behalten.
  const referer = String(formData.get('_referer') ?? '/plan')

  let startDate: string | null
  let endDate: string | null
  try {
    startDate = readDateGroupFromFormData(formData, 'start_date', 'Startdatum')
    endDate = readDateGroupFromFormData(formData, 'end_date', 'Enddatum')
  } catch (e) {
    redirect(`${referer}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (!destination)
    redirect(`${referer}?error=${encodeURIComponent('Reiseziel / Ort ist erforderlich')}`)
  if (startDate && endDate && new Date(endDate) <= new Date(startDate))
    redirect(`${referer}?error=${encodeURIComponent('Enddatum muss nach dem Startdatum liegen')}`)
  if (memberIds.length === 0)
    redirect(`${referer}?error=${encodeURIComponent('Mindestens eine Person muss ausgewählt sein')}`)

  const finalTitle = title || destination

  const supabase = await createClient()

  const { data: family } = await supabase
    .from('families').select('id').limit(1).single()

  if (!family?.id)
    redirect(`${referer}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  // Eindeutigen Slug sicherstellen
  const baseSlug = slugify(finalTitle) || 'reise'
  let slug = baseSlug
  for (let i = 1; i <= 99; i++) {
    const { data: existing } = await supabase
      .from('trips').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${i}`
  }

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      slug,
      family_id: family.id,
      title: finalTitle,
      subtitle: destination,
      status,
      start_date: startDate,
      end_date:   endDate,
    })
    .select('id, slug')
    .single()

  if (error || !trip)
    redirect(`${referer}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'Unbekannt'))}`)

  await supabase.from('trip_members').insert(
    memberIds.map(person_id => ({ trip_id: trip.id, person_id }))
  )

  // §"Vorhandene Etappen als Fallback": eine erste, undatierte Etappe mit dem
  // angegebenen Reiseziel gibt der Zeitraum-Ableitung (und der Wetter-/
  // Standort-Auflösung) von Anfang an eine Grundlage, auch ganz ohne Buchungen.
  await supabase.from('stages').insert({
    trip_id: trip.id, title: destination, location: destination,
    start_date: startDate, end_date: endDate, sort_order: 0,
  })

  // Optionales Titelbild: nur wenn tatsächlich eines hochgeladen wurde
  // (DirectPhotoUploadForm liefert `uploaded_paths` nur bei Dateiauswahl).
  const stagedPaths = parseStagedPaths(formData.get('uploaded_paths'))
  if (stagedPaths.length > 0) {
    try {
      const staged = await downloadAndClearStagedUpload(stagedPaths[0])
      if (staged?.mimeType.startsWith('image/')) {
        const compressed = await compressImageForStorage(staged.buffer)
        const coverPath = `memories/${family!.id}/${crypto.randomUUID()}.webp`
        const { error: uploadError } = await supabase.storage.from('documents')
          .upload(coverPath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp' })
        if (!uploadError) {
          const { data: coverPhoto } = await supabase.from('memory_photos').insert({
            family_id: family!.id, trip_id: trip.id, storage_path: coverPath, is_selected: true,
          }).select('id').single()
          if (coverPhoto) await supabase.from('trips').update({ cover_photo_id: coverPhoto.id }).eq('id', trip.id)
        }
      }
    } catch {
      // Titelbild ist rein optional -- ein Fehlschlag darf die Reiseanlage selbst nicht verhindern.
    }
  }

  // Reiseidee → echte Reise: nur Nachverfolgung (converted_trip_id), keine
  // Doppelanlage und keine Änderung an der neu angelegten Reise selbst.
  if (sourceTripIdeaId) {
    const { data: idea } = await supabase.from('trip_ideas').select('session_id').eq('id', sourceTripIdeaId).maybeSingle()
    await supabase.from('trip_ideas').update({ converted_trip_id: trip.id, is_chosen: true }).eq('id', sourceTripIdeaId)
    if (idea?.session_id)
      await supabase.from('trip_idea_sessions').update({ status: 'converted' }).eq('id', idea.session_id)
  }

  redirect(`/trips/${trip.slug}`)
}

export async function updateTrip(formData: FormData) {
  const tripId    = String(formData.get('trip_id') ?? '')
  const title     = String(formData.get('title') ?? '').trim()
  const subtitle  = String(formData.get('subtitle') ?? '').trim()
  const status    = String(formData.get('status') ?? '').trim()
  const memberIds = formData.getAll('members').map(String)

  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips').select('slug').eq('id', tripId).maybeSingle()

  if (!trip?.slug)
    redirect(`/trips?error=${encodeURIComponent('Reise nicht gefunden')}`)

  const editPath = `/trips/${trip.slug}/edit`

  let startDate: string | null
  let endDate: string | null
  try {
    startDate = readDateGroupFromFormData(formData, 'start_date', 'Startdatum')
    endDate = readDateGroupFromFormData(formData, 'end_date', 'Enddatum')
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (title.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Reisenname: mindestens 2 Zeichen erforderlich')}`)
  // §"Start-/Enddatum bleiben eine optionale Korrektur, keine Pflicht": anders
  // als bei der Erstanlage kann hier auch bewusst wieder auf "automatisch
  // ableiten" zurückgesetzt werden (beide Felder leeren) -- nur eine
  // widersprüchliche Kombination (Ende vor/gleich Start) wird abgelehnt.
  if (startDate && endDate && new Date(endDate) <= new Date(startDate))
    redirect(`${editPath}?error=${encodeURIComponent('Enddatum muss nach dem Startdatum liegen')}`)
  // 'archived' ist bewusst kein wählbarer Wert hier — Archivieren läuft nur über
  // den eigenen Bestätigungs-Flow (archiveTrip), nie über dieses Dropdown.
  if (!['planned', 'active', 'completed'].includes(status))
    redirect(`${editPath}?error=${encodeURIComponent('Ungültiger Status')}`)
  if (memberIds.length === 0)
    redirect(`${editPath}?error=${encodeURIComponent('Mindestens eine Person muss ausgewählt sein')}`)

  const { error } = await supabase
    .from('trips')
    .update({
      title,
      subtitle: subtitle || null,
      status: status as 'planned' | 'active' | 'completed',
      start_date: startDate,
      end_date: endDate,
    })
    .eq('id', tripId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  await supabase.from('trip_members').delete().eq('trip_id', tripId)
  await supabase.from('trip_members').insert(
    memberIds.map(person_id => ({ trip_id: tripId, person_id }))
  )

  redirect(`/trips/${trip.slug}`)
}

export async function archiveTrip(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const supabase = await createClient()

  await supabase.from('trips').update({ status: 'archived' }).eq('id', tripId)

  redirect('/trips')
}

export async function restoreTrip(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const supabase = await createClient()

  await supabase
    .from('trips')
    .update({ status: 'planned' })
    .eq('id', tripId)
    .eq('status', 'archived')

  redirect('/trips?f=archiviert')
}

export async function deleteTripPermanently(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips').select('status').eq('id', tripId).maybeSingle()

  // Endgültiges Löschen ist ausschließlich aus dem Archiv erreichbar — auch
  // serverseitig erzwungen, falls die Action jemals außerhalb dieses Flows
  // aufgerufen wird.
  if (trip?.status !== 'archived')
    redirect(`/trips?error=${encodeURIComponent('Nur archivierte Reisen können endgültig gelöscht werden')}`)

  await supabase.from('trips').delete().eq('id', tripId)

  redirect('/trips?f=archiviert')
}
