import { createClient } from '@/lib/supabase/server'
import { isTripHistorical, isTripCurrentlyRunning } from '@/lib/trip-status'
import { deriveTripDateRange, tripDurationDays } from '@/lib/trip-dates'

export type TravelWorldTimelineEntry = {
  key: string
  kind: 'trip' | 'past_trip'
  year: number | null
  title: string
  subtitle: string
  travelerIds: string[]
  countryCodes: string[]
  isCurrent: boolean
  editHref: string | null
  tripHref: string | null
}

export type TravelWorld = {
  tripsCount: number
  countryCodes: Set<string>
  travelDays: number
  timeline: TravelWorldTimelineEntry[]
  lastCountryCode: string | null
}

type TripJoin = {
  id: string; slug: string; title: string
  start_date: string | null; end_date: string | null; status: string
  trip_members: { person_id: string }[]
  stages: { country_code: string | null; is_transit: boolean; start_date: string | null; end_date: string | null }[]
  bookings: { type: string; status: string; start_datetime: string | null; end_datetime: string | null }[]
}
type PastTripRow = {
  id: string; country_or_region: string; country_code: string | null
  year: number; places: string | null; duration_days: number | null
}

type TravelWorldRawData = {
  trips: TripJoin[]
  pastTrips: PastTripRow[]
  travelersByPastTrip: Map<string, string[]>
}

/** Reine Datenbeschaffung (3 Supabase-Abfragen), keine Filterung/Aggregation -- siehe computeTravelWorld. */
async function fetchTravelWorldRawData(familyId: string): Promise<TravelWorldRawData> {
  const supabase = await createClient()
  const [{ data: tripsRaw }, { data: pastTripsRaw }, { data: pastTravelersRaw }] = await Promise.all([
    supabase.from('trips').select(`
      id, slug, title, start_date, end_date, status,
      trip_members ( person_id ),
      stages ( country_code, is_transit, start_date, end_date ),
      bookings ( type, status, start_datetime, end_datetime )
    `).eq('family_id', familyId),
    supabase.from('past_trips').select('id, country_or_region, country_code, year, places, duration_days').eq('family_id', familyId),
    supabase.from('past_trip_travelers').select('past_trip_id, person_id'),
  ])

  const travelersByPastTrip = new Map<string, string[]>()
  ;(pastTravelersRaw ?? []).forEach((t) => {
    const list = travelersByPastTrip.get(t.past_trip_id) ?? []
    list.push(t.person_id)
    travelersByPastTrip.set(t.past_trip_id, list)
  })

  return {
    trips: (tripsRaw ?? []) as unknown as TripJoin[],
    pastTrips: (pastTripsRaw ?? []) as PastTripRow[],
    travelersByPastTrip,
  }
}

/**
 * §"Unsere Welt": EINZIGE Datenbasis für Weltkarte, Statistik, Reisegeschichte
 * und Personenfilter (family/page.tsx, family/world, family/[personId],
 * family/history, trips-Übersicht) -- ersetzt das frühere
 * `lib/world-stats.ts` (buildWorldStats/buildPersonWorldStats), das nur
 * `status !== 'archived'` statt der datumsbasierten `isTripHistorical`/
 * `isTripCurrentlyRunning`-Logik nutzte und dadurch rein zukünftige Reisen
 * fälschlich mitzählte. Etappen mit `is_transit=true` (reine Flug-
 * Zwischenstopps, siehe stages/confirm-stopover) tragen bewusst kein Land
 * zur Statistik bei, unabhängig von ihrem `country_code`.
 *
 * `trip_members`/`past_trip_travelers` sind die einzige Quelle für den
 * Personenfilter -- keine automatische "ganze Familie"-Zuordnung.
 *
 * Reine Berechnung (keine Datenbankzugriffe) -- Rohdaten kommen aus
 * `fetchTravelWorldRawData`. So getrennt, damit `buildTravelWorldForFamilyAndPersons`
 * unten die Rohdaten einmal holen und mehrfach (Gesamtfamilie + je Person)
 * berechnen kann, ohne die Aggregationslogik zu duplizieren.
 */
