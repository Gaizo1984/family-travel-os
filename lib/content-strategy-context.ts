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
  tripSlug: string
  tripTitle: string
  forDate: string
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  knownPlanText: string
  highlightTitle: string | null
  memberNames: string[]
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
  id: string; slug: string; title: string; subtitle: string | null; status: string
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
      id, slug, title, subtitle, status, start_date, end_date,
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

  const memberNames = activeTrip.trip_members.flatMap((m) => (m.persons ? [m.persons.name] : []))

  return {
    tripId: activeTrip.id,
    tripSlug: activeTrip.slug,
    tripTitle: activeTrip.title,
    forDate: todayIso,
    dateLabel,
    locationLabel: currentLocation.label,
    weatherSummary,
    knownPlanText,
    highlightTitle,
    memberNames,
  }
}

export type ContentPostingPlanDay = {
  forDate: string
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  knownPlanText: string
  highlightTitle: string | null
}

export type ContentPostingPlanContext = {
  tripId: string
  tripTitle: string
  memberNames: string[]
  days: ContentPostingPlanDay[]
}

/** §"KI Urlaubs-/Postingfahrplan" ersetzt "Bilder analysieren": zeigt nicht nur den heutigen Tag, sondern die nächsten Tage der laufenden Reise mit je einer Content-Empfehlung. */
const POSTING_PLAN_DAYS_AHEAD = 5

/**
 * Wie buildContentStrategyContext, aber für mehrere kommende Tage statt nur
 * heute -- baut auf denselben Timeline-/Standort-/Wetter-Bausteinen auf
 * (keine zweite Kontext-Ermittlung). Wetter wird nur EINMAL für den
 * heutigen Standort abgerufen (5-Tage-Forecast); wechselt der Standort an
 * einem Folgetag (Etappenwechsel), wird das Wetter für diesen Tag bewusst
 * weggelassen statt für einen anderen Ort geraten.
 */
export async function buildContentPostingPlanContext(familyId: string): Promise<ContentPostingPlanContext | null> {
  const supabase = await createClient()
  const todayIso = todayIsoInFamilyTimezone()

  const { data: trips } = await supabase
    .from('trips')
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
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
  const candidateDates = allDays.map((d) => d.date).filter((date) => date >= todayIso).slice(0, POSTING_PLAN_DAYS_AHEAD)
  if (candidateDates.length === 0) return null

  const todayLocation = resolveCurrentLocation(activeTrip, stages, bookings, todayIso)
  const countryNameToday = todayLocation.countryCode ? COUNTRY_NAMES[todayLocation.countryCode] ?? null : null
  const weatherCandidates: WeatherLocationCandidate[] = [
    { query: todayLocation.label, countryCode: todayLocation.countryCode },
    ...nearbyStageGeocodeCandidates(stages, todayLocation.label, todayLocation.countryCode, todayIso),
    ...(countryNameToday && countryNameToday !== todayLocation.label ? [{ query: countryNameToday }] : []),
  ]
  const weather = await getWeatherForLocation(weatherCandidates)

  const days: ContentPostingPlanDay[] = candidateDates.map((dateIso) => {
    const dayLocation = resolveCurrentLocation(activeTrip, stages, bookings, dateIso)
    const timelineDay = allDays.find((d) => d.date === dateIso) ?? null
    const timelineItems = timelineDay ? buildTodayTimelineItems(timelineDay) : []
    const knownPlanText = timelineItems.map((i) => `${i.time ?? ''} ${i.title}`.trim()).join(', ')
    const highlightTitle = detectDayHighlight(timelineItems)

    let weatherSummary: string | null = null
    if (weather && dayLocation.label === todayLocation.label) {
      const forecastDay = weather.daily.find((d) => d.date === dateIso)
      if (forecastDay) weatherSummary = `${forecastDay.tempMax}°C, ${describeWeatherCode(forecastDay.code).label}`
      else if (dateIso === todayIso) weatherSummary = `${weather.currentTemp}°C, ${describeWeatherCode(weather.currentCode).label}`
    }

    const dateLabel = new Date(dateIso).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })

    return { forDate: dateIso, dateLabel, locationLabel: dayLocation.label, weatherSummary, knownPlanText, highlightTitle }
  })

  const memberNames = activeTrip.trip_members.flatMap((m) => (m.persons ? [m.persons.name] : []))

  return { tripId: activeTrip.id, tripTitle: activeTrip.title, memberNames, days }
}
