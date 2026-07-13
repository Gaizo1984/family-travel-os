import { createClient } from './supabase/server'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, type FamilyDnaSummary } from './family-dna'
import { resolveReferencePoint, type ReferencePoint } from './providers/places-provider'
import { getWeatherForLocation, type WeatherResult } from './weather'
import { resolveTripAiContext } from './today-trip-context'
import { computeTripReadiness, type ReadinessFinding } from './readiness'
import { isTripCurrentlyRunning } from './trip-status'
import type { StageInput, TimelineBooking } from './journey'

export type LumiJourneyItem = { id: string; date: string; title: string; category: string }

export type LumiContext = {
  familyId: string
  tripId: string
  tripSlug: string
  tripTitle: string
  isActive: boolean
  todayIso: string
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
}

type TripRow = {
  id: string; slug: string; title: string; status: string; start_date: string | null; end_date: string | null
  trip_members: Array<{ persons: { name: string } | null }>
  stages: StageInput[]
  bookings: TimelineBooking[]
  journey_events: LumiJourneyItem[]
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
export async function buildLumiContext(familyId: string, tripId: string, todayIso: string): Promise<LumiContext | null> {
  const supabase = await createClient()

  const [{ data: tripRow }, dna] = await Promise.all([
    supabase.from('trips').select(`
      id, slug, title, status, start_date, end_date,
      trip_members ( persons ( name ) ),
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code, cover_photo_id ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details ),
      journey_events ( id, date, title, category )
    `).eq('id', tripId).maybeSingle(),
    buildFamilyDnaSummary(familyId),
  ])

  if (!tripRow) return null
  const trip = tripRow as unknown as TripRow
  const isActive = isTripCurrentlyRunning(trip, todayIso)

  const aiContext = await resolveTripAiContext(
    { id: trip.id, slug: trip.slug, title: trip.title, subtitle: null, trip_members: trip.trip_members, stages: trip.stages, bookings: trip.bookings },
    isActive,
    todayIso,
  )

  const relevantAccommodation = pickRelevantAccommodation(trip.bookings, isActive, todayIso)
  const origin = await resolveReferencePoint({ hotel: relevantAccommodation?.title ?? null, location: aiContext.locationLabel })
    ?? { placeId: null, name: aiContext.locationLabel, formattedAddress: aiContext.locationLabel, lat: 0, lng: 0, source: 'location' as const }

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

  return {
    familyId, tripId: trip.id, tripSlug: trip.slug, tripTitle: trip.title, isActive, todayIso,
    currentTripDay, tripDurationDays,
    origin, countryCode: aiContext.countryCode, weather: aiContext.weather,
    dna, dnaText: formatFamilyDnaForPrompt(dna, todayIso), memberNames: aiContext.memberNames,
    hasRentalCar, todaysBookings, upcomingBookings,
    plannedActivities: trip.journey_events,
    readinessFindings: readiness.findings,
  }
}
