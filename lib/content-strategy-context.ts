import { createLumiCoreClient } from './supabase/lumi-core-server'
import { listHouseholdMembers } from './household-members'
import { isTripCurrentlyRunning } from './trip-status'
import { deriveTripDateRange } from './trip-dates'
import { sortStagesChronologically, buildJourneyTimeline } from './journey'
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from './journey'
import { sortBookingsChronologically } from './bookings'
import { resolveCurrentLocation, nearbyStageGeocodeCandidates, buildTodayTimelineItems, detectDayHighlight } from './today'
import { getWeatherForLocation, describeWeatherCode, formatDailyWeatherSummary } from './weather'
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
  trip_members: Array<{ household_member_id: string }>
  stages: StageRow[]; bookings: BookingRow[]; journey_events: JourneyEventRow[]
}

/** Lädt eine Reise mitsamt Etappen/Buchungen/Journey-Terminen/Mitgliedern flach aus den travel_*-Tabellen (Lumi Core kennt keine verschachtelten Selects über Fremdschlüssel-Relationen wie Travel). */
async function fetchTripsWithRelations(lumiCore: Awaited<ReturnType<typeof createLumiCoreClient>>, householdId: string): Promise<TripRow[]> {
  const { data: tripsRaw } = await lumiCore
    .from('travel_trips')
    .select('id, slug, title, subtitle, status, start_date, end_date')
    .eq('household_id', householdId)
  const trips = tripsRaw ?? []
  const tripIds = trips.map((t) => t.id)
  if (tripIds.length === 0) return []

  const [{ data: membersRaw }, { data: stagesRaw }, { data: bookingsRaw }, { data: eventsRaw }] = await Promise.all([
    lumiCore.from('travel_trip_members').select('trip_id, household_member_id').in('trip_id', tripIds),
    lumiCore.from('travel_stages').select('trip_id, id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code').in('trip_id', tripIds),
    lumiCore.from('travel_bookings').select('trip_id, id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at').in('trip_id', tripIds),
    lumiCore.from('travel_journey_events').select('trip_id, id, stage_id, date, time, category, title, location, status').in('trip_id', tripIds),
  ])

  const byTrip = <T extends { trip_id: string }>(rows: T[] | null) => {
    const map = new Map<string, T[]>()
    for (const r of rows ?? []) { const list = map.get(r.trip_id) ?? []; list.push(r); map.set(r.trip_id, list) }
    return map
  }
  const membersByTrip = byTrip(membersRaw)
  const stagesByTrip = byTrip(stagesRaw)
  const bookingsByTrip = byTrip(bookingsRaw)
  const eventsByTrip = byTrip(eventsRaw)

  return trips.map((t) => ({
    id: t.id, slug: t.slug, title: t.title, subtitle: t.subtitle, status: t.status,
    start_date: t.start_date, end_date: t.end_date,
    trip_members: (membersByTrip.get(t.id) ?? []).map((m) => ({ household_member_id: m.household_member_id })),
    stages: (stagesByTrip.get(t.id) ?? []) as unknown as StageRow[],
    bookings: (bookingsByTrip.get(t.id) ?? []) as unknown as BookingRow[],
    journey_events: (eventsByTrip.get(t.id) ?? []) as unknown as JourneyEventRow[],
  }))
}

/**
 * Baut denselben Tageskontext (Standort, Wetter, bekannter Plan, Highlight)
 * wie die Heute-Seite, aber eigenständig für die aktuell laufende Reise einer
 * Familie — genutzt vom Content Studio für "Today's Content Strategy". Gibt
 * `null` zurück, wenn gerade keine Reise läuft (dann gibt es keinen "heutigen
 * Tag", über den eine Strategie sinnvoll wäre).
 */
export async function buildContentStrategyContext(familyId: string, tripIdOverride?: string | null): Promise<ContentStrategyContext | null> {
  const lumiCore = await createLumiCoreClient()
  const todayIso = todayIsoInFamilyTimezone()

  const trips = await fetchTripsWithRelations(lumiCore, familyId)

  const tripsWithDerivedDates = trips.map((t) => { const range = deriveTripDateRange(t, t.bookings, t.stages); return { ...t, start_date: range.startDate, end_date: range.endDate } })
  // §"Reiseauswahl in Frag LUMI" (Nutzervorgabe): "heutiger Plan"/Wetter/
  // `today_important` etc. ergeben nur für eine AKTIV laufende Reise Sinn --
  // ist die per Override gewählte Reise nicht aktiv, liefert diese Funktion
  // bewusst weiterhin `null`. Die aufrufende Seite zeigt für diesen Fall
  // einen eigenen, leichteren Header-Zweig statt dieses reichen Kontexts.
  const activeTrip = tripIdOverride
    ? tripsWithDerivedDates.find((t) => t.id === tripIdOverride && isTripCurrentlyRunning(t, todayIso))
    : tripsWithDerivedDates.find((t) => isTripCurrentlyRunning(t, todayIso))
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

  const allHouseholdMembers = await listHouseholdMembers()
  const nameById = new Map(allHouseholdMembers.map((m) => [m.id, m.name]))
  const memberNames = activeTrip.trip_members.flatMap((m) => {
    const name = nameById.get(m.household_member_id)
    return name ? [name] : []
  })

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
  const lumiCore = await createLumiCoreClient()
  const todayIso = todayIsoInFamilyTimezone()

  const trips = await fetchTripsWithRelations(lumiCore, familyId)
  const tripsWithDerivedDates = trips.map((t) => { const range = deriveTripDateRange(t, t.bookings, t.stages); return { ...t, start_date: range.startDate, end_date: range.endDate } })
  const activeTrip = tripsWithDerivedDates.find((t) => isTripCurrentlyRunning(t, todayIso))
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
      if (forecastDay) weatherSummary = formatDailyWeatherSummary(forecastDay)
      else if (dateIso === todayIso) weatherSummary = `${weather.currentTemp}°C, ${describeWeatherCode(weather.currentCode).label}`
    }

    const dateLabel = new Date(dateIso).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })

    return { forDate: dateIso, dateLabel, locationLabel: dayLocation.label, weatherSummary, knownPlanText, highlightTitle }
  })

  const allHouseholdMembers = await listHouseholdMembers()
  const nameById = new Map(allHouseholdMembers.map((m) => [m.id, m.name]))
  const memberNames = activeTrip.trip_members.flatMap((m) => {
    const name = nameById.get(m.household_member_id)
    return name ? [name] : []
  })

  return { tripId: activeTrip.id, tripTitle: activeTrip.title, memberNames, days }
}