function computeTravelWorld(raw: TravelWorldRawData, options: { personId?: string; statusFilter?: 'historical' | 'all' }): TravelWorld {
  const statusFilter = options.statusFilter ?? 'historical'

  let trips = raw.trips
  const rangeByTripId = new Map(trips.map((t) => [t.id, deriveTripDateRange(t, t.bookings, t.stages)]))
  const tripStatusInput = (t: TripJoin) => {
    const range = rangeByTripId.get(t.id)!
    return { status: t.status, start_date: range.startDate, end_date: range.endDate }
  }

  if (statusFilter === 'historical') {
    trips = trips.filter((t) => isTripHistorical(tripStatusInput(t)) || isTripCurrentlyRunning(tripStatusInput(t)))
  } else {
    trips = trips.filter((t) => t.status !== 'archived')
  }

  let pastTrips = raw.pastTrips

  if (options.personId) {
    const personId = options.personId
    trips = trips.filter((t) => t.trip_members.some((m) => m.person_id === personId))
    pastTrips = pastTrips.filter((p) => (raw.travelersByPastTrip.get(p.id) ?? []).includes(personId))
  }

  const countryCodes = new Set<string>()
  trips.forEach((t) => t.stages.forEach((s) => { if (s.country_code && !s.is_transit) countryCodes.add(s.country_code) }))
  pastTrips.forEach((p) => { if (p.country_code) countryCodes.add(p.country_code) })

  const travelDays =
    trips.reduce((sum, t) => sum + tripDurationDays(rangeByTripId.get(t.id)!), 0) +
    pastTrips.reduce((sum, p) => sum + (p.duration_days ?? 0), 0)

  const timeline: TravelWorldTimelineEntry[] = [
    ...trips.map((t) => {
      const range = rangeByTripId.get(t.id)!
      return {
        key: `trip-${t.id}`,
        kind: 'trip' as const,
        year: range.startDate ? new Date(range.startDate).getFullYear() : null,
        title: t.title,
        subtitle: isTripCurrentlyRunning(tripStatusInput(t)) ? 'Aktuelle Reise' : isTripHistorical(tripStatusInput(t)) ? 'Erlebt' : 'In LUMI geplant',
        travelerIds: t.trip_members.map((m) => m.person_id),
        countryCodes: Array.from(new Set(t.stages.filter((s) => !s.is_transit).map((s) => s.country_code).filter((c): c is string => Boolean(c)))),
        isCurrent: isTripCurrentlyRunning(tripStatusInput(t)),
        editHref: null,
        tripHref: `/trips/${t.slug}`,
      }
    }),
    ...pastTrips.map((p) => ({
      key: `past-${p.id}`,
      kind: 'past_trip' as const,
      year: p.year as number | null,
      title: p.country_or_region,
      subtitle: [p.places, p.duration_days ? `${p.duration_days} Tage` : null].filter(Boolean).join(' · ') || 'Manuell erfasst',
      travelerIds: raw.travelersByPastTrip.get(p.id) ?? [],
      countryCodes: p.country_code ? [p.country_code] : [],
      isCurrent: false,
      editHref: `/family/history/${p.id}/edit`,
      tripHref: null,
    })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))

  const lastCountryCode = [...timeline].reverse().flatMap((e) => e.countryCodes)[0] ?? null

  return { tripsCount: trips.length + pastTrips.length, countryCodes, travelDays, timeline, lastCountryCode }
}

export async function buildTravelWorld(params: {
  familyId: string
  personId?: string
  statusFilter?: 'historical' | 'all'
}): Promise<TravelWorld> {
  const raw = await fetchTravelWorldRawData(params.familyId)
  return computeTravelWorld(raw, { personId: params.personId, statusFilter: params.statusFilter })
}

/**
 * §"Ladezeit-Performance, N+1 im Hauptdashboard" (Nutzervorgabe): app/(app)/page.tsx
 * rief bisher `buildTravelWorld()` einmal für die Gesamtfamilie UND einmal
 * PRO Familienmitglied auf -- bei 4 Personen 5 Aufrufe × 3 Supabase-Abfragen
 * = 15 Datenbank-Rundreisen für Daten, die für alle Varianten identisch aus
 * denselben drei Tabellen stammen. Holt die Rohdaten jetzt EINMAL und
 * berechnet Gesamt- sowie Pro-Personen-Statistik rein in-memory (dieselbe
 * `computeTravelWorld`-Logik wie `buildTravelWorld`, nur ohne wiederholte
 * I/O). Nur für diesen einen Mehrfach-Bedarf gedacht -- alle anderen
 * Aufrufstellen (family/world, family/[personId], family/history, trips,
 * memories/yearbook, lumi-brain-context) brauchen weiterhin nur eine
 * einzelne Variante und bleiben unverändert bei `buildTravelWorld()`.
 */
export async function buildTravelWorldForFamilyAndPersons(
  familyId: string,
  personIds: string[],
  statusFilter?: 'historical' | 'all',
): Promise<{ family: TravelWorld; byPersonId: Map<string, TravelWorld> }> {
  const raw = await fetchTravelWorldRawData(familyId)
  const family = computeTravelWorld(raw, { statusFilter })
  const byPersonId = new Map(personIds.map((id) => [id, computeTravelWorld(raw, { personId: id, statusFilter })]))
  return { family, byPersonId }
}

