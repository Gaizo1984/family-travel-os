'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BOOKING_TYPE_CONFIG, combineDateTime } from '@/lib/bookings'
import { suggestCountryCode } from '@/lib/geo-suggestions'
import type { BookingType, BookingStatus, PaymentStatus } from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deterministische Etappen-Zuordnung (kein Raten): Wenn keine Etappe manuell
 * gewählt wurde, aber der Startzeitpunkt eindeutig in genau eine bestehende
 * Etappe fällt, wird diese automatisch übernommen. Bei mehreren möglichen
 * Treffern oder keinem Treffer bleibt die Buchung unzugeordnet — die
 * manuelle Auswahl im Formular hat immer Vorrang.
 */
async function suggestStageId(
  supabase: SupabaseClient,
  tripId: string,
  startDate: string,
): Promise<string | null> {
  if (!startDate) return null
  const { data: stages } = await supabase
    .from('stages')
    .select('id, start_date, end_date')
    .eq('trip_id', tripId)

  const matches = (stages ?? []).filter(
    (s) => s.start_date && s.end_date && startDate >= s.start_date && startDate <= s.end_date,
  )
  return matches.length === 1 ? matches[0].id : null
}

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/**
 * §"Zwischenstopp als Bestandteil eines Fluges... daraus automatisch Etappe
 * erzeugen": im Gegensatz zum heuristischen `flight-stopovers.ts`-Mechanismus
 * (der noch eine Bestätigung verlangt) ist die explizite Nutzereingabe hier
 * bereits die Bestätigung — keine Zwischenbestätigung nötig. Idempotent: legt
 * dieselbe Etappe nicht doppelt an, falls die Buchung mehrfach gespeichert wird.
 */
