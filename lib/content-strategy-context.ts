import { createClient } from './supabase/server'
import { isTripCurrentlyRunning } from './trip-status'
import { sortStagesChronologically, buildJourneyTimeline } from './journey'
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from './journey'
import { sortBookingsChronologically } from './bookings'
import { resolveCurrentLocation, nearbyStageGeocodeCandidates, buildTodayTimelineItems, detectDayHighlight } from './today'
import { getWeatherForLocation, describeWeatherCode } from './weather'
import type { WeatherLocationCandidate } from './weather'
import { COUNTRY_NAMES } from './geo-suggestions'
import { todayIsoInFamilyTimezone } from './time'
import type { BookingType, BookingStatus } from './supabase/types'
import type { JourneyEventCategory, JourneyEventStatus } from './journey-events'

export type ContentStrategyContext = {
  tripId: string
  tripTitle: string
  forDate: string
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  knownPlanText: string
  highlightTitle: string | null
}

type PersonRow = { id: string; name: string }
type StageRow = {
  id: string; title: string; location: string | null; nights: number | null
  start_date: string | null; end_date: string | null; accommodation: string | null
  sort_order: number; country_code: string | null
}
type BookingRow = {
  id: string; type: BookingType; title: string; provider: string | null; status: BookingStatus
  start_datetime: string | null; end_datetime: string | null; stage_id: string | null
  details: Record<string, string> | null; created_at: string
}
type JourneyEventRow = {
  id: string; stage_id: string | null; date: string; time: string | null
  category: JourneyEventCategory; title: string; location: string | null; status: JourneyEventStatus
}
type TripRow = {
  id: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: StageRow[]; bookings: BookingRow[]; journey_events: JourneyEventRow[]
}

/**
 * Baut denselben Tageskontext (Standort, Wetter, bekannter Plan, Highlight)
 * wie die Heute-Seite, aber eigenständig für die aktuell laufende Reise einer
 * Familie — genutzt vom Content Studio für "Today's Content Strategy". Gibt
 * `null` zurück, wenn gerade keine Reise läuft (dann gibt es keinen "heutigen
 * Tag", über den eine Strategie sinnvoll wäre).
 */
export async function buildContentStrategyContext(familyId: string): Promise<ContentStrategyContext | null> {
  const supabase = await createClient()
  const todayIso = todayIsoInFamilyTimezone()

  const { data: trips } = await supabase
    .from('trips')
    .select(`
      id, title, subtitle, status, start_date, end_date,
      trip_members ( persons ( id, name ) ),
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at ),
      journey_events ( id, stage_id, date, time, category, title, location, status )
    `)
    .eq('family_id', familyId)

  const activeTrip = ((trips ?? []) as unknown as TripRow[]).find((t) => isTripCurrentlyRunning(t, todayIso))
  if (!activeTrip) return null

  const stages = sortStagesChronologically(activeTrip.stages) as StageInput[]
  const bookings = sortBookingsChronologically(activeTrip.bookings) as TimelineBooking[]
  const events = (activeTrip.journey_events ?? []) as TimelineEvent[]

  const timeline = buildJourneyTimeline(
    { start_date: activeTrip.start_date, end_date: activeTrip.end_date },
    stages, bookings, events,
  )
  const allDays: TimelineDay[] = timeline.flatMap((seg) => (seg.kind === 'stay' ? seg.days : [seg.day]))
  const todayDay = allDays.find((d) => d.date === todayIso) ?? null

  const currentLocation = resolveCurrentLocation(activeTrip, stages, bookings, todayIso)
  const countryName = currentLocation.countryCode ? COUNTRY_NAMES[currentLocation.countryCode] ?? null : null
  const weatherCandidates: WeatherLocationCandidate[] = [
    { query: currentLocation.label, countryCode: currentLocation.countryCode },
    ...nearbyStageGeocodeCandidates(stages, currentLocation.label, currentLocation.countryCode, todayIso),
    ...(countryName && countryName !== currentLocation.label ? [{ query: countryName }] : []),
  ]
  const weather = await getWeatherForLocation(weatherCandidates)
  const currentWeather = weather ? describeWeatherCode(weather.currentCode) : null
  const weatherSummary = currentWeather ? `${weather!.currentTemp}°C, ${currentWeather.label}` : null

  const timelineItems = todayDay ? buildTodayTimelineItems(todayDay) : []
  const knownPlanText = timelineItems.map((i) => `${i.time ?? ''} ${i.title}`.trim()).join(', ')
  const highlightTitle = detectDayHighlight(timelineItems)

  const dateLabel = new Date(todayIso).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return {
    tripId: activeTrip.id,
    tripTitle: activeTrip.title,
    forDate: todayIso,
    dateLabel,
    locationLabel: currentLocation.label,
    weatherSummary,
    knownPlanText,
    highlightTitle,
  }
}
