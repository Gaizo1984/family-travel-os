'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

export async function createTrip(formData: FormData) {
  const title     = String(formData.get('title') ?? '').trim()
  const subtitle  = String(formData.get('subtitle') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate   = String(formData.get('end_date') ?? '').trim()
  const statusRaw = String(formData.get('status') ?? '').trim()
  const status    = (['planned', 'active', 'completed'] as const).includes(statusRaw as 'planned' | 'active' | 'completed')
    ? (statusRaw as 'planned' | 'active' | 'completed')
    : 'planned'
  const memberIds = formData.getAll('members').map(String)
  const sourceTripIdeaId = String(formData.get('source_trip_idea_id') ?? '').trim()

  // Beide Einstiege ("Reise selbst anlegen" unter /trips/new und der bestehende
  // Formular-Teil von /plan) posten hierher — Redirect-Ziel bei Fehlern richtet
  // sich nach dem Referer, damit beide Formulare ihre eigene Fehleranzeige behalten.
  const referer = String(formData.get('_referer') ?? '/plan')

  if (title.length < 2)
    redirect(`${referer}?error=${encodeURIComponent('Reisenname: mindestens 2 Zeichen erforderlich')}`)
  if (!startDate)
    redirect(`${referer}?error=${encodeURIComponent('Startdatum ist erforderlich')}`)
  if (!endDate)
    redirect(`${referer}?error=${encodeURIComponent('Enddatum ist erforderlich')}`)
  if (startDate && endDate && new Date(endDate) <= new Date(startDate))
    redirect(`${referer}?error=${encodeURIComponent('Enddatum muss nach dem Startdatum liegen')}`)
  if (memberIds.length === 0)
    redirect(`${referer}?error=${encodeURIComponent('Mindestens eine Person muss ausgewählt sein')}`)

  const supabase = await createClient()

  const { data: family } = await supabase
    .from('families').select('id').limit(1).single()

  if (!family?.id)
    redirect(`${referer}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  // Eindeutigen Slug sicherstellen
  const baseSlug = slugify(title) || 'reise'
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
      title,
      subtitle: subtitle || null,
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
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate   = String(formData.get('end_date') ?? '').trim()
  const status    = String(formData.get('status') ?? '').trim()
  const memberIds = formData.getAll('members').map(String)

  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips').select('slug').eq('id', tripId).maybeSingle()

  if (!trip?.slug)
    redirect(`/trips?error=${encodeURIComponent('Reise nicht gefunden')}`)

  const editPath = `/trips/${trip.slug}/edit`

  if (title.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Reisenname: mindestens 2 Zeichen erforderlich')}`)
  if (!startDate)
    redirect(`${editPath}?error=${encodeURIComponent('Startdatum ist erforderlich')}`)
  if (!endDate)
    redirect(`${editPath}?error=${encodeURIComponent('Enddatum ist erforderlich')}`)
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
