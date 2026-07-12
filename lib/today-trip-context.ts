import { resolveCurrentLocation, nearbyStageGeocodeCandidates } from './today'
import type { StageInput, TimelineBooking } from './journey'
import { getWeatherForLocation } from './weather'
import type { WeatherLocationCandidate, WeatherResult } from './weather'
import { COUNTRY_NAMES } from './geo-suggestions'

export type TripAiContext = {
  tripId: string
  tripSlug: string
  tripTitle: string
  isActive: boolean
  locationLabel: string
  countryCode: string | null
  memberNames: string[]
  weather: WeatherResult | null
}

type TripRowForContext = {
  id: string; slug: string; title: string; subtitle: string | null
  trip_members: Array<{ persons: { name: string } | null }>
  stages: StageInput[]
  bookings: TimelineBooking[]
}

/**
 * §Gemeinsame Standort-/Wetter-Auflösung für die LUMI-Startseite UND die
 * Kategorie-Seiten (app/(app)/today/category/[category]) -- beide müssen
 * denselben granularen Ort nennen ("Playa Conchal" statt nur "Costa Rica"),
 * deshalb EIN gemeinsamer Auflösungsweg statt zweier unabhängiger
 * Implementierungen. Nutzt `resolveCurrentLocation` (lib/today.ts,
 * unverändert) für eine laufende Reise; für eine bevorstehende Reise gibt es
 * noch kein "wo sind wir gerade"-Problem, deshalb die erste Etappe mit Ort
 * als granularer Fallback (statt nur Reisetitel/Land).
 */
export async function resolveTripAiContext(
  trip: TripRowForContext,
  isActive: boolean,
  todayIso: string,
): Promise<TripAiContext> {
  const sortedStages = [...trip.stages].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  let locationLabel: string
  let countryCode: string | null
  let candidates: WeatherLocationCandidate[]

  if (isActive) {
    const loc = resolveCurrentLocation(trip, sortedStages, trip.bookings, todayIso)
    locationLabel = loc.label
    countryCode = loc.countryCode
    const countryName = countryCode ? COUNTRY_NAMES[countryCode] ?? null : null
    candidates = [
      { query: locationLabel, countryCode },
      ...nearbyStageGeocodeCandidates(sortedStages, locationLabel, countryCode, todayIso),
      ...(countryName && countryName !== locationLabel ? [{ query: countryName }] : []),
    ]
  } else {
    const firstStage = sortedStages.find((s) => s.location || s.title)
    locationLabel = firstStage?.location || firstStage?.title || trip.title
    countryCode = firstStage?.country_code ?? null
    const countryName = countryCode ? COUNTRY_NAMES[countryCode] ?? null : null
    candidates = [
      { query: locationLabel, countryCode },
      ...(countryName && countryName !== locationLabel ? [{ query: countryName }] : []),
    ]
  }

  const weather = await getWeatherForLocation(candidates)
  const memberNames = trip.trip_members.flatMap((m) => (m.persons ? [m.persons.name] : []))

  return {
    tripId: trip.id, tripSlug: trip.slug, tripTitle: trip.title, isActive,
    locationLabel, countryCode, memberNames, weather,
  }
}
