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
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate   = String(formData.get('end_date') ?? '').trim()
  const memberIds = formData.getAll('members').map(String)

  if (title.length < 2)
    redirect(`/plan?error=${encodeURIComponent('Reisenname: mindestens 2 Zeichen erforderlich')}`)
  if (!startDate)
    redirect(`/plan?error=${encodeURIComponent('Startdatum ist erforderlich')}`)
  if (!endDate)
    redirect(`/plan?error=${encodeURIComponent('Enddatum ist erforderlich')}`)
  if (startDate && endDate && new Date(endDate) <= new Date(startDate))
    redirect(`/plan?error=${encodeURIComponent('Enddatum muss nach dem Startdatum liegen')}`)
  if (memberIds.length === 0)
    redirect(`/plan?error=${encodeURIComponent('Mindestens eine Person muss ausgewählt sein')}`)

  const supabase = await createClient()

  const { data: family } = await supabase
    .from('families').select('id').limit(1).single()

  if (!family?.id)
    redirect(`/plan?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

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
      status: 'planned' as const,
      start_date: startDate,
      end_date:   endDate,
    })
    .select('id, slug')
    .single()

  if (error || !trip)
    redirect(`/plan?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'Unbekannt'))}`)

  await supabase.from('trip_members').insert(
    memberIds.map(person_id => ({ trip_id: trip.id, person_id }))
  )

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