/**
 * §"Besuchte Länder personenbezogen umsetzen" (Nutzervorgabe): pflegt
 * `person_country_visits` (source='trip') aus genau denselben Rohdaten wie
 * `computeTravelWorld` -- keine zweite Ableitungslogik. Läuft on-demand bei
 * jedem Aufruf der Länder-Checkliste (gleiches Prinzip wie `buildTravelWorld`
 * selbst: reine Berechnung bei Bedarf, kein Hintergrundjob).
 *
 * §"trip_members-Lücken defensiv behandeln und nicht automatisch allen
 * Familienmitgliedern zuordnen" (Nutzervorgabe, wörtlich): identische Regel
 * wie `computeTravelWorld` -- eine Reise ohne `trip_members`-Zeilen trägt zu
 * NIEMANDEM etwas bei, kein Fallback auf "alle Familienmitglieder" (anders
 * als der bewusst andere Fallback in `lib/trip-participants.ts` für die
 * Buchungs-Teilnehmerauswahl).
 *
 * §"beide Quellen zusammenführen, Land nur einmal anzeigen, first_visited_at
 * nicht überschreiben": lädt bestehende Zeilen vorab und übernimmt ein schon
 * gesetztes `first_visited_at` unverändert -- `source` wird bei jedem Treffer
 * auf 'trip' gesetzt (Reise-Herkunft gewinnt immer gegenüber 'manual'), ein
 * rein manueller Eintrag ohne passende Reise bleibt von diesem Sync
 * unberührt.
 */
export async function syncTripDerivedCountryVisits(familyId: string): Promise<void> {
  const raw = await fetchTravelWorldRawData(familyId)

  type Derived = { person_id: string; country_code: string; trip_id: string | null; first_visited_at: string | null }
  const derivedByKey = new Map<string, Derived>()

  const addDerived = (personId: string, countryCode: string, tripId: string | null, firstVisitedAt: string | null) => {
    const key = `${personId}|${countryCode}`
    const existing = derivedByKey.get(key)
    if (!existing) {
      derivedByKey.set(key, { person_id: personId, country_code: countryCode, trip_id: tripId, first_visited_at: firstVisitedAt })
      return
    }
    if (firstVisitedAt && (!existing.first_visited_at || firstVisitedAt < existing.first_visited_at)) existing.first_visited_at = firstVisitedAt
    if (!existing.trip_id && tripId) existing.trip_id = tripId
  }

  for (const t of raw.trips) {
    if (t.trip_members.length === 0) continue
    const earliestByCountry = new Map<string, string | null>()
    for (const s of t.stages) {
      if (!s.country_code || s.is_transit) continue
      if (!earliestByCountry.has(s.country_code)) {
        earliestByCountry.set(s.country_code, s.start_date)
      } else {
        const current = earliestByCountry.get(s.country_code)!
        if (s.start_date && (!current || s.start_date < current)) earliestByCountry.set(s.country_code, s.start_date)
      }
    }
    for (const m of t.trip_members) {
      for (const [countryCode, firstDate] of earliestByCountry) addDerived(m.person_id, countryCode, t.id, firstDate)
    }
  }

  for (const p of raw.pastTrips) {
    if (!p.country_code) continue
    for (const personId of raw.travelersByPastTrip.get(p.id) ?? []) addDerived(personId, p.country_code, null, null)
  }

  if (derivedByKey.size === 0) return

  const supabase = await createClient()
  const personIds = [...new Set([...derivedByKey.values()].map((d) => d.person_id))]
  const { data: existingRows } = await supabase
    .from('person_country_visits')
    .select('person_id, country_code, first_visited_at')
    .in('person_id', personIds)
  const existingByKey = new Map((existingRows ?? []).map((r) => [`${r.person_id}|${r.country_code}`, r]))

  const payload = [...derivedByKey.values()].map((d) => {
    const existing = existingByKey.get(`${d.person_id}|${d.country_code}`)
    return {
      person_id: d.person_id,
      country_code: d.country_code,
      source: 'trip' as const,
      trip_id: d.trip_id,
      first_visited_at: existing?.first_visited_at ?? d.first_visited_at,
    }
  })

  const { error } = await supabase.from('person_country_visits').upsert(payload, { onConflict: 'person_id,country_code' })
  if (error) console.error('[person_country_visits] Sync fehlgeschlagen:', error.message)
}
