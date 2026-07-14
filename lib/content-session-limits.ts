/**
 * Ausgelagert aus lib/actions/content-sessions.ts, da 'use server'-Dateien
 * nur async Funktionen exportieren dürfen (keine Konstanten/Werte).
 */
/** §"Ungefähr maximal 25 dauerhafte Bilder pro Reise" (aus Content-Studio-Sessions) -- unabhängig von Travel Memorys eigenem MAX_SELECTED_PHOTOS_PER_TRIP=30 (bulk-Qualitätsauswahl, kein Löschen). */
export const MAX_RETAINED_MEMORIES_PER_TRIP = 25
