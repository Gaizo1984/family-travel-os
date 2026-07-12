'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { suggestCountryCode } from '@/lib/geo-suggestions'
import { readDateGroupFromFormData } from '@/lib/documents'
import type { SupabaseClient } from '@supabase/supabase-js'

function computeNights(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null
  const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

/**
 * Zentrale Domänenregel "ein Datensatz – mehrere Ansichten": Wenn eine Etappe
 * einen Unterkunftsnamen im Freitextfeld erhält, aber noch keine echte
 * Buchung dafür existiert, wird automatisch eine (unbestätigte) Buchung
 * angelegt, damit dieselbe Unterkunft auch unter "Hotels" erscheint — ohne
 * das Etappenformular selbst zu verändern. Existiert bereits eine Buchung
 * für diese Etappe, wird sie NICHT überschrieben (keine stille
 * Datenüberschreibung manuell gepflegter Buchungsdetails).
 */
async function ensureAccommodationBooking(
  supabase: SupabaseClient,
  tripId: string,
  stageId: string,
  accommodation: string,
  startDate: string | null,
  endDate: string | null,
): Promise<void> {
  if (!accommodation) return

  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .eq('stage_id', stageId)
    .eq('type', 'accommodation')
    .limit(1)
    .maybeSingle()

  if (existing) return

  await supabase.from('bookings').insert({
    trip_id: tripId,
    stage_id: stageId,
    type: 'accommodation',
    title: accommodation,
    status: 'pending',
    payment_status: 'unpaid',
    currency: 'EUR',
    start_datetime: startDate ? `${startDate}T00:00:00` : null,
    end_datetime: endDate ? `${endDate}T00:00:00` : null,
    notes: 'Automatisch aus dem Etappen-Unterkunftsfeld angelegt — bitte Details ergänzen.',
  })
}

export async function createStage(formData: FormData) {
  const tripId        = String(formData.get('trip_id') ?? '')
  const slug          = String(formData.get('slug') ?? '')
  const title         = String(formData.get('title') ?? '').trim()
  const accommodation = String(formData.get('accommodation') ?? '').trim()
  const notes         = String(formData.get('notes') ?? '').trim()

  const newPath = `/trips/${slug}/stages/new`

  let startDate: string | null
  let endDate: string | null
  try {
    startDate = readDateGroupFromFormData(formData, 'start_date', 'Startdatum')
    endDate = readDateGroupFromFormData(formData, 'end_date', 'Enddatum')
  } catch (e) {
    redirect(`${newPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

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

  const { data: created, error } = await supabase
    .from('stages')
    .insert({
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
    .select('id')
    .single()

  if (error)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  if (accommodation)
    await ensureAccommodationBooking(supabase, tripId, created.id, accommodation, startDate, endDate)

  redirect(`/trips/${slug}`)
}

export async function updateStage(formData: FormData) {
  const stageId       = String(formData.get('stage_id') ?? '')
  const slug          = String(formData.get('slug') ?? '')
  const title         = String(formData.get('title') ?? '').trim()
  const accommodation = String(formData.get('accommodation') ?? '').trim()
  const notes         = String(formData.get('notes') ?? '').trim()

  const editPath = `/trips/${slug}/stages/${stageId}/edit`

  let startDate: string | null
  let endDate: string | null
  try {
    startDate = readDateGroupFromFormData(formData, 'start_date', 'Startdatum')
    endDate = readDateGroupFromFormData(formData, 'end_date', 'Enddatum')
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

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

  if (accommodation && stage)
    await ensureAccommodationBooking(supabase, stage.trip_id, stageId, accommodation, startDate, endDate)

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

/**
 * §"Bei Etappen werden falsche Bilder dargestellt... aus der Galerie
 * auswählen können": bewusst getrennt von der automatischen
 * Länder-Bildauflösung (lib/stage-images.ts) -- das Etappen-Titelbild ist
 * eine explizite, eindeutige Wahl, die dort Vorrang bekommt. Gleiches
 * Muster wie setCoverPhoto für Reisen in lib/actions/memories.ts.
 */
export async function setStageCoverPhoto(formData: FormData) {
  const stageId = String(formData.get('stage_id') ?? '')
  const photoId = String(formData.get('photo_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const returnTo = `/trips/${slug}/stages/${stageId}/edit`

  if (!stageId || !photoId)
    redirect(`${returnTo}?error=${encodeURIComponent('Titelbild konnte nicht gesetzt werden')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('stages').update({ cover_photo_id: photoId }).eq('id', stageId)
  if (error)
    redirect(`${returnTo}?error=${encodeURIComponent('Titelbild konnte nicht gesetzt werden: ' + error.message)}`)

  redirect(returnTo)
}

export async function clearStageCoverPhoto(formData: FormData) {
  const stageId = String(formData.get('stage_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const returnTo = `/trips/${slug}/stages/${stageId}/edit`

  const supabase = await createClient()
  await supabase.from('stages').update({ cover_photo_id: null }).eq('id', stageId)

  redirect(returnTo)
}
