import { createLumiCoreClient } from './supabase/lumi-core-server'
import { listHouseholdMembers } from './household-members'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, type FamilyDnaSummary } from './family-dna'
import { resolveReferencePoint, type ReferencePoint } from './providers/places-provider'
import { ProviderConfigError, ProviderRequestError } from './providers/provider-errors'
import type { WeatherResult } from './weather'
import { resolveTripAiContext } from './today-trip-context'
import { computeTripReadiness, type ReadinessFinding } from './readiness'
import { isTripCurrentlyRunning } from './trip-status'
import { deriveTripDateRange } from './trip-dates'
import type { StageInput, TimelineBooking, TimelineEvent } from './journey'

export type LumiJourneyItem = { id: string; date: string; title: string; category: string }

export type LumiContext = {
  familyId: string
  tripId: string
  tripSlug: string
  tripTitle: string
  isActive: boolean
  todayIso: string
  startDate: string | null
  endDate: string | null
  /** 1-basiert, nur gesetzt wenn die Reise heute läuft. */
  currentTripDay: number | null
  tripDurationDays: number
  /** Ausgangspunkt-Priorität Hotel → Haupturlaubsort → Etappenort -- siehe resolveReferencePoint/resolveTripAiContext. */
  origin: ReferencePoint
  countryCode: string | null
  weather: WeatherResult | null
  dna: FamilyDnaSummary
  dnaText: string
  memberNames: string[]
  hasRentalCar: boolean
  todaysBookings: TimelineBooking[]
  upcomingBookings: TimelineBooking[]
  plannedActivities: LumiJourneyItem[]
  readinessFindings: ReadinessFinding[]
  /** §"Zwischenstopp-Planung optional" (Nutzervorgabe): siehe lib/today-trip-context.ts::resolveTripAiContext. */
  isPlanningAheadOfStopover: boolean
  stopoverAlternative: { label: string; countryCode: string | null } | null
  /** §"LUMI Brain, keine zweite Journey-Logik": rohe Etappen/Buchungen/Termine
   * dieser Reise -- bereits Teil dieser Abfrage, hier nur zusätzlich
   * exponiert, damit Aufrufer (lib/lumi-brain-context.ts) `buildJourneyTimeline`
   * direkt selbst aufrufen können, statt eine zweite Abfrage zu bauen. */
  stages: StageInput[]
  allBookings: TimelineBooking[]
  allEvents: TimelineEvent[]
}

export type LumiContextResult =
  | { ok: true; context: LumiContext }
  | { ok: false; reason: 'trip_not_found' | 'origin_unresolved' }

/** Konsistente Übersetzung eines LumiContext-Fehlschlags in eine Nutzer-Meldung -- geteilt von allen Aufrufern von `buildLumiContext`. */
export function lumiContextErrorMessage(reason: 'trip_not_found' | 'origin_unresolved'): string {
  return reason === 'trip_not_found'
    ? 'Reise konnte nicht geladen werden'
    : 'Ausgangspunkt (Hotel/Ort) konnte nicht ermittelt werden -- bitte später erneut versuchen.'
}

type TripRow = {
  id: string; slug: string; title: string; status: string; start_date: string | null; end_date: string | null
  trip_members: Array<{ persons: { name: string } | null }>
  stages: StageInput[]
  bookings: TimelineBooking[]
  journey_events: TimelineEvent[]
}

function daysBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso.slice(0, 10)).getTime() - new Date(startIso.slice(0, 10)).getTime()) / 86400000)
}

/**
 * Unter mehreren Unterkunftsbuchungen einer Reise gilt -- analog zur
 * Etappen-Hauptziel-Auswahl in `lib/today-trip-context.ts` -- der aktuell
 * laufende Aufenthalt (falls Reise aktiv) sonst der mit den meisten
 * Nächten als "das gebuchte Hotel" für den LUMI-Kontext.
 */
function pickRelevantAccommodation(bookings: TimelineBooking[], isActive: boolean, todayIso: string): TimelineBooking | null {
  const accommodations = bookings.filter(
    (b) => b.type === 'accommodation' && b.status !== 'cancelled' && b.start_datetime && b.end_datetime,
  )
  if (isActive) {
    const current = accommodations.find(
      (b) => b.start_datetime!.slice(0, 10) <= todayIso && b.end_datetime!.slice(0, 10) >= todayIso,
    )
    if (current) return current
  }
  return [...accommodations].sort(
    (a, b) => daysBetween(b.start_datetime!, b.end_datetime!) - daysBetween(a.start_datetime!, a.end_datetime!),
  )[0] ?? null
}

/**
 * §"Gemeinsamer LUMI-Kontext": EINE Funktion, die für jede produktive
 * LUMI-Anfrage (Kategorien, Tagesempfehlung, Tagesplaner, Frag LUMI) denselben
 * strukturierten Kontext liefert -- baut ausschließlich auf bereits
 * bestehenden, bewährten Bausteinen auf (`resolveTripAiContext` für Ort/
 * Wetter/Land, `resolveReferencePoint` für die Hotel-Auflösung,
 * `buildFamilyDnaSummary` für Familie/Kinderalter, `computeTripReadiness`
 * für offene Vorbereitungspunkte) statt sie zu duplizieren.
 */
