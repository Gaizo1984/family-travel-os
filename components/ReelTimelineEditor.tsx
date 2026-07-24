'use client'

import { useState } from 'react'
import { Player } from '@remotion/player'
import { ArrowUp, ArrowDown, Trash2, Sparkles, RotateCcw, Music, Upload, X, Scale } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ReelTimelineComposition, type ReelCompositionScene, type ReelStyleId } from '@/remotion/ReelTimelineComposition'
import type { ReelStoryboardStructure } from '@/lib/reel-storyboard-types'
import {
  REEL_TRANSITION_OPTIONS, REEL_CAMERA_MOTION_OPTIONS, REEL_MUSIC_PRESET_OPTIONS,
  MIN_SCENE_DURATION_SECONDS, MAX_SCENE_DURATION_SECONDS, MIN_SCENES_REMAINING,
  ALLOWED_MUSIC_MIME_TYPES, MAX_MUSIC_FILE_SIZE_BYTES,
  normalizeTransition, normalizeCameraMotion, type ReelMusicPreset,
} from '@/lib/reel-timeline-options'

type MediaEntry = { displayUrl: string | null; playbackUrl: string }
type MutationResult = { ok: boolean; structure?: ReelStoryboardStructure; error?: string }

type Actions = {
  reorder: (projectId: string, index: number, direction: 'up' | 'down') => Promise<MutationResult>
  remove: (projectId: string, index: number) => Promise<MutationResult>
  restore: (projectId: string) => Promise<MutationResult>
  update: (projectId: string, index: number, patch: Record<string, unknown>) => Promise<MutationResult>
  rebalance: (projectId: string) => Promise<MutationResult>
  regenerateText: (projectId: string, index: number) => Promise<MutationResult & { textOverlay?: string }>
  updateMusic: (projectId: string, choice: { source: 'none' } | { source: 'preset'; presetKey: ReelMusicPreset }) => Promise<MutationResult>
  createMusicSlot: () => Promise<{ path: string; token: string } | null>
  uploadMusic: (projectId: string, stagingPath: string, mimeType: string) => Promise<MutationResult>
  removeMusic: (projectId: string) => Promise<MutationResult>
}

const FPS = 30

/**
 * §Content Studio 3.0, Sprint 4 -- editierbare Timeline + renderfreie
 * Remotion-Player-Vorschau für ein bestehendes `video_reel`-Storyboard.
 * "Änderungen automatisch speichern": jede Mutation ruft direkt eine
 * Server-Action auf und übernimmt deren zurückgegebene `structure` als neuen
 * lokalen Stand -- kein separater "Speichern"-Button, keine Weiterleitung/
 * kein Seiten-Reload (bewusst KEINE FormData-Actions wie in früheren
 * Sprints, da hier häufige Einzelfeld-Änderungen statt einmaliger
 * Formular-Submits vorliegen).
 */
