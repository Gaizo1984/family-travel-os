'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { combineIsoDate } from '@/lib/documents'
import type { JourneyEventCategory, JourneyEventStatus } from '@/lib/journey-events'

function readCommonFields(formData: FormData) {
  const tripId    = String(formData.get('trip_id') ?? '')
  const stageId   = String(formData.get('stage_id') ?? '').trim()
  const slug      = String(formData.get('slug') ?? '')
  const day       = String(formData.get('date_day') ?? '').trim()
  const month     = String(formData.get('date_month') ?? '').trim()
  const year      = String(formData.get('date_year') ?? '').trim()
  const time      = String(formData.get('time') ?? '').trim()
  const category  = String(formData.get('category') ?? '').trim() as JourneyEventCategory
  const title     = String(formData.get('title') ?? '').trim()
  const location  = String(formData.get('location') ?? '').trim()
  const notes     = String(formData.get('notes') ?? '').trim()
  const status    = String(formData.get('status') ?? 'idea').trim() as JourneyEventStatus
  const returnTo  = String(formData.get('return_to') ?? '').trim()

  const date = combineIsoDate(day, month, year, 'Datum')

  return { tripId, stageId, slug, date, time, category, title, location, notes, status, returnTo }
}

export async function createJourneyEvent(formData: FormData) {
  const slug = String(formData.get('slug') ?? '')
  const newPath = `/trips/${slug}/journey-events/new`

  let f: ReturnType<typeof readCommonFields>
  try {
    f = readCommonFields(formData)
  } catch (e) {
    redirect(`${newPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (f.title.length < 2)
    redirect(`${newPath}?error=${encodeURIComponent('Titel: mindestens 2 Zeichen erforderlich')}`)
  if (!f.date)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte ein Datum auswählen')}`)

  const supabase = await createClient()

  const { error } = await supabase.from('journey_events').insert({
    trip_id: f.tripId,
    stage_id: f.stageId || null,
    date: f.date,
    time: f.time || null,
    category: f.category,
    title: f.title,
    location: f.location || null,
    notes: f.notes || null,
    status: f.status,
  })

  if (error)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(f.returnTo || `/trips/${f.slug}`)
}

export async function updateJourneyEvent(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const editPath = `/trips/${slug}/journey-events/${eventId}/edit`

  let f: ReturnType<typeof readCommonFields>
  try {
    f = readCommonFields(formData)
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (f.title.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Titel: mindestens 2 Zeichen erforderlich')}`)
  if (!f.date)
    redirect(`${editPath}?error=${encodeURIComponent('Bitte ein Datum auswählen')}`)

  const supabase = await createClient()

  const { error } = await supabase.from('journey_events').update({
    stage_id: f.stageId || null,
    date: f.date,
    time: f.time || null,
    category: f.category,
    title: f.title,
    location: f.location || null,
    notes: f.notes || null,
    status: f.status,
  }).eq('id', eventId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(f.returnTo || `/trips/${f.slug}`)
}

export async function deleteJourneyEvent(formData: FormData) {
  const eventId  = String(formData.get('event_id') ?? '')
  const slug     = String(formData.get('slug') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { error } = await supabase.from('journey_events').delete().eq('id', eventId)

  if (error)
    redirect(`/trips/${slug}/journey-events/${eventId}/edit?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo || `/trips/${slug}`)
}
