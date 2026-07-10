import type { LucideIcon } from 'lucide-react'
import type { StageInput, TimelineDay } from './journey'
import type { JourneyEventCategory } from './journey-events'
import type { BookingType } from './supabase/types'
import { BOOKING_TYPE_CONFIG, splitDateTime } from './bookings'
import { JOURNEY_EVENT_CATEGORIES, formatEventTime } from './journey-events'

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
