/**
 * §"Dateien mit 'use server' dürfen nur async Funktionen exportieren"
 * (gleiches Muster wie lib/saved-flights-shared.ts): `MAX_SAVED_HOTELS_PER_DESTINATION`
 * wird sowohl von der Server Action (`lib/actions/saved-hotels.ts`) als auch
 * von der Seite (`app/(app)/hotels/page.tsx`) gebraucht.
 */

import type { HotelShortlistItem } from './trip-idea-hotel-types'
import type { BookingAdoptionDraft } from './bookings'

export const MAX_SAVED_HOTELS_PER_DESTINATION = 5

/**
 * §Phase B "Zur Reise übernehmen" (Nutzervorgabe), Pendant zu
 * buildFlightAdoptionDraft: `HotelShortlistItem.livePricing` ist immer
 * `null` (kein echter Preis vorhanden, siehe lib/trip-idea-hotel-types.ts)
 * -- `amount` bleibt deshalb bewusst leer statt einen Preis zu erfinden.
 * Check-in/Check-out sind ebenfalls nicht bekannt (saved_hotel_options
 * speichert kein Datum) und bleiben leer, manuell nachzutragen.
 */
export function buildHotelAdoptionDraft(hotel: HotelShortlistItem): BookingAdoptionDraft {
  return {
    stage_id: null,
    title: hotel.name,
    provider: null,
    booking_reference: null,
    status: 'pending',
    payment_status: 'unpaid',
    amount: null,
    currency: 'EUR',
    start_datetime: null,
    end_datetime: null,
    notes: null,
    details: hotel.address ? { location: hotel.address } : null,
  }
}

/** Baut die Ziel-URL für "Zur Reise übernehmen" -- Pendant zu buildFlightAdoptionUrl. */
export function buildHotelAdoptionUrl(tripSlug: string, savedOptionId: string, hotel: HotelShortlistItem): string {
  const params = new URLSearchParams({
    type: 'accommodation',
    draft: JSON.stringify(buildHotelAdoptionDraft(hotel)),
    from_saved_option_id: savedOptionId,
    from_saved_option_table: 'hotel',
  })
  return `/trips/${tripSlug}/bookings/new?${params.toString()}`
}
