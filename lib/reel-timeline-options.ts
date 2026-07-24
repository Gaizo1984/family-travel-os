/**
 * §Content Studio 3.0, Sprint 4: "Übergang und Camera Motion aus einer
 * kleinen festen Auswahl ändern" (Nutzervorgabe, wörtlich) -- Sprint 3s
 * KI-Storyboard liefert für `transition`/`camera_motion` noch freien Text
 * (nur mit Beispielen im Schema-Kommentar), diese Liste ist jetzt die
 * verbindliche, editierbare Auswahl. `normalizeTransition`/
 * `normalizeCameraMotion` fangen unbekannte/ältere KI-Werte sicher ab, statt
 * dass die Timeline-UI oder die Remotion-Komposition an einem unbekannten
 * String scheitert.
 */
export const REEL_TRANSITION_OPTIONS = [
  { value: 'cut', label: 'Schnitt' },
  { value: 'fade', label: 'Überblendung' },
  { value: 'whip_pan', label: 'Whip Pan' },
  { value: 'zoom', label: 'Zoom' },
] as const
export type ReelTransition = (typeof REEL_TRANSITION_OPTIONS)[number]['value']
export function normalizeTransition(value: string): ReelTransition {
  return (REEL_TRANSITION_OPTIONS.find((o) => o.value === value)?.value ?? 'cut') as ReelTransition
}

export const REEL_CAMERA_MOTION_OPTIONS = [
  { value: 'static', label: 'Statisch' },
  { value: 'ken_burns_in', label: 'Ken Burns (rein)' },
  { value: 'ken_burns_out', label: 'Ken Burns (raus)' },
  { value: 'pan_left', label: 'Schwenk links' },
  { value: 'pan_right', label: 'Schwenk rechts' },
] as const
export type ReelCameraMotion = (typeof REEL_CAMERA_MOTION_OPTIONS)[number]['value']
export function normalizeCameraMotion(value: string): ReelCameraMotion {
  return (REEL_CAMERA_MOTION_OPTIONS.find((o) => o.value === value)?.value ?? 'static') as ReelCameraMotion
}

/**
 * §"Gesamtdauer muss exakt 15 oder 30 Sekunden bleiben" + Rebalance-Funktion
 * (siehe lib/actions/reel-timeline.ts::rebalanceScenes): die Grenzen müssen
 * so gewählt sein, dass JEDE laut Sprint 3 mögliche Szenenzahl (mindestens 3,
 * siehe reel-storyboard.ts minScenes) und jede laut "Szenen entfernen"
 * mögliche Restzahl (mindestens MIN_SCENES_REMAINING) beide Zielwerte
 * rechnerisch erreichen kann: 2 Szenen × 15s = 30s, 3 Szenen × 1s = 3s.
 */
export const MIN_SCENE_DURATION_SECONDS = 1
export const MAX_SCENE_DURATION_SECONDS = 15
export const MIN_SCENES_REMAINING = 2

export const REEL_MUSIC_PRESET_OPTIONS = [
  { value: 'warm_acoustic', label: 'Sanft & Warm' },
  { value: 'upbeat_energetic', label: 'Energetisch' },
  { value: 'cinematic_calm', label: 'Cinematic' },
] as const
export type ReelMusicPreset = (typeof REEL_MUSIC_PRESET_OPTIONS)[number]['value']

export const MAX_MUSIC_FILE_SIZE_BYTES = 15 * 1024 * 1024
export const ALLOWED_MUSIC_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav'] as const
export const MUSIC_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
}
