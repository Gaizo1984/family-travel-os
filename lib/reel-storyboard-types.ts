/**
 * §Gemeinsame Typen für das `content_drafts.structure`-JSON bei
 * `draft_type='video_reel'` (siehe lib/actions/reel-storyboard.ts,
 * lib/actions/reel-timeline.ts) -- von Server-Actions UND Client-Komponenten
 * genutzt, deshalb eine reine Typ-Datei ohne 'use server'/'use client'.
 */
export type ReelSceneSource = 'photo' | 'video'

export type ReelTimelineScene = {
  source_type: ReelSceneSource
  source_id: string
  duration_seconds: number
  transition: string
  camera_motion: string
  text_overlay: string
  video_start_seconds: number | null
}

export type ReelMusicSource = 'none' | 'preset' | 'custom'

export type ReelStoryboardStructure = {
  reel_style: string | null
  reel_duration_seconds: number | null
  hook: string
  scenes: ReelTimelineScene[]
  outro: string
  music_direction: string
  caption: string
  hashtags: string[]
  quality_check: { rating: string; summary: string; suggestions: string[] } | null
  reasoning: string
  music_source?: ReelMusicSource
  music_preset_key?: string | null
  music_storage_path?: string | null
  /** §"Szenen entfernen und einmalig wiederherstellen": Schnappschuss der Szenen VOR der letzten Entfernung, nur einmal restaurierbar (wird nach Wiederherstellen gelöscht). */
  _previous_scenes?: ReelTimelineScene[] | null
}
