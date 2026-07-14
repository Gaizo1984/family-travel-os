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
 */
export async function buildTravelWorld(params: {
  familyId: string
  personId?: string
  statusFilter?: 'historical' | 'all'
}): Promise<TravelWorld> {
  const supabase = await createClient()
  const statusFilter = params.statusFilter ?? 'historical'

  const [{ data: tripsRaw }, { data: pastTripsRaw }, { data: pastTravelersRaw }] = await Promise.all([
    supabase.from('trips').select(`
      id, slug, title, start_date, end_date, status,
      trip_members ( person_id ),
      stages ( country_code, is_transit, start_date, end_date ),
      bookings ( type, status, start_datetime, end_datetime )
    `).eq('family_id', params.familyId),
    supabase.from('past_trips').select('id, country_or_region, country_code, year, places, duration_days').eq('family_id', params.familyId),
    supabase.from('past_trip_travelers').select('past_trip_id, person_id'),
  ])

  const travelersByPastTrip = new Map<string, string[]>()
  ;(pastTravelersRaw ?? []).forEach((t) => {
    const list = travelersByPastTrip.get(t.past_trip_id) ?? []
    list.push(t.person_id)
    travelersByPastTrip.set(t.past_trip_id, list)
  })

  let trips = (tripsRaw ?? []) as unknown as TripJoin[]
  // §"Reisezeitraum automatisch ableiten": Status/Statistik nutzen denselben
  // zentral abgeleiteten Zeitraum (lib/trip-dates.ts) wie Reiseübersicht und
  // Trip-Detail -- eine Reise ohne manuelles Datum, aber mit Buchungen/
  // Etappen, zählt so trotzdem korrekt als laufend/erlebt.
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

  let pastTrips = (pastTripsRaw ?? []) as PastTripRow[]

  if (params.personId) {
    const personId = params.personId
    trips = trips.filter((t) => t.trip_members.some((m) => m.person_id === personId))
    pastTrips = pastTrips.filter((p) => (travelersByPastTrip.get(p.id) ?? []).includes(personId))
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
      travelerIds: travelersByPastTrip.get(p.id) ?? [],
      countryCodes: p.country_code ? [p.country_code] : [],
      isCurrent: false,
      editHref: `/family/history/${p.id}/edit`,
      tripHref: null,
    })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))

  const lastCountryCode = [...timeline].reverse().flatMap((e) => e.countryCodes)[0] ?? null

  return { tripsCount: trips.length + pastTrips.length, countryCodes, travelDays, timeline, lastCountryCode }
}