export function ReelTimelineEditor({
  projectId, reelDurationSeconds, reelStyle, initialStructure, mediaByKey, initialMusicPreviewUrl, actions,
}: {
  projectId: string
  reelDurationSeconds: 15 | 30
  reelStyle: ReelStyleId
  initialStructure: ReelStoryboardStructure
  mediaByKey: Record<string, MediaEntry>
  initialMusicPreviewUrl: string | null
  actions: Actions
}) {
  const [structure, setStructure] = useState(initialStructure)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalBusy, setGlobalBusy] = useState(false)
  const [musicPreviewUrl, setMusicPreviewUrl] = useState(initialMusicPreviewUrl)
  const [musicUploading, setMusicUploading] = useState(false)
  const [sceneNonce, setSceneNonce] = useState<Record<number, number>>({})

  async function runMutation(fn: () => Promise<MutationResult>): Promise<MutationResult> {
    setGlobalError(null)
    const result = await fn()
    if (!result.ok) setGlobalError(result.error ?? 'Änderung konnte nicht gespeichert werden.')
    else if (result.structure) setStructure(result.structure)
    return result
  }

  async function handleReorder(index: number, direction: 'up' | 'down') {
    setPendingIndex(index)
    await runMutation(() => actions.reorder(projectId, index, direction))
    setPendingIndex(null)
  }
  async function handleRemove(index: number) {
    setPendingIndex(index)
    await runMutation(() => actions.remove(projectId, index))
    setPendingIndex(null)
  }
  async function handleRestore() {
    setGlobalBusy(true)
    await runMutation(() => actions.restore(projectId))
    setGlobalBusy(false)
  }
  async function handleFieldChange(index: number, patch: Record<string, unknown>) {
    setPendingIndex(index)
    await runMutation(() => actions.update(projectId, index, patch))
    setPendingIndex(null)
  }
  async function handleRebalance() {
    setGlobalBusy(true)
    await runMutation(() => actions.rebalance(projectId))
    setGlobalBusy(false)
  }
  async function handleRegenerateText(index: number) {
    setPendingIndex(index)
    const result = await runMutation(() => actions.regenerateText(projectId, index))
    if (result.ok) setSceneNonce((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }))
    setPendingIndex(null)
  }
  async function handleMusicNone() {
    setGlobalBusy(true)
    await runMutation(() => actions.updateMusic(projectId, { source: 'none' }))
    setMusicPreviewUrl(null)
    setGlobalBusy(false)
  }
  async function handleMusicPreset(presetKey: ReelMusicPreset) {
    setGlobalBusy(true)
    await runMutation(() => actions.updateMusic(projectId, { source: 'preset', presetKey }))
    setMusicPreviewUrl(null)
    setGlobalBusy(false)
  }
  async function handleMusicFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_MUSIC_MIME_TYPES.includes(file.type as (typeof ALLOWED_MUSIC_MIME_TYPES)[number])) {
      setGlobalError('Nicht unterstütztes Audioformat (MP3/M4A/WAV).')
      return
    }
    if (file.size > MAX_MUSIC_FILE_SIZE_BYTES) {
      setGlobalError('Datei zu groß (max. 15 MB).')
      return
    }
    setGlobalError(null)
    setMusicUploading(true)
    try {
      const slot = await actions.createMusicSlot()
      if (!slot) { setGlobalError('Upload aktuell nicht möglich.'); return }
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage.from('documents')
        .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type })
      if (uploadError) { setGlobalError('Upload fehlgeschlagen.'); return }
      const result = await runMutation(() => actions.uploadMusic(projectId, slot.path, file.type))
      if (result.ok) setMusicPreviewUrl(URL.createObjectURL(file))
    } finally {
      setMusicUploading(false)
    }
  }
  async function handleMusicRemove() {
    setGlobalBusy(true)
    await runMutation(() => actions.removeMusic(projectId))
    setMusicPreviewUrl(null)
    setGlobalBusy(false)
  }

  const totalDuration = structure.scenes.reduce((sum, s) => sum + s.duration_seconds, 0)
  const durationIsValid = Math.abs(totalDuration - reelDurationSeconds) < 0.05
  const musicSource = structure.music_source ?? 'none'

  const playerScenes: ReelCompositionScene[] = structure.scenes.map((s) => {
    const media = mediaByKey[`${s.source_type}:${s.source_id}`]
    return {
      sourceType: s.source_type,
      mediaUrl: media?.playbackUrl ?? '',
      durationSeconds: s.duration_seconds,
      transition: normalizeTransition(s.transition),
      cameraMotion: normalizeCameraMotion(s.camera_motion),
      textOverlay: s.text_overlay,
      videoStartSeconds: s.video_start_seconds,
    }
  })
  const durationInFrames = Math.max(1, Math.round(playerScenes.reduce((sum, s) => sum + s.durationSeconds, 0) * FPS))

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl overflow-hidden mx-auto" style={{ width: '100%', maxWidth: 260, aspectRatio: '9/16', background: '#000', border: '1px solid var(--border)' }}>
        {playerScenes.length > 0 && (
          <Player
            key={durationInFrames}
            component={ReelTimelineComposition}
            inputProps={{ scenes: playerScenes, style: reelStyle, musicUrl: musicPreviewUrl }}
            durationInFrames={durationInFrames}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={FPS}
            controls
            loop
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>

      {globalError && (
        <p style={{ color: '#c0392b', fontSize: '0.75rem', textAlign: 'center' }}>{globalError}</p>
      )}

      <div className="flex flex-col items-center gap-2">
        <p style={{ color: durationIsValid ? 'var(--muted)' : '#c0392b', fontSize: '0.78rem' }}>
          Gesamtdauer: {totalDuration.toFixed(1)}s von {reelDurationSeconds}s
        </p>
        {!durationIsValid && (
          <button
            type="button" onClick={handleRebalance} disabled={globalBusy}
            className="flex items-center gap-2"
            style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '999px', padding: '8px 16px', fontSize: '0.72rem' }}
          >
            <Scale size={13} strokeWidth={1.6} /> Dauer automatisch ausgleichen
          </button>
        )}
      </div>

      {structure._previous_scenes && structure._previous_scenes.length > 0 && (
        <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Szene entfernt.</span>
          <button
            type="button" onClick={handleRestore} disabled={globalBusy}
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            <RotateCcw size={13} strokeWidth={1.6} /> Wiederherstellen
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {structure.scenes.map((scene, idx) => {
          const key = `${scene.source_type}:${scene.source_id}`
          const media = mediaByKey[key]
          const isPending = pendingIndex === idx
          const rowKey = `${key}-${idx}-${sceneNonce[idx] ?? 0}`
          return (
            <div
              key={rowKey}
              className="rounded-xl p-3 flex flex-col gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: isPending ? 0.55 : 1 }}
            >
              <div className="flex items-center gap-3">
                <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--background)' }}>
                  {media?.displayUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>{idx + 1}.</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>{scene.source_type === 'photo' ? 'Foto' : 'Video'}</span>
                <div className="flex-1" />
                <button type="button" onClick={() => handleReorder(idx, 'up')} disabled={idx === 0 || isPending} aria-label="Nach oben" style={{ background: 'none', border: 'none', padding: '6px', opacity: idx === 0 ? 0.3 : 1 }}>
                  <ArrowUp size={14} strokeWidth={1.8} style={{ color: 'var(--foreground)' }} />
                </button>
                <button type="button" onClick={() => handleReorder(idx, 'down')} disabled={idx === structure.scenes.length - 1 || isPending} aria-label="Nach unten" style={{ background: 'none', border: 'none', padding: '6px', opacity: idx === structure.scenes.length - 1 ? 0.3 : 1 }}>
                  <ArrowDown size={14} strokeWidth={1.8} style={{ color: 'var(--foreground)' }} />
                </button>
                <button type="button" onClick={() => handleRemove(idx)} disabled={structure.scenes.length <= MIN_SCENES_REMAINING || isPending} aria-label="Entfernen" style={{ background: 'none', border: 'none', padding: '6px', opacity: structure.scenes.length <= MIN_SCENES_REMAINING ? 0.3 : 1 }}>
                  <Trash2 size={14} strokeWidth={1.8} style={{ color: '#B5624A' }} />
                </button>
              </div>

              <textarea
                defaultValue={scene.text_overlay}
                maxLength={140}
                rows={2}
                onBlur={(e) => { if (e.target.value !== scene.text_overlay) handleFieldChange(idx, { text_overlay: e.target.value }) }}
                style={{ width: '100%', fontSize: '0.78rem', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', resize: 'vertical' }}
              />
              <button
                type="button" onClick={() => handleRegenerateText(idx)} disabled={isPending}
                className="flex items-center gap-1.5 self-start"
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                <Sparkles size={13} strokeWidth={1.6} /> Text neu vorschlagen
              </button>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>Dauer</span>
                  <button type="button" disabled={isPending} onClick={() => handleFieldChange(idx, { duration_seconds: Math.max(MIN_SCENE_DURATION_SECONDS, scene.duration_seconds - 0.5) })} style={{ ...STEPPER_BUTTON_STYLE }}>–</button>
                  <span style={{ fontSize: '0.76rem', width: '38px', textAlign: 'center' }}>{scene.duration_seconds.toFixed(1)}s</span>
                  <button type="button" disabled={isPending} onClick={() => handleFieldChange(idx, { duration_seconds: Math.min(MAX_SCENE_DURATION_SECONDS, scene.duration_seconds + 0.5) })} style={{ ...STEPPER_BUTTON_STYLE }}>+</button>
                </div>

                <select
                  defaultValue={normalizeTransition(scene.transition)} disabled={isPending}
                  onChange={(e) => handleFieldChange(idx, { transition: e.target.value })}
                  style={SELECT_STYLE}
                >
                  {REEL_TRANSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <select
                  defaultValue={normalizeCameraMotion(scene.camera_motion)} disabled={isPending}
                  onChange={(e) => handleFieldChange(idx, { camera_motion: e.target.value })}
                  style={SELECT_STYLE}
                >
                  {REEL_CAMERA_MOTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Music size={14} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--accent)', fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Musik</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleMusicNone} disabled={globalBusy} style={chipStyle(musicSource === 'none')}>Keine Musik</button>
          {REEL_MUSIC_PRESET_OPTIONS.map((o) => (
            <button
              key={o.value} type="button" onClick={() => handleMusicPreset(o.value)} disabled={globalBusy}
              style={chipStyle(musicSource === 'preset' && structure.music_preset_key === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {musicSource === 'custom' ? (
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--foreground)', fontSize: '0.74rem' }}>Eigene Datei ausgewählt.</span>
            <button type="button" onClick={handleMusicRemove} disabled={globalBusy} className="flex items-center gap-1" style={{ background: 'none', border: 'none', color: '#B5624A', fontSize: '0.72rem' }}>
              <X size={13} strokeWidth={1.8} /> Entfernen
            </button>
          </div>
        ) : (
          <label
            className="flex items-center gap-2 justify-center rounded-lg"
            style={{ border: '1px dashed var(--border)', padding: '10px', fontSize: '0.72rem', color: 'var(--muted)', cursor: musicUploading ? 'default' : 'pointer' }}
          >
            <Upload size={13} strokeWidth={1.6} />
            {musicUploading ? 'Wird hochgeladen …' : 'Eigene Musikdatei hochladen (MP3/M4A/WAV, max. 15 MB)'}
            <input type="file" accept={ALLOWED_MUSIC_MIME_TYPES.join(',')} onChange={handleMusicFile} disabled={musicUploading} style={{ display: 'none' }} />
          </label>
        )}
        <p style={{ color: 'var(--muted)', fontSize: '0.65rem', lineHeight: 1.5 }}>
          Presets sind Platzhalter (Musikrichtung nur als Auswahl gespeichert) -- lizenzfreie Audiodateien werden erst mit dem echten Rendering hinterlegt.
          Eigene Dateien werden ausschließlich privat gespeichert.
        </p>
      </div>
    </div>
  )
}

const STEPPER_BUTTON_STYLE: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: '0.85rem', lineHeight: 1, cursor: 'pointer',
}
const SELECT_STYLE: React.CSSProperties = {
  fontSize: '0.72rem', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)',
}
function chipStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: '999px', padding: '8px 14px', fontSize: '0.72rem', cursor: 'pointer',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'none', color: active ? 'var(--surface)' : 'var(--foreground)',
  }
}
