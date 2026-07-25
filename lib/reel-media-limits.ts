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

/** Entspricht dem konfigurierten Supabase-Storage-Bucket-Limit (supabase/config.toml, file_size_limit = 50MiB). Videos darüber werden clientseitig komprimiert (siehe REEL_VIDEO_COMPRESSION_*-Konstanten unten), nicht mehr pauschal abgelehnt. */
export const MAX_REEL_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024

/**
 * §"Zentrale Limits für Originalgröße, Zielgröße und Clipdauer" (Nutzervorgabe,
 * wörtlich) -- clientseitige Videokompression (lib/video-compression-client.ts).
 * Zielgröße bewusst deutlich unter MAX_REEL_VIDEO_FILE_SIZE_BYTES, damit trotz
 * Mux-/Container-Overhead und Bitrate-Schwankungen sicher unter dem
 * Upload-Limit gelandet wird ("mit etwas Puffer").
 */
export const REEL_VIDEO_COMPRESSION_TARGET_BYTES = 44 * 1024 * 1024
/** Ab dieser Originalgröße wird eine Kompression gar nicht erst versucht -- das Encoding liefe sonst im Browser unangemessen lange/speicherintensiv. */
export const MAX_REEL_VIDEO_SOURCE_FILE_SIZE_BYTES = 500 * 1024 * 1024
export const REEL_VIDEO_COMPRESSION_MAX_WIDTH = 1080
export const REEL_VIDEO_COMPRESSION_MAX_HEIGHT = 1920
export const REEL_VIDEO_COMPRESSION_FPS = 30
export const REEL_VIDEO_COMPRESSION_AUDIO_BITRATE_BPS = 128_000
/** Untergrenze, damit ein sehr langer/ungewöhnlicher Clip nicht auf eine unbrauchbar niedrige Video-Bitrate gedrückt wird. */
export const REEL_VIDEO_COMPRESSION_MIN_VIDEO_BITRATE_BPS = 500_000

export const ALLOWED_REEL_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const

export const REEL_VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}
