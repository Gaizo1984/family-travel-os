/**
 * §"Dateien mit 'use server' dürfen nur async Funktionen exportieren":
 * `MAX_SAVED_FLIGHTS_PER_ROUTE`/`buildRouteKey` werden sowohl von der
 * Server Action (`lib/actions/saved-flights.ts`) als auch von Client-
 * Komponenten (`FlightFilterBar`) gebraucht -- deshalb in einer eigenen,
 * direktivenfreien Datei statt in der 'use server'-Datei selbst.
 */

import type { FlightSearchOption, FlightSegment } from './flight-types'
import type { BookingAdoptionDraft } from './bookings'

/** §"Bis zu 3 Flugverbindungen pro Strecke merken" (Nutzervorgabe, wörtlich). */
export const MAX_SAVED_FLIGHTS_PER_ROUTE = 3

/** Route-Kennung bewusst OHNE Datum/Reisende -- anders als `buildSearchKey` in `lib/actions/flight-search.ts`, damit gemerkte Verbindungen über mehrere Datums-Suchläufe hinweg für dieselbe Strecke gesammelt werden. */
export function buildRouteKey(originCodes: string[], destinationCode: string): string {
  return [...originCodes].sort().join('+') + '|' + destinationCode
}

/**
 * §Bugfix "Zwischenstopps fehlen beim Übernehmen" (Live-Test-Feedback): die
 * Segment-Daten liegen längst vor (`option.outbound.segments`), wurden aber
 * bislang nicht in die vorhandenen `layover_airport`/`layover_overnight`/
 * `layover_nights`-Detailfelder übertragen (siehe
 * `BOOKING_TYPE_CONFIG.flight.detailFields` in lib/bookings.ts). Nur EIN
 * Zwischenstopp wird abgebildet (erster Layover zwischen Segment 0 und 1) --
 * die Buchungsmaske selbst unterstützt ohnehin nur eine Zwischenstopp-Gruppe.
 * Übernachtung wird aus dem Datumsteil bestimmt, nicht geraten.
 */
function computeLayoverDetails(segments: FlightSegment[]): Record<string, string> {
  if (segments.length < 2) return {}
  const arrivalDate = segments[0].arrivalTime.slice(0, 10)
  const departureDate = segments[1].departureTime.slice(0, 10)
  const details: Record<string, string> = { layover_airport: segments[0].arrivalAirport }
  if (arrivalDate !== departureDate) {
    const nights = Math.round((new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / 86400000)
    details.layover_overnight = 'ja'
    if (nights > 0) details.layover_nights = String(nights)
  }
  return details
}

/**
 * §Phase B "Zur Reise übernehmen" (Nutzervorgabe: "bestehenden Booking-
 * Draft-Flow nutzen, keine Buchung automatisch final bestätigen"): baut aus
 * einem Itinerary-Segment (Hin- ODER Rückflug) denselben Draft, den auch die
 * Dokumenten-Auslesung erzeugt (siehe lib/actions/booking-extraction.ts) --
 * landet als vorausgefülltes, aber weiterhin manuell zu bestätigendes
 * Formular. `amount` wird nur beim Hinflug-Draft gesetzt (der Gesamtpreis
 * `option.price` deckt bereits Hin- UND Rückflug ab -- ein zweites Mal beim
 * Rückflug-Draft anzusetzen würde den Preis verdoppeln und wäre erfunden,
 * nicht aus echten Daten abgeleitet).
 */
function buildLegAdoptionDraft(
  segments: FlightSegment[],
  direction: 'outbound' | 'return',
  option: FlightSearchOption,
  includeAmount: boolean,
): BookingAdoptionDraft {
  const first = segments[0]
  const last = segments[segments.length - 1]
  const details: Record<string, string> = { direction, ...computeLayoverDetails(segments) }
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
    amount: includeAmount ? option.price : null,
    currency: option.currency,
    start_datetime: first?.departureTime ?? null,
    end_datetime: last?.arrivalTime ?? null,
    notes: null,
    details,
  }
}

export function buildFlightAdoptionDraft(option: FlightSearchOption): BookingAdoptionDraft {
  return buildLegAdoptionDraft(option.outbound.segments, 'outbound', option, true)
}

/** §Bugfix "Rückflug fehlt" (Live-Test-Feedback, Nutzer wünscht automatische Verkettung): Pendant für den Rückflug, nur aufgerufen wenn `option.inbound` vorhanden ist. */
export function buildFlightReturnAdoptionDraft(option: FlightSearchOption): BookingAdoptionDraft | null {
  if (!option.inbound) return null
  return buildLegAdoptionDraft(option.inbound.segments, 'return', option, false)
}

/**
 * Baut die Ziel-URL für "Zur Reise übernehmen" -- selbes `draft=`-Muster wie
 * die bestehende Dokumenten-Auslesung, `from_saved_option_id`/`_table` lösen
 * nach erfolgreichem Speichern die Verknüpfung in createBooking aus (siehe
 * lib/actions/bookings.ts). §Bugfix "Rückflug fehlt": ist ein Rückflug
 * vorhanden, wird sein Draft zusätzlich als `return_draft` mitgegeben --
 * createBooking verkettet dann nach dem Hinflug automatisch zum
 * vorausgefüllten Rückflug-Formular (weiterhin mit manueller Bestätigung).
 */
export function buildFlightAdoptionUrl(tripSlug: string, savedOptionId: string, option: FlightSearchOption): string {
  const returnDraft = buildFlightReturnAdoptionDraft(option)
  const params = new URLSearchParams({
    type: 'flight',
    draft: JSON.stringify(buildFlightAdoptionDraft(option)),
    from_saved_option_id: savedOptionId,
    from_saved_option_table: 'flight',
  })
  if (returnDraft) params.set('return_draft', JSON.stringify(returnDraft))
  return `/trips/${tripSlug}/bookings/new?${params.toString()}`
}
