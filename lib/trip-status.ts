/**
 * Zentrale, datumsbasierte Reise-Statuslogik — nie allein auf den (oft
 * veralteten) DB-Status verlassen. Eine Reise, deren Enddatum bereits
 * vergangen ist, gilt als "historisch", selbst wenn sie nie manuell auf
 * "completed" gesetzt wurde (z. B. Sardinien 2024 mit status='planned').
 * Wiederverwendet von Home-Dashboard, Trip-Detailseite, Familienseite und
 * Reisegeschichte, damit alle Stellen exakt dieselbe Einordnung treffen.
 *
 * §Root-Cause-Fix (Ready-to-Travel/Journey-Bugfix): der `todayIso`-
 * Default-Parameter lieferte bisher `new Date().toISOString().slice(0,10)`
 * -- das ist der UTC-Kalendertag, nicht der deutsche. Zwischen 22:00 und
 * 23:59 UTC (00:00–01:59 deutscher Sommerzeit) zeigte UTC noch den
 * VORHERIGEN Tag, während mehrere Aufrufer (u. a. ready-to-travel/page.tsx,
 * journey/page.tsx) `todayIso` gar nicht explizit übergaben und sich daher
 * genau in diesem täglichen ~2-Stunden-Fenster inkonsistent zu /today
 * verhielten (das seinerseits korrekt `todayIsoInFamilyTimezone()`
 * verwendet). Der Default wird jetzt hier zentral korrigiert, statt an
 * jeder Aufrufstelle einzeln nachzuziehen.
 */
import { todayIsoInFamilyTimezone } from './time'
import { tripDayNumber } from './date-utils'

export type TripStatusLike = { status: string; start_date: string | null; end_date: string | null }

export function isTripPastEnd(trip: TripStatusLike, todayIso: string = todayIsoInFamilyTimezone()): boolean {
  return Boolean(trip.end_date && todayIso > trip.end_date)
}

export function isTripCurrentlyRunning(trip: TripStatusLike, todayIso: string = todayIsoInFamilyTimezone()): boolean {
  return Boolean(trip.start_date && trip.end_date && todayIso >= trip.start_date && todayIso <= trip.end_date)
}

/** Reisen, die in Reisegeschichte/Weltkarte als "erlebt" gelten — abgeschlossen ODER Enddatum vergangen. */
export function isTripHistorical(trip: TripStatusLike, todayIso: string = todayIsoInFamilyTimezone()): boolean {
  return trip.status === 'completed' || (trip.status !== 'archived' && isTripPastEnd(trip, todayIso))
}

export type TripCountdownDisplay = { value: string; label: string }

/**
 * Zentrale Countdown-Darstellung für ALLE Reisekarten (Dashboard-Hero,
 * Reisen-Übersicht, ...) — vorher hatte jede Karte ihre eigene, unabhängige
 * "Tage bis Abreise"-Berechnung, wodurch eine laufende Reise auf manchen
 * Karten eine negative Zahl zeigte. Drei Zustände, nie eine negative Zahl:
 * künftig → Countdown, laufend → Reisetag X/Y, vergangen → "Abgeschlossen".
 */
export function tripCountdownDisplay(
  trip: TripStatusLike,
  duration: number,
  todayIso: string = todayIsoInFamilyTimezone(),
): TripCountdownDisplay {
  if (isTripPastEnd(trip, todayIso)) {
    return { value: '—', label: 'Abgeschlossen' }
  }
  if (trip.start_date && trip.end_date && isTripCurrentlyRunning(trip, todayIso)) {
    const dayNumber = tripDayNumber(todayIso, trip.start_date)
    return { value: `${dayNumber}/${duration}`, label: 'Reisetag' }
  }
  if (trip.start_date) {
    const days = Math.max(
      Math.ceil((new Date(trip.start_date + 'T00:00:00Z').getTime() - new Date(todayIso + 'T00:00:00Z').getTime()) / 86400000),
      0,
    )
    return { value: days.toLocaleString('de-DE'), label: 'Tage bis zur Abreise' }
  }
  return { value: '—', label: 'Tage bis zur Abreise' }
}

/**
 * §"Bei laufender Reise heutigen Reisetag vorauswählen, vor Reisebeginn den
 * ersten Reisetag" (Nutzervorgabe, wörtlich) -- Vorauswahl für neue
 * reisebezogene Buchungen (siehe components/TripDateField.tsx). Für den vom
 * Nutzer nicht spezifizierten Fall "Reise bereits vorbei" gilt dieselbe
 * Regel wie "vor Reisebeginn" (erster Reisetag) -- eine bewusste Annahme,
 * keine Herleitung aus einer expliziten Vorgabe.
 */
export function defaultTripDayIso(tripStartIso: string, tripEndIso: string): string {
  const todayIso = todayIsoInFamilyTimezone()
  if (isTripCurrentlyRunning({ status: '', start_date: tripStartIso, end_date: tripEndIso }, todayIso)) return todayIso
  return tripStartIso
}
