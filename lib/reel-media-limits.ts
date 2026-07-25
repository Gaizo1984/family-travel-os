/**
 * §Content Studio 3.0, Sprint 2 -- ausgelagert (nicht in einer 'use server'-
 * Datei), da dort nur async Funktionen exportiert werden dürfen (gleiches
 * Muster wie lib/content-session-limits.ts/lib/memory-limits.ts).
 */

/** §"Mindest-/Maximalanzahl je 15/30-Sekunden-Preset" (Nutzervorgabe): grobe Faustregel ~2-2.5s pro Medium. 30s-Maximum bewusst = MAX_PHOTOS_BY_FORMAT.reel aus Content Studio 2.0 (lib/content-session-limits.ts) für Konsistenz. §Sprint 6: 60s-Preset ergänzt, gleiche Faustregel fortgeführt. */
export const REEL_MEDIA_LIMITS: Record<15 | 30 | 60, { min: number; max: number }> = {
  15: { min: 3, max: 8 },
  30: { min: 5, max: 15 },
  60: { min: 8, max: 24 },
}

export function reelMediaLimitFor(durationSeconds: number): { min: number; max: number } {
  return REEL_MEDIA_LIMITS[durationSeconds as 15 | 30 | 60] ?? REEL_MEDIA_LIMITS[30]
}

/** §"Clip-Länge begrenzen" (Nutzervorgabe): deutlich kürzer als die Reel-Gesamtdauer -- ein einzelner Clip soll nie den ganzen Reel füllen. */
export const MAX_REEL_VIDEO_CLIP_SECONDS = 20

/** Entspricht dem konfigurierten Supabase-Storage-Bucket-Limit (supabase/config.toml, file_size_limit = 50MiB) -- keine serverseitige Videokomprimierung in diesem Sprint, daher realistische Handy-Videogröße innerhalb des Bucket-Limits. */
export const MAX_REEL_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024

export const ALLOWED_REEL_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const

export const REEL_VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}
