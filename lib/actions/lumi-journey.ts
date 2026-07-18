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
 * §"Übernahme ins Journey" (Tagesplaner 2.0): Bulk-Insert für EINE
 * ausdrücklich gewählte Variante (Entspannt/Ausgewogen/Erlebnisreich) eines
 * per `generateDayPlan` erzeugten Tagesplans -- ein `.insert([...])` für
 * alle Stopps dieser Variante, analog zum bestehenden Bulk-Insert in
 * `trip-idea-generation.ts`. Schreibt jetzt zusätzlich die echte, vom
 * Tagesplaner berechnete Uhrzeit je Stopp (statt wie in v1 zeitlos).
 *
 * §"Duplikate verhindern" (Nutzervorgabe): Dedupe über ZWEI Signale --
 * exakter Titel ODER dieselbe Place-ID am selben Datum -- robuster als nur
 * der Titelvergleich (fängt z. B. leicht abweichende Namensschreibweisen
 * desselben Orts ab, wenn der Ort bereits manuell im Journey eingetragen
 * wurde).
 */
export async function commitDayPlanVariantToJourney(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const tripSlug = String(formData.get('trip_slug') ?? '')
  const date = String(formData.get('date') ?? '')
  const variantRaw = String(formData.get('variant') ?? '')

  if (!tripId || !date || !variantRaw) redirect('/today')

  let variant: {
    pace: string
    stops: Array<{ placeId: string; name: string; category: string; time: string | null; travelMinutes: number; travelDistanceKm: number; why: string | null }>
  }
  try {
    variant = JSON.parse(variantRaw)
  } catch {
    redirect(`/trips/${tripSlug}?error=${encodeURIComponent('Tagesplan konnte nicht gelesen werden')}`)
  }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('journey_events').select('title, metadata').eq('trip_id', tripId).eq('date', date)
  const existingTitles = new Set((existing ?? []).map((e) => e.title))
  const existingPlaceIds = new Set(
    (existing ?? [])
      .map((e) => (e.metadata as { place_id?: string } | null)?.place_id)
      .filter((id): id is string => Boolean(id)),
  )

  const rows = variant.stops
    .filter((s) => !existingTitles.has(s.name) && !existingPlaceIds.has(s.placeId))
    .map((s) => ({
      trip_id: tripId, date, time: s.time, category: 'activity', title: s.name, notes: s.why, status: 'idea',
      metadata: {
        place_id: s.placeId, duration_minutes: s.travelMinutes, distance_km: s.travelDistanceKm,
        source: 'lumi_day_plan', pace: variant.pace, category: s.category,
      },
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('journey_events').insert(rows)
    if (error) redirect(`/trips/${tripSlug}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  }

  redirect(`/trips/${tripSlug}`)
}