export async function buildLumiContext(familyId: string, tripId: string, todayIso: string, preferStopover = false): Promise<LumiContextResult> {
  const lumiCore = await createLumiCoreClient()

  const [{ data: tripRow }, { data: tripMemberRows }, { data: stagesRaw }, { data: bookingsRaw }, { data: journeyEventsRaw }, householdMembers, dna] = await Promise.all([
    lumiCore.from('travel_trips').select('id, slug, title, status, start_date, end_date').eq('id', tripId).maybeSingle(),
    lumiCore.from('travel_trip_members').select('household_member_id').eq('trip_id', tripId),
    lumiCore.from('travel_stages').select('id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code, cover_photo_id, is_transit').eq('trip_id', tripId),
    lumiCore.from('travel_bookings').select('id, type, title, provider, status, start_datetime, end_datetime, stage_id, details').eq('trip_id', tripId),
    lumiCore.from('travel_journey_events').select('id, date, time, category, title, location, status').eq('trip_id', tripId),
    listHouseholdMembers(),
    buildFamilyDnaSummary(familyId),
  ])

  if (!tripRow) return { ok: false, reason: 'trip_not_found' }

  const nameById = new Map(householdMembers.map((m) => [m.id, m.name]))
  const tripMembers = (tripMemberRows ?? []).map((m) => ({
    persons: nameById.has(m.household_member_id) ? { name: nameById.get(m.household_member_id)! } : null,
  }))

  const rawTrip: TripRow = {
    id: tripRow.id, slug: tripRow.slug, title: tripRow.title, status: tripRow.status,
    start_date: tripRow.start_date, end_date: tripRow.end_date,
    trip_members: tripMembers,
    stages: (stagesRaw ?? []) as unknown as StageInput[],
    bookings: (bookingsRaw ?? []) as unknown as TimelineBooking[],
    journey_events: (journeyEventsRaw ?? []) as unknown as TimelineEvent[],
  }
  // §"Reisezeitraum automatisch ableiten": ohne manuelles Datum, aber mit
  // Buchungen/Etappen, gilt die Reise trotzdem korrekt als laufend (lib/trip-dates.ts).
  const tripDateRange = deriveTripDateRange(rawTrip, rawTrip.bookings, rawTrip.stages)
  const trip = { ...rawTrip, start_date: tripDateRange.startDate, end_date: tripDateRange.endDate }
  const isActive = isTripCurrentlyRunning(trip, todayIso)

  const aiContext = await resolveTripAiContext(
    { id: trip.id, slug: trip.slug, title: trip.title, subtitle: null, trip_members: trip.trip_members, stages: trip.stages, bookings: trip.bookings },
    isActive,
    todayIso,
    preferStopover,
  )

  const relevantAccommodation = pickRelevantAccommodation(trip.bookings, isActive, todayIso)
  let origin: ReferencePoint
  try {
    const resolved = await resolveReferencePoint({ hotel: relevantAccommodation?.title ?? null, location: aiContext.locationLabel })
    if (!resolved) return { ok: false, reason: 'origin_unresolved' }
    origin = resolved
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) {
      return { ok: false, reason: 'origin_unresolved' }
    }
    throw e
  }

  const hasRentalCar = trip.bookings.some((b) => b.type === 'rental_car' && b.status !== 'cancelled')
  const todaysBookings = trip.bookings.filter((b) => b.status !== 'cancelled' && b.start_datetime?.slice(0, 10) === todayIso)
  const upcomingBookings = trip.bookings
    .filter((b) => b.status !== 'cancelled' && b.start_datetime && b.start_datetime.slice(0, 10) > todayIso)
    .sort((a, b) => (a.start_datetime ?? '').localeCompare(b.start_datetime ?? ''))

  const currentTripDay = isActive && trip.start_date
    ? Math.floor((new Date(todayIso + 'T00:00:00Z').getTime() - new Date(trip.start_date + 'T00:00:00Z').getTime()) / 86400000) + 1
    : null
  const tripDurationDays = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) + 1 : 0

  const [readiness] = await Promise.all([computeTripReadiness(tripId)])

  return { ok: true, context: {
    familyId, tripId: trip.id, tripSlug: trip.slug, tripTitle: trip.title, isActive, todayIso,
    startDate: trip.start_date, endDate: trip.end_date,
    currentTripDay, tripDurationDays,
    origin, countryCode: aiContext.countryCode, weather: aiContext.weather,
    dna, dnaText: formatFamilyDnaForPrompt(dna, todayIso), memberNames: aiContext.memberNames,
    hasRentalCar, todaysBookings, upcomingBookings,
    plannedActivities: trip.journey_events,
    readinessFindings: readiness.findings,
    isPlanningAheadOfStopover: aiContext.isPlanningAheadOfStopover, stopoverAlternative: aiContext.stopoverAlternative,
    stages: trip.stages, allBookings: trip.bookings, allEvents: trip.journey_events,
  } }
}
