/**
 * §"Dateien mit 'use server' dürfen nur async Funktionen exportieren":
 * `MAX_SAVED_FLIGHTS_PER_ROUTE`/`buildRouteKey` werden sowohl von der
 * Server Action (`lib/actions/saved-flights.ts`) als auch von Client-
 * Komponenten (`FlightFilterBar`) gebraucht -- deshalb in einer eigenen,
 * direktivenfreien Datei statt in der 'use server'-Datei selbst.
 */

import type { FlightSearchOption } from './flight-types'
import type { BookingAdoptionDraft } from './bookings'

/** §"Bis zu 3 Flugverbindungen pro Strecke merken" (Nutzervorgabe, wörtlich). */
export const MAX_SAVED_FLIGHTS_PER_ROUTE = 3

/** Route-Kennung bewusst OHNE Datum/Reisende -- anders als `buildSearchKey` in `lib/actions/flight-search.ts`, damit gemerkte Verbindungen über mehrere Datums-Suchläufe hinweg für dieselbe Strecke gesammelt werden. */
export function buildRouteKey(originCodes: string[], destinationCode: string): string {
  return [...originCodes].sort().join('+') + '|' + destinationCode
}

/**
 * §Phase B "Zur Reise übernehmen" (Nutzervorgabe: "bestehenden Booking-
 * Draft-Flow nutzen, keine Buchung automatisch final bestätigen"): baut aus
 * dem bereits gemerkten Angebots-Snapshot denselben Draft, den auch die
 * Dokumenten-Auslesung erzeugt (siehe lib/actions/booking-extraction.ts) --
 * landet als vorausgefülltes, aber weiterhin manuell zu bestätigendes
 * Formular. Bei Hin- und Rückflug wird bewusst nur der Hinflug
 * vorausgefüllt (kein automatischer Mehrfach-Buchungs-Flow) -- der
 * Rückflug wird wie bisher als zweite, separate Buchung erfasst.
 */
export function buildFlightAdoptionDraft(option: FlightSearchOption): BookingAdoptionDraft {
  const segments = option.outbound.segments
  const first = segments[0]
  const last = segments[segments.length - 1]
  const details: Record<string, string> = { direction: 'outbound' }
  if (first) {
    details.flight_number = first.flightNumber
    details.from = first.departureAirport
  }
  if (last) details.to = last.arrivalAirport

  return {
    stage_id: null,
    title: null,
    provider: first?.carrierName ?? first?.carrierCode ?? null,
    booking_reference: null,
    status: 'pending',
    payment_status: 'unpaid',
    amount: option.price,
    currency: option.currency,
    start_datetime: first?.departureTime ?? null,
    end_datetime: last?.arrivalTime ?? null,
    notes: null,
    details,
  }
}

/** Baut die Ziel-URL für "Zur Reise übernehmen" -- selbes `draft=`-Muster wie die bestehende Dokumenten-Auslesung, `from_saved_option_id`/`_table` lösen nach erfolgreichem Speichern die Verknüpfung in createBooking aus (siehe lib/actions/bookings.ts). */
export function buildFlightAdoptionUrl(tripSlug: string, savedOptionId: string, option: FlightSearchOption): string {
  const params = new URLSearchParams({
    type: 'flight',
    draft: JSON.stringify(buildFlightAdoptionDraft(option)),
    from_saved_option_id: savedOptionId,
    from_saved_option_table: 'flight',
  })
  return `/trips/${tripSlug}/bookings/new?${params.toString()}`
}