async function maybeCreateLayoverStage(
  supabase: SupabaseClient,
  tripId: string,
  bookingType: BookingType,
  details: Record<string, string>,
  endDatetime: string | null,
): Promise<void> {
  if (bookingType !== 'flight') return
  const airport = details.layover_airport?.trim()
  const nights = Number(details.layover_nights)
  if (!airport || details.layover_overnight !== 'ja' || !Number.isFinite(nights) || nights <= 0) return
  if (!endDatetime) return

  const startDate = endDatetime.slice(0, 10)
  const endDate = addDaysIso(startDate, nights)

  const { data: existing } = await supabase
    .from('stages').select('id').eq('trip_id', tripId).eq('title', airport).eq('start_date', startDate).maybeSingle()
  if (existing) return

  const [{ data: last }, { data: trip }] = await Promise.all([
    supabase.from('stages').select('sort_order').eq('trip_id', tripId).order('sort_order', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('trips').select('title, subtitle').eq('id', tripId).maybeSingle(),
  ])

  const countryCode = suggestCountryCode(airport) ?? suggestCountryCode(`${trip?.title ?? ''} ${trip?.subtitle ?? ''}`)

  await supabase.from('stages').insert({
    trip_id: tripId,
    title: airport,
    location: airport,
    start_date: startDate,
    end_date: endDate,
    nights,
    sort_order: (last?.sort_order ?? -1) + 1,
    country_code: countryCode,
    notes: 'Automatisch aus Zwischenstopp-Angabe im Flug erzeugt.',
  })
}

/**
 * §"Hotel erzeugt/verknüpft automatisch passende Etappe": Gegenstück zu
 * `maybeCreateLayoverStage`, für Unterkunftsbuchungen. Greift nur, wenn nach
 * `suggestStageId` weiterhin keine Etappe zugeordnet ist — überschreibt nie
 * eine bereits vorhandene (manuelle oder automatische) Zuordnung. Idempotent
 * wie `maybeCreateLayoverStage`. Gibt die neue Etappen-ID zurück, damit der
 * Aufrufer die Buchung selbst damit verknüpfen kann.
 */
async function maybeCreateAccommodationStage(
  supabase: SupabaseClient,
  tripId: string,
  bookingType: BookingType,
  title: string,
  startDatetime: string | null,
  endDatetime: string | null,
): Promise<string | null> {
  if (bookingType !== 'accommodation') return null
  if (!startDatetime) return null

  const startDate = startDatetime.slice(0, 10)
  const endDate = endDatetime ? endDatetime.slice(0, 10) : startDate

  const { data: existing } = await supabase
    .from('stages').select('id').eq('trip_id', tripId).eq('title', title).eq('start_date', startDate).maybeSingle()
  if (existing) return existing.id

  const [{ data: last }, { data: trip }] = await Promise.all([
    supabase.from('stages').select('sort_order').eq('trip_id', tripId).order('sort_order', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('trips').select('title, subtitle').eq('id', tripId).maybeSingle(),
  ])

  const countryCode = suggestCountryCode(title) ?? suggestCountryCode(`${trip?.title ?? ''} ${trip?.subtitle ?? ''}`)
  const nights = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)

  const { data: created } = await supabase.from('stages').insert({
    trip_id: tripId,
    title,
    location: title,
    start_date: startDate,
    end_date: endDate,
    nights: nights >= 0 ? nights : null,
    accommodation: title,
    sort_order: (last?.sort_order ?? -1) + 1,
    country_code: countryCode,
    notes: 'Automatisch aus Hotelbuchung erzeugt.',
  }).select('id').single()

  return created?.id ?? null
}

function readCommonFields(formData: FormData) {
  const type = String(formData.get('type') ?? '') as BookingType
  const config = BOOKING_TYPE_CONFIG[type]

  const title             = String(formData.get('title') ?? '').trim()
  const provider          = String(formData.get('provider') ?? '').trim()
  const stageId            = String(formData.get('stage_id') ?? '').trim()
  const bookingReference  = String(formData.get('booking_reference') ?? '').trim()
  const status            = String(formData.get('status') ?? 'pending') as BookingStatus
  const paymentStatus     = String(formData.get('payment_status') ?? 'unpaid') as PaymentStatus
  const amountRaw         = String(formData.get('amount') ?? '').trim()
  const currency          = String(formData.get('currency') ?? '').trim() || 'EUR'
  const notes             = String(formData.get('notes') ?? '').trim()

  const startDate = String(formData.get('start_date') ?? '').trim()
  const startTime = String(formData.get('start_time') ?? '').trim()
  const endDate   = String(formData.get('end_date') ?? '').trim()
  const endTime   = String(formData.get('end_time') ?? '').trim()

  const details: Record<string, string> = {}
  for (const field of config?.detailFields ?? []) {
    const value = String(formData.get(field.key) ?? '').trim()
    if (value) details[field.key] = value
  }

  return {
    type, config, title, provider, stageId, bookingReference, status, paymentStatus,
    amountRaw, currency, notes, startDate, startTime, endDate, endTime, details,
  }
}

export async function createBooking(formData: FormData) {
  const tripId   = String(formData.get('trip_id') ?? '')
  const slug     = String(formData.get('slug') ?? '')
  const category = String(formData.get('category') ?? '').trim()
  const f = readCommonFields(formData)

  const newPath = `/trips/${slug}/bookings/new?type=${f.type}${category ? `&category=${category}` : ''}`

  if (!f.config)
    redirect(`/trips/${slug}?error=${encodeURIComponent('Ungültiger Buchungstyp')}`)
  if (f.title.length < 2)
    redirect(`${newPath}&error=${encodeURIComponent(`${f.config.titleLabel}: mindestens 2 Zeichen erforderlich`)}`)
  if (!f.startDate)
    redirect(`${newPath}&error=${encodeURIComponent(`${f.config.startLabel}: Datum ist erforderlich`)}`)

  const startDatetime = combineDateTime(f.startDate, f.startTime)
  const endDatetime = f.config.showEnd ? combineDateTime(f.endDate, f.endTime) : null

  if (endDatetime && startDatetime && new Date(endDatetime) < new Date(startDatetime))
    redirect(`${newPath}&error=${encodeURIComponent('Enddatum darf nicht vor dem Startdatum liegen')}`)

  const supabase = await createClient()
  let stageId = f.stageId || await suggestStageId(supabase, tripId, f.startDate)

  const { data: created, error } = await supabase.from('bookings').insert({
    trip_id: tripId,
    stage_id: stageId,
    type: f.type,
    title: f.title,
    provider: f.provider || null,
    booking_reference: f.bookingReference || null,
    status: f.status,
    payment_status: f.paymentStatus,
    amount: f.amountRaw ? Number(f.amountRaw) : null,
    currency: f.currency,
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    details: Object.keys(f.details).length > 0 ? f.details : null,
    notes: f.notes || null,
  }).select('id').single()

  if (error)
    redirect(`${newPath}&error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  await maybeCreateLayoverStage(supabase, tripId, f.type, f.details, endDatetime)

  if (!stageId) {
    const newStageId = await maybeCreateAccommodationStage(supabase, tripId, f.type, f.title, startDatetime, endDatetime)
    if (newStageId && created) {
      stageId = newStageId
      await supabase.from('bookings').update({ stage_id: newStageId }).eq('id', created.id)
    }
  }

  redirect(category ? `/trips/${slug}/bookings/category/${category}` : `/trips/${slug}`)
}

export async function updateBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const f = readCommonFields(formData)

  const editPath = `/trips/${slug}/bookings/${bookingId}/edit`

  if (!f.config)
    redirect(`/trips/${slug}?error=${encodeURIComponent('Ungültiger Buchungstyp')}`)
  if (f.title.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent(`${f.config.titleLabel}: mindestens 2 Zeichen erforderlich`)}`)
  if (!f.startDate)
    redirect(`${editPath}?error=${encodeURIComponent(`${f.config.startLabel}: Datum ist erforderlich`)}`)

  const supabase = await createClient()

  // §Regressionsschutz seit Entfernung des manuellen Etappe-Felds: eine
  // bereits gesetzte stage_id (manuell oder automatisch) darf beim Speichern
  // anderer Felder NIE stumm überschrieben werden — nur fehlende Zuordnungen
  // werden per suggestStageId nachträglich ergänzt.
  const { data: existing } = await supabase.from('bookings').select('trip_id, stage_id').eq('id', bookingId).maybeSingle()
  const tripId = existing?.trip_id ?? ''

  const startDatetime = combineDateTime(f.startDate, f.startTime)
  const endDatetime = f.config.showEnd ? combineDateTime(f.endDate, f.endTime) : null

  if (endDatetime && startDatetime && new Date(endDatetime) < new Date(startDatetime))
    redirect(`${editPath}?error=${encodeURIComponent('Enddatum darf nicht vor dem Startdatum liegen')}`)

  let stageId = existing?.stage_id ?? null
  if (!stageId && tripId) stageId = await suggestStageId(supabase, tripId, f.startDate)

  if (!stageId && tripId) {
    stageId = await maybeCreateAccommodationStage(supabase, tripId, f.type, f.title, startDatetime, endDatetime)
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      stage_id: stageId,
      title: f.title,
      provider: f.provider || null,
      booking_reference: f.bookingReference || null,
      status: f.status,
      payment_status: f.paymentStatus,
      amount: f.amountRaw ? Number(f.amountRaw) : null,
      currency: f.currency,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      details: Object.keys(f.details).length > 0 ? f.details : null,
      notes: f.notes || null,
    })
    .eq('id', bookingId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  if (tripId) await maybeCreateLayoverStage(supabase, tripId, f.type, f.details, endDatetime)

  redirect(`/trips/${slug}/bookings/${bookingId}`)
}

export async function deleteBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const supabase = await createClient()

  const { error } = await supabase.from('bookings').delete().eq('id', bookingId)

  if (error)
    redirect(`/trips/${slug}/bookings/${bookingId}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}
