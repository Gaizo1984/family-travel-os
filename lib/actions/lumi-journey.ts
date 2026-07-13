'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * §"Aktion Merken" (LUMI Intelligence v1, §2/§6): identisches Insert-Muster
 * wie das bereits bestehende `commitConciergeAction`
 * (lib/actions/concierge-actions.ts) -- Status immer 'idea', danach wie
 * jeder andere Termin frei editierbar. Zusätzlich `metadata` (Place-ID,
 * Koordinaten, Fahrzeit, Entfernung, Quelle) für spätere Wiederverwendung
 * (z. B. Tagesplaner). Kein Datum-Picker in der Kategorie-Karte -- landet
 * auf dem heutigen Tag bzw. dem Reisebeginn, die Familie verschiebt es bei
 * Bedarf über die bestehende Journey-Bearbeitung.
 */
export async function commitPlaceToJourney(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const tripSlug = String(formData.get('trip_slug') ?? '')
  const date = String(formData.get('date') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const placeId = String(formData.get('place_id') ?? '').trim() || null
  const lat = formData.get('lat') ? Number(formData.get('lat')) : null
  const lng = formData.get('lng') ? Number(formData.get('lng')) : null
  const durationMinutes = formData.get('duration_minutes') ? Number(formData.get('duration_minutes')) : null
  const distanceKm = formData.get('distance_km') ? Number(formData.get('distance_km')) : null
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/today'

  if (!tripId || !date || !title) redirect(`${returnTo}?error=${encodeURIComponent('Konnte nicht gemerkt werden')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('journey_events').insert({
    trip_id: tripId,
    date,
    category: 'activity',
    title,
    status: 'idea',
    metadata: { place_id: placeId, lat, lng, duration_minutes: durationMinutes, distance_km: distanceKm, source: 'lumi' },
  })

  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  redirect(tripSlug ? `${returnTo}?saved=1` : returnTo)
}

/**
 * §"Übernahme ins Journey" (LUMI Intelligence v1, §6): Bulk-Insert für einen
 * kompletten, per `generateDayPlan` erzeugten Tagesplan -- ein `.insert([...])`
 * für alle Stopps, analog zum bestehenden Bulk-Insert in
 * `trip-idea-generation.ts`. Dedupe-Schutz: Stopps, die am selben Datum
 * bereits unter demselben Titel existieren, werden übersprungen statt
 * doppelt angelegt (z. B. bei versehentlichem Doppelklick).
 */
export async function commitDayPlanToJourney(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const tripSlug = String(formData.get('trip_slug') ?? '')
  const date = String(formData.get('date') ?? '')
  const planRaw = String(formData.get('plan') ?? '')

  if (!tripId || !date || !planRaw) redirect('/today')

  let plan: { stops: Array<{ placeId: string; name: string; category: string; travelMinutes: number; travelDistanceKm: number; why: string | null }> }
  try {
    plan = JSON.parse(planRaw)
  } catch {
    redirect(`/trips/${tripSlug}?error=${encodeURIComponent('Tagesplan konnte nicht gelesen werden')}`)
  }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('journey_events').select('title').eq('trip_id', tripId).eq('date', date)
  const existingTitles = new Set((existing ?? []).map((e) => e.title))

  const rows = plan.stops
    .filter((s) => !existingTitles.has(s.name))
    .map((s) => ({
      trip_id: tripId, date, category: 'activity', title: s.name, notes: s.why, status: 'idea',
      metadata: { place_id: s.placeId, duration_minutes: s.travelMinutes, distance_km: s.travelDistanceKm, source: 'lumi_day_plan' },
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('journey_events').insert(rows)
    if (error) redirect(`/trips/${tripSlug}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  }

  redirect(`/trips/${tripSlug}`)
}
