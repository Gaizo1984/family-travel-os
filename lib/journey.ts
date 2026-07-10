import type { BookingType, BookingStatus } from './supabase/types'
import type { JourneyEventCategory, JourneyEventStatus } from './journey-events'
import { BOOKING_TYPE_CONFIG } from './bookings'

export type StageInput = {
  id: string
  title: string
  location: string | null
  start_date: string | null
  end_date: string | null
  nights: number | null
  accommodation: string | null
  sort_order: number
}

/** Gleiche Sortierlogik wie bisher inline auf der Trip-Detailseite — hier zentral, damit Journey und Trip-Seite dieselbe Reihenfolge verwenden. */
export function sortStagesChronologically<T extends { start_date: string | null; sort_order: number }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => {
    if (a.start_date && b.start_date) {
      const cmp = a.start_date.localeCompare(b.start_date)
      return cmp !== 0 ? cmp : a.sort_order - b.sort_order
    }
    if (a.start_date && !b.start_date) return -1
    if (!a.start_date && b.start_date) return 1
    return a.sort_order - b.sort_order
  })
}

function dateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

export type TimelineBooking = {
  id: string
  type: BookingType
  title: string
  provider: string | null
  status: BookingStatus
  start_datetime: string | null
  end_datetime: string | null
}

/**
 * Domänenregel "ein Buchungsdatensatz erzeugt mehrere datumsbezogene Ereignisse":
 * Für Buchungstypen mit separatem End-Zeitpunkt (Mietwagen Abholung/Rückgabe,
 * Bahn/Fähre Abfahrt/Ankunft, Transfer, Flug, ...) wird — sofern Start und Ende
 * auf unterschiedliche Kalendertage fallen — neben dem Start-Eintrag ein zweiter,
 * als solcher beschrifteter Eintrag am End-Datum in die Journey einsortiert.
 * Dieselbe zugrunde liegende Buchung (gleiche id), kein zweiter Datensatz.
 */
function expandBookingOccurrences(bookings: TimelineBooking[]): Array<{ date: string; booking: TimelineBooking }> {
  const occurrences: Array<{ date: string; booking: TimelineBooking }> = []
  for (const b of bookings) {
    const startDate = dateOnly(b.start_datetime)
    if (startDate) occurrences.push({ date: startDate, booking: b })

    const config = BOOKING_TYPE_CONFIG[b.type]
    const endDate = dateOnly(b.end_datetime)
    if (config?.showEnd && endDate && endDate !== startDate) {
      occurrences.push({
        date: endDate,
        booking: { ...b, title: `${b.title} · ${config.endLabel}`, start_datetime: b.end_datetime },
      })
    }
  }
  return occurrences
}

export type TimelineEvent = {
  id: string
  date: string
  category: JourneyEventCategory
  title: string
  time: string | null
  location: string | null
  status: JourneyEventStatus
}

export type TimelineDay = {
  date: string
  stage: StageInput | null
  isStageStart: boolean
  isStageEnd: boolean
  bookings: TimelineBooking[]
  events: TimelineEvent[]
}

export type TimelineSegment =
  | { kind: 'stay'; stage: StageInput; days: TimelineDay[] }
  | { kind: 'day'; day: TimelineDay }

/**
 * Fasst die Reise in Tage/Aufenthalte zusammen: aufeinanderfolgende Tage derselben
 * mehrtägigen Etappe (>= 2 Nächte) werden zu einem Stay-Container gruppiert, kurze
 * Zwischenstopps (0–1 Nächte) und etappenlose Tage bleiben einzelne Tages-Segmente.
 * Reine Darstellungsschicht — erzeugt keine neuen Datensätze, nur Referenzen.
 */
