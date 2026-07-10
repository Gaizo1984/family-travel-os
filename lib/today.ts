import type { LucideIcon } from 'lucide-react'
import type { StageInput, TimelineBooking, TimelineDay } from './journey'
import type { JourneyEventCategory } from './journey-events'
import type { BookingType } from './supabase/types'
import { BOOKING_TYPE_CONFIG, splitDateTime } from './bookings'
import { JOURNEY_EVENT_CATEGORIES, formatEventTime } from './journey-events'
import { suggestCountryCode, COUNTRY_NAMES } from './geo-suggestions'

function dateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

export type TodayTimelineItem = {
  id: string
  time: string | null
  title: string
  subtitle: string | null
  icon: LucideIcon
}

/**
 * §"Timeline komplett aus dem Journey Journal generieren": keine eigene
 * Datenhaltung — sortiert lediglich die für den Tag bereits vorhandenen
 * Buchungen/Journey-Termine (TimelineDay aus lib/journey.ts) nach Uhrzeit.
 */
export function buildTodayTimelineItems(day: TimelineDay): TodayTimelineItem[] {
  type Item = TodayTimelineItem & { sortKey: string }
  const items: Item[] = []

  for (const b of day.bookings) {
    if (b.status === 'cancelled') continue
    const { time } = splitDateTime(b.start_datetime)
    const config = BOOKING_TYPE_CONFIG[b.type as BookingType]
    items.push({
      id: `b-${b.id}`,
      time,
      title: b.title,
      subtitle: b.provider,
      icon: config.icon,
      sortKey: b.start_datetime ?? '',
    })
  }

  for (const e of day.events) {
    items.push({
      id: `e-${e.id}`,
      time: formatEventTime(e.time),
      title: e.title,
      subtitle: e.location,
      icon: JOURNEY_EVENT_CATEGORIES[e.category as JourneyEventCategory].icon,
      sortKey: `${e.date}T${e.time ?? '00:00'}`,
    })
  }

  return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ sortKey, ...rest }) => rest)
}

/** "Was machen wir jetzt?": erster noch bevorstehende Programmpunkt ab der aktuellen Uhrzeit. */
export function findNextUpcoming(items: TodayTimelineItem[], nowHHMM: string): TodayTimelineItem | null {
  return items.find((i) => i.time !== null && i.time >= nowHHMM) ?? null
}

export type CurrentLocation = {
  label: string
  countryCode: string | null
  source: 'stage' | 'accommodation' | 'destination'
}

/**
 * EINE einzige, eindeutige Standortquelle für Hero-Untertitel, Wetter und
 * Hero-Bild — keine Kombination aus mehrereren Quellen (z. B. nicht mehr
 * "Etappe, Land" wie in der vorigen Fassung, die während einer Lücke vor der
 * ersten Etappe fälschlich "Atlanta, Costa Rica" zeigte, obwohl die Familie
 * dort noch gar nicht ist). Feste Prioritätskette, erster Treffer gewinnt:
 * 1) eine Etappe, die "heute" wirklich abdeckt, 2) eine heute aktive
 * Unterkunfts-Buchung, 3) das Reiseziel als letzte Instanz.
 */
export function resolveCurrentLocation(
  trip: { title: string; subtitle: string | null },
  stages: StageInput[],
  bookings: TimelineBooking[],
  todayIso: string,
): CurrentLocation {
  const currentStage = stages.find(
    (s) => s.start_date && s.end_date && s.start_date <= todayIso && todayIso <= s.end_date,
  )
  if (currentStage) {
    return { label: currentStage.location || currentStage.title, countryCode: currentStage.country_code ?? null, source: 'stage' }
  }

  const currentAccommodation = bookings.find(
    (b) => b.type === 'accommodation' && b.status !== 'cancelled'
      && b.start_datetime && b.end_datetime
      && b.start_datetime.slice(0, 10) <= todayIso && b.end_datetime.slice(0, 10) >= todayIso,
  )
  if (currentAccommodation) {
    const relatedStage = stages.find((s) => s.id === currentAccommodation.stage_id)
    return { label: currentAccommodation.title, countryCode: relatedStage?.country_code ?? null, source: 'accommodation' }
  }

  const countryCode = suggestCountryCode(`${trip.title} ${trip.subtitle ?? ''}`)
    ?? stages.find((s) => s.country_code)?.country_code
    ?? null
  const label = countryCode ? COUNTRY_NAMES[countryCode] ?? trip.title : trip.title
  return { label, countryCode, source: 'destination' }
}

export type PrepItem = { icon: LucideIcon; text: string }

/**
 * "Morgen vorbereiten": automatisch aus Flügen, Mietwagen, Bahn/Fähre/Transfer,
 * Aktivitäten von morgen sowie einem morgen fälligen Check-out abgeleitet —
 * keine manuelle Pflege, reine Ableitung aus vorhandenen Buchungen/Etappen.
 */
export function buildTomorrowPrepItems(
  tomorrowDay: TimelineDay | null,
  allStages: StageInput[],
  tomorrowIso: string,
): PrepItem[] {
  const items: PrepItem[] = []

  for (const b of tomorrowDay?.bookings ?? []) {
    if (b.status === 'cancelled') continue
    const { time } = splitDateTime(b.start_datetime)
    const config = BOOKING_TYPE_CONFIG[b.type as BookingType]
    const timeSuffix = time ? ` um ${time} Uhr` : ''

    if (b.type === 'rental_car') {
      const isPickup = dateOnly(b.start_datetime) === tomorrowDay?.date
      items.push({ icon: config.icon, text: isPickup ? `Mietwagen-Abholung${timeSuffix}.` : `Mietwagen zurückgeben${timeSuffix}.` })
    } else if (b.type === 'flight' || b.type === 'train' || b.type === 'ferry' || b.type === 'transfer') {
      items.push({ icon: config.icon, text: `${config.label}${timeSuffix}${b.provider ? ` (${b.provider})` : ''}.` })
    } else if (b.type === 'activity' || b.type === 'restaurant') {
      items.push({ icon: config.icon, text: `${b.title}${timeSuffix}.` })
    }
  }

  const checkoutStage = allStages.find((s) => s.end_date === tomorrowIso)
  if (checkoutStage) {
    items.push({
      icon: BOOKING_TYPE_CONFIG.accommodation.icon,
      text: `Check-out aus ${checkoutStage.accommodation ?? checkoutStage.title}.`,
    })
  }

  return items
}
