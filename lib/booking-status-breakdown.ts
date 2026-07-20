import type { SavedOptionStatus } from './supabase/types'

/**
 * §Phase B "Zentrale Buchungsübersicht" (Nutzervorgabe): eine einzige,
 * typisierte Gruppierungsfunktion für saved_flight_options/saved_hotel_options
 * nach Gemerkt/Ausgewählt/Gebucht -- von app/(app)/trips/[id]/bookings/page.tsx
 * genutzt, statt die Filterung dort dreifach zu wiederholen. Gleiche
 * Konvention wie lib/trip-dates.ts (reine Funktion, typisierte Eingabe).
 */
export type SavedOptionRow<T> = {
  id: string
  status: SavedOptionStatus
  bookingId: string | null
  data: T
}

export type SavedOptionBreakdown<T> = {
  saved: SavedOptionRow<T>[]
  selected: SavedOptionRow<T>[]
  booked: SavedOptionRow<T>[]
}

export function computeSavedOptionBreakdown<T>(rows: SavedOptionRow<T>[]): SavedOptionBreakdown<T> {
  return {
    saved: rows.filter((r) => r.status === 'saved'),
    selected: rows.filter((r) => r.status === 'selected'),
    booked: rows.filter((r) => r.status === 'booked'),
  }
}
