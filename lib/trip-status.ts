/**
 * Zentrale, datumsbasierte Reise-Statuslogik — nie allein auf den (oft
 * veralteten) DB-Status verlassen. Eine Reise, deren Enddatum bereits
 * vergangen ist, gilt als "historisch", selbst wenn sie nie manuell auf
 * "completed" gesetzt wurde (z. B. Sardinien 2024 mit status='planned').
 * Wiederverwendet von Home-Dashboard, Trip-Detailseite, Familienseite und
 * Reisegeschichte, damit alle Stellen exakt dieselbe Einordnung treffen.
 */

export type TripStatusLike = { status: string; start_date: string | null; end_date: string | null }

export function isTripPastEnd(trip: TripStatusLike, todayIso: string = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(trip.end_date && todayIso > trip.end_date)
}

export function isTripCurrentlyRunning(trip: TripStatusLike, todayIso: string = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(trip.start_date && trip.end_date && todayIso >= trip.start_date && todayIso <= trip.end_date)
}

/** Reisen, die in Reisegeschichte/Weltkarte als "erlebt" gelten — abgeschlossen ODER Enddatum vergangen. */
export function isTripHistorical(trip: TripStatusLike, todayIso: string = new Date().toISOString().slice(0, 10)): boolean {
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
  todayIso: string = new Date().toISOString().slice(0, 10),
): TripCountdownDisplay {
  if (isTripPastEnd(trip, todayIso)) {
    return { value: '—', label: 'Abgeschlossen' }
  }
  if (trip.start_date && trip.end_date && isTripCurrentlyRunning(trip, todayIso)) {
    const dayNumber = Math.floor(
      (new Date(todayIso + 'T00:00:00Z').getTime() - new Date(trip.start_date + 'T00:00:00Z').getTime()) / 86400000,
    ) + 1
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
