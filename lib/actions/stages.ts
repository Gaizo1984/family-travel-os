'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { suggestCountryCode } from '@/lib/geo-suggestions'

function computeNights(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null
  const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

export async function createStage(formData: FormData) {
  const tripId        = String(formData.get('trip_id') ?? '')
  const slug          = String(formData.get('slug') ?? '')
  const title         = String(formData.get('title') ?? '').trim()
  const startDate     = String(formData.get('start_date') ?? '').trim()
  const endDate       = String(formData.get('end_date') ?? '').trim()
  const accommodation = String(formData.get('accommodation') ?? '').trim()
  const notes         = String(formData.get('notes') ?? '').trim()

  const newPath = `/trips/${slug}/stages/new`

  if (title.length < 2)
    redirect(`${newPath}?error=${encodeURIComponent('Ziel: mindestens 2 Zeichen erforderlich')}`)
  if (startDate && endDate && new Date(endDate) < new Date(startDate))
    redirect(`${newPath}?error=${encodeURIComponent('Enddatum darf nicht vor dem Startdatum liegen')}`)

  const supabase = await createClient()

  const [{ data: last }, { data: trip }] = await Promise.all([
    supabase.from('stages').select('sort_order').eq('trip_id', tripId).order('sort_order', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('trips').select('title, subtitle').eq('id', tripId).maybeSingle(),
  ])

  // Deterministischer Länder-Vorschlag: zuerst die Etappe selbst (z. B. "Dubai"
  // bei einer Mehrländer-Reise), erst wenn die Etappe keinen Ländertreffer
  // enthält (z. B. "Guanacaste") auf den Reisetitel zurückfallen — sonst würde
  // bei Mehrländer-Reisen der Reisetitel jede Etappe auf ein Land ziehen.
  const countryCode = suggestCountryCode(`${title} ${accommodation}`)
    ?? suggestCountryCode(`${trip?.title ?? ''} ${trip?.subtitle ?? ''}`)

  const { error } = await supabase.from('stages').insert({
    trip_id: tripId,
    title,
    location: title,
    start_date: startDate || null,
    end_date: endDate || null,
    nights: computeNights(startDate, endDate),
    accommodation: accommodation || null,
    notes: notes || null,
    sort_order: (last?.sort_order ?? -1) + 1,
    country_code: countryCode,
  })

  if (error)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}

export async function updateStage(formData: FormData) {
  const stageId       = String(formData.get('stage_id') ?? '')
  const slug          = String(formData.get('slug') ?? '')
  const title         = String(formData.get('title') ?? '').trim()
  const startDate     = String(formData.get('start_date') ?? '').trim()
  const endDate       = String(formData.get('end_date') ?? '').trim()
  const accommodation = String(formData.get('accommodation') ?? '').trim()
  const notes         = String(formData.get('notes') ?? '').trim()

  const editPath = `/trips/${slug}/stages/${stageId}/edit`

  if (title.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Ziel: mindestens 2 Zeichen erforderlich')}`)
  if (startDate && endDate && new Date(endDate) < new Date(startDate))
    redirect(`${editPath}?error=${encodeURIComponent('Enddatum darf nicht vor dem Startdatum liegen')}`)

  const supabase = await createClient()

  const { data: stage } = await supabase.from('stages').select('trip_id').eq('id', stageId).maybeSingle()
  const { data: trip } = stage
    ? await supabase.from('trips').select('title, subtitle').eq('id', stage.trip_id).maybeSingle()
    : { data: null }
  const countryCode = suggestCountryCode(`${title} ${accommodation}`)
    ?? suggestCountryCode(`${trip?.title ?? ''} ${trip?.subtitle ?? ''}`)

  const { error } = await supabase
    .from('stages')
    .update({
      title,
      location: title,
      start_date: startDate || null,
      end_date: endDate || null,
      nights: computeNights(startDate, endDate),
      accommodation: accommodation || null,
      notes: notes || null,
      country_code: countryCode,
    })
    .eq('id', stageId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}

export async function deleteStage(formData: FormData) {
  const stageId = String(formData.get('stage_id') ?? '')
  const tripId  = String(formData.get('trip_id') ?? '')
  const slug    = String(formData.get('slug') ?? '')

  const supabase = await createClient()

  const { count } = await supabase
    .from('stages')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)

  if ((count ?? 0) <= 1)
    redirect(`/trips/${slug}/stages/${stageId}/edit?error=${encodeURIComponent('Mindestens eine Etappe muss erhalten bleiben.')}`)

  const { error } = await supabase.from('stages').delete().eq('id', stageId)

  if (error)
    redirect(`/trips/${slug}/stages/${stageId}/edit?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}
