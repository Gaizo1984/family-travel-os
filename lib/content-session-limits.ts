/**
 * Ausgelagert aus lib/actions/content-sessions.ts, da 'use server'-Dateien
 * nur async Funktionen exportieren dürfen (keine Konstanten/Werte).
 */
/** §"Ungefähr maximal 25 dauerhafte Bilder pro Reise" (aus Content-Studio-Sessions) -- unabhängig von Travel Memorys eigenem MAX_SELECTED_PHOTOS_PER_TRIP=30 (bulk-Qualitätsauswahl, kein Löschen). */
export const MAX_RETAINED_MEMORIES_PER_TRIP = 25

/** §"Formatabhängige Bildlimits": maximale Anzahl hochgeladener Bilder je Content-Art (für die Analyse -- nicht die spätere LUMI-Auswahl). */
export const MAX_PHOTOS_BY_FORMAT: Record<string, number> = {
  carousel: 15, story: 5, reel: 15,
  day_recap: 15, highlight: 15, hotel_content: 15, package: 15,
}
export const DEFAULT_MAX_PHOTOS = 15

/** §"Beitrag": aus bis zu 15 hochgeladenen Bildern wählt LUMI maximal 7 für den finalen Post aus. */
export const MAX_SELECTED_FOR_CAROUSEL = 7

export const CONTENT_FORMAT_LABELS: Record<string, string> = {
  carousel: 'Beitrag', story: 'Story', reel: 'Reel',
  day_recap: 'Tagesrückblick', highlight: 'Ausflug/Highlight', hotel_content: 'Hotel-Content', package: 'Content-Paket',
}

/** §Content Studio 3.0, MVP-Abgrenzung (Nutzervorgabe): nur 15 und 30 Sekunden -- 60s bewusst außerhalb des MVP. */
export const REEL_DURATION_OPTIONS = [
  { value: '15', label: '15 Sekunden' },
  { value: '30', label: '30 Sekunden' },
] as const
export type ReelDurationSeconds = 15 | 30
