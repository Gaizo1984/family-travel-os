/**
 * §"Dateien mit 'use server' dürfen nur async Funktionen exportieren":
 * `MAX_SAVED_FLIGHTS_PER_ROUTE`/`buildRouteKey` werden sowohl von der
 * Server Action (`lib/actions/saved-flights.ts`) als auch von Client-
 * Komponenten (`FlightFilterBar`) gebraucht -- deshalb in einer eigenen,
 * direktivenfreien Datei statt in der 'use server'-Datei selbst.
 */

/** §"Bis zu 3 Flugverbindungen pro Strecke merken" (Nutzervorgabe, wörtlich). */
export const MAX_SAVED_FLIGHTS_PER_ROUTE = 3

/** Route-Kennung bewusst OHNE Datum/Reisende -- anders als `buildSearchKey` in `lib/actions/flight-search.ts`, damit gemerkte Verbindungen über mehrere Datums-Suchläufe hinweg für dieselbe Strecke gesammelt werden. */
export function buildRouteKey(originCodes: string[], destinationCode: string): string {
  return [...originCodes].sort().join('+') + '|' + destinationCode
}