export function buildJourneyTimeline(
  trip: { start_date: string | null; end_date: string | null },
  stagesInput: StageInput[],
  bookings: TimelineBooking[],
  events: TimelineEvent[],
): TimelineSegment[] {
  const stages = sortStagesChronologically(stagesInput)

  const allDatesWithData = [
    trip.start_date, trip.end_date,
    ...stages.flatMap((s) => [s.start_date, s.end_date]),
  ].filter((d): d is string => Boolean(d))
  if (allDatesWithData.length === 0) return []

  const rangeStart = allDatesWithData.reduce((a, b) => (a < b ? a : b))
  const rangeEnd = allDatesWithData.reduce((a, b) => (a > b ? a : b))
  const allDates = eachDateInRange(rangeStart, rangeEnd)

  const bookingsByDate = new Map<string, TimelineBooking[]>()
  for (const { date, booking } of expandBookingOccurrences(bookings)) {
    const list = bookingsByDate.get(date) ?? []
    list.push(booking)
    bookingsByDate.set(date, list)
  }

  const eventsByDate = new Map<string, TimelineEvent[]>()
  for (const e of events) {
    const list = eventsByDate.get(e.date) ?? []
    list.push(e)
    eventsByDate.set(e.date, list)
  }

  // Jedem Tag genau eine Etappe zuordnen — chronologisch je Etappe, mit einem
  // "Cursor", der nie zurückspringt. So bekommt jede Etappe garantiert einen
  // einzigen zusammenhängenden Abschnitt, auch wenn sich Etappen-Datumsbereiche
  // in echten (unsauberen) Daten überschneiden (z. B. Anreisetag der nächsten
  // Etappe noch innerhalb des Datumsbereichs der vorherigen) — sonst würde eine
  // Etappe in zwei getrennte Stay-Container zerfallen.
  const stageByDate = new Map<string, StageInput>()
  let cursor = rangeStart
  for (const stage of stages) {
    if (!stage.start_date || !stage.end_date) continue
    const effectiveStart = stage.start_date > cursor ? stage.start_date : cursor
    if (effectiveStart > stage.end_date) continue // vollständig von einer früheren Etappe überdeckt
    for (const date of eachDateInRange(effectiveStart, stage.end_date)) {
      stageByDate.set(date, stage)
    }
    cursor = addDaysIso(stage.end_date, 1)
  }

  const days: TimelineDay[] = allDates.map((date) => {
    const stage = stageByDate.get(date) ?? null
    return {
      date,
      stage,
      isStageStart: stage ? stage.start_date === date : false,
      isStageEnd: stage ? stage.end_date === date : false,
      bookings: bookingsByDate.get(date) ?? [],
      events: eventsByDate.get(date) ?? [],
    }
  })

  const segments: TimelineSegment[] = []
  let i = 0
  while (i < days.length) {
    const stage = days[i].stage
    if (stage && (stage.nights ?? 0) >= 2) {
      const stageDays: TimelineDay[] = []
      while (i < days.length && days[i].stage?.id === stage.id) {
        stageDays.push(days[i])
        i++
      }
      segments.push({ kind: 'stay', stage, days: stageDays })
    } else {
      segments.push({ kind: 'day', day: days[i] })
      i++
    }
  }

  return segments
}

/**
 * Tage einer einzelnen Etappe (für die Aufenthalts-Detailseite) mit den dort
 * chronologisch einsortierten Buchungen und Journey-Terminen dieser Etappe.
 */
export function buildStageDays(
  stage: StageInput,
  bookings: TimelineBooking[],
  events: TimelineEvent[],
): TimelineDay[] {
  if (!stage.start_date || !stage.end_date) return []

  const bookingsByDate = new Map<string, TimelineBooking[]>()
  for (const { date, booking } of expandBookingOccurrences(bookings)) {
    const list = bookingsByDate.get(date) ?? []
    list.push(booking)
    bookingsByDate.set(date, list)
  }

  const eventsByDate = new Map<string, TimelineEvent[]>()
  for (const e of events) {
    const list = eventsByDate.get(e.date) ?? []
    list.push(e)
    eventsByDate.set(e.date, list)
  }

  return eachDateInRange(stage.start_date, stage.end_date).map((date) => ({
    date,
    stage,
    isStageStart: stage.start_date === date,
    isStageEnd: stage.end_date === date,
    bookings: bookingsByDate.get(date) ?? [],
    events: eventsByDate.get(date) ?? [],
  }))
}

/**
 * Leitet eine kompakte Reise-Route aus den vorhandenen Flugbuchungen (Abflug-/
 * Zielort) und Etappen-Orten ab, chronologisch sortiert und ohne aufeinanderfolgende
 * Dopplungen. Kein manuelles Pflegefeld — reine Ableitung aus bestehenden Daten.
 */
export function buildRouteChips(
  stages: StageInput[],
  flightBookings: Array<{ start_datetime: string | null; details: Record<string, string> | null }>,
): string[] {
  const waypoints: { at: string; label: string }[] = []

  for (const f of flightBookings) {
    if (!f.start_datetime) continue
    const from = f.details?.from
    const to = f.details?.to
    if (from) waypoints.push({ at: f.start_datetime, label: from })
    if (to) waypoints.push({ at: f.start_datetime, label: to })
  }
  for (const s of stages) {
    if (!s.start_date) continue
    const label = s.location || s.title
    if (label) waypoints.push({ at: `${s.start_date}T00:00:00`, label })
  }

  waypoints.sort((a, b) => a.at.localeCompare(b.at))

  const chips: string[] = []
  for (const w of waypoints) {
    if (chips[chips.length - 1] !== w.label) chips.push(w.label)
  }
  return chips
}
