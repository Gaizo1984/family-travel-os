/**
 * §"Dateien mit 'use server' dürfen nur async Funktionen exportieren"
 * (gleiches Muster wie lib/saved-flights-shared.ts): `MAX_SAVED_HOTELS_PER_DESTINATION`
 * wird sowohl von der Server Action (`lib/actions/saved-hotels.ts`) als auch
 * von der Seite (`app/(app)/hotels/page.tsx`) gebraucht.
 */
export const MAX_SAVED_HOTELS_PER_DESTINATION = 5
