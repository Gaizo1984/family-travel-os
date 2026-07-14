import { getTripDuration, formatDateDE } from './demo-data'

/**
 * §"Reiseanlage vereinfachen -- Start-/Enddatum optional": zentrale, einzige
 * Ableitungslogik für den effektiven Reisezeitraum. Wird von Reiseübersicht,
 * Trip-Detail, Dashboard und Reisebilanz (Unsere Welt) gemeinsam genutzt,
 * damit nie zwei Stellen einen unterschiedlichen Zeitraum für dieselbe Reise
 * zeigen und nie zweimal dieselbe Ableitung gebaut wird.
 *
 * Rangfolge je Feld: 1) manuell gepflegtes trips.start_date/end_date (eine
 * spätere Korrektur hat immer Vorrang und deckt sich nicht zwangsläufig mit
 * der Ableitung), 2) frühestes Flug-/Check-in- bis spätestes Rückflug-/
 * Check-out-Datum aus Flug-/Unterkunftsbuchungen, 3) Etappen-Datumsbereich
 * als Fallback (nur wenn keine Buchungen mit Datum existieren), 4) kein
 * Zeitraum ableitbar -> "Zeitraum noch offen".
 */

export type TripDateRangeSource = 'manual' | 'bookings' | 'stages' | 'none'

export type TripDateRange = {
  startDate: string | null
  endDate: string | null
  source: TripDateRangeSource
  /** true, wenn kein Start- UND kein Enddatum ableitbar ist ("Zeitraum noch offen"). */
  isOpen: boolean
}

export type TripDateRangeTripInput = { start_date: string | null; end_date: string | null }
export type TripDateRangeBookingInput = { type: string; status: string; start_datetime: string | null; end_datetime: string | null }
export type TripDateRangeStageInput = { start_date: string | null; end_date: string | null }

/** Nur Flug-/Unterkunftsbuchungen zählen als Zeitraum-Anker -- exakt "frühestes Flug- oder Check-in-, spätestes Rückflug- oder Check-out-Datum". */
const DATE_RELEVANT_BOOKING_TYPES = new Set(['flight', 'accommodation'])

function dateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

export function deriveTripDateRange(
  trip: TripDateRangeTripInput,
  bookings: TripDateRangeBookingInput[] = [],
  stages: TripDateRangeStageInput[] = [],
): TripDateRange {
  const bookingDates = bookings
    .filter((b) => b.status !== 'cancelled' && DATE_RELEVANT_BOOKING_TYPES.has(b.type))
    .flatMap((b) => [dateOnly(b.start_datetime), dateOnly(b.end_datetime)])
    .filter((d): d is string => Boolean(d))

  const stageDates = stages
    .flatMap((s) => [s.start_date, s.end_date])
    .filter((d): d is string => Boolean(d))

  const pool = bookingDates.length > 0 ? bookingDates : stageDates
  const fallbackSource: TripDateRangeSource = bookingDates.length > 0 ? 'bookings' : stageDates.length > 0 ? 'stages' : 'none'

  const derivedStart = pool.length > 0 ? pool.reduce((a, b) => (a < b ? a : b)) : null
  const derivedEnd = pool.length > 0 ? pool.reduce((a, b) => (a > b ? a : b)) : null

  const startDate = trip.start_date ?? derivedStart
  const endDate = trip.end_date ?? derivedEnd
  const source: TripDateRangeSource = trip.start_date && trip.end_date ? 'manual' : fallbackSource

  return { startDate, endDate, source, isOpen: !startDate || !endDate }
}

/** Ersetzt den bisher an >8 Stellen duplizierten Guard `trip.start_date && trip.end_date ? getTripDuration(...) : 0`. */
export function tripDurationDays(range: TripDateRange): number {
  if (!range.startDate || !range.endDate) return 0
  return getTripDuration(range.startDate, range.endDate)
}

export const TRIP_DATE_RANGE_OPEN_LABEL = 'Zeitraum noch offen'

/** Kompaktes Anzeige-Label für Karten/Listen -- "12.03.2026 – 19.03.2026" oder der offene Status. */
export function formatTripDateRangeLabel(range: TripDateRange): string {
  if (!range.startDate || !range.endDate) return TRIP_DATE_RANGE_OPEN_LABEL
  return `${formatDateDE(range.startDate)} – ${formatDateDE(range.endDate)}`
}
