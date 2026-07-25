'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import {
  MIN_SCENE_DURATION_SECONDS, MAX_SCENE_DURATION_SECONDS, MIN_SCENES_REMAINING,
  normalizeTransition, normalizeCameraMotion,
  ALLOWED_MUSIC_MIME_TYPES, MAX_MUSIC_FILE_SIZE_BYTES, MUSIC_EXTENSION_BY_MIME,
} from '@/lib/reel-timeline-options'
import { createUploadSlots, type UploadSlot } from '@/lib/actions/photo-staging'
import { rebalanceScenes } from '@/lib/reel-scene-rebalance'
import type { ReelStoryboardStructure, ReelTimelineScene } from '@/lib/reel-storyboard-types'
import type { Json } from '@/lib/supabase/types'

/**
 * §Content Studio 3.0, Sprint 4 -- visuelle Timeline. Bearbeitet das
 * bestehende `video_reel`-Storyboard (content_drafts.structure) IN PLACE
 * (Nutzervorgabe: "im selben Draft bearbeiten", "keine neue Tabelle und kein
 * paralleles Datenmodell") -- keine Migration, keine neue Tabelle. Alle
 * Funktionen sind bewusst normale async Functions mit typisierten Argumenten
 * statt FormData-Actions: sie werden ausschließlich programmatisch aus
 * components/ReelTimelineEditor.tsx aufgerufen (kein <form>-Element,
 * "Änderungen automatisch speichern" bei jedem Feld-/Reihenfolge-Wechsel),
 * nie über eine klassische Formular-Progressive-Enhancement.
 */
const OPENAI_MODEL = 'gpt-5.6-terra'
const STORAGE_BUCKET = 'documents'

type Result = { ok: boolean; structure?: ReelStoryboardStructure; error?: string }

async function loadOwnedDraftContext(projectId: string) {
  const { id: familyId } = await getFamily()
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('content_projects')
    .select('id, family_id, trip_id, reel_duration_seconds')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'reel')
    .maybeSingle()
  if (!project) return null

  const { data: draft } = await supabase
    .from('content_drafts')
    .select('id, structure')
    .eq('project_id', projectId).eq('draft_type', 'video_reel')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!draft) return null

  return { supabase, familyId, project, draftId: draft.id, structure: draft.structure as unknown as ReelStoryboardStructure }
}

async function saveStructure(
  supabase: Awaited<ReturnType<typeof createClient>>, draftId: string, structure: ReelStoryboardStructure,
): Promise<Result> {
  const { error } = await supabase.from('content_drafts').update({ structure: structure as unknown as Json }).eq('id', draftId)
  if (error) return { ok: false, error: 'Speicherfehler: ' + error.message }
  return { ok: true, structure }
}

export async function rebalanceReelTimelineDuration(projectId: string): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  const target = ctx.project.reel_duration_seconds ?? 30
  const structure = { ...ctx.structure, scenes: rebalanceScenes(ctx.structure.scenes, target) }
  return saveStructure(ctx.supabase, ctx.draftId, structure)
}

export async function reorderReelTimelineScene(projectId: string, index: number, direction: 'up' | 'down'): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  const scenes = [...ctx.structure.scenes]
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= scenes.length || swapWith < 0 || swapWith >= scenes.length) return { ok: false, error: 'Ungültige Position.' }
  ;[scenes[index], scenes[swapWith]] = [scenes[swapWith], scenes[index]]
  return saveStructure(ctx.supabase, ctx.draftId, { ...ctx.structure, scenes })
}

/** §"Szenen entfernen und einmalig wiederherstellen": Schnappschuss VOR der Entfernung, danach automatischer Dauer-Ausgleich (siehe rebalanceScenes). */
export async function removeReelTimelineScene(projectId: string, index: number): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  const scenes = ctx.structure.scenes
  if (index < 0 || index >= scenes.length) return { ok: false, error: 'Ungültige Position.' }
  if (scenes.length <= MIN_SCENES_REMAINING) return { ok: false, error: `Mindestens ${MIN_SCENES_REMAINING} Szenen müssen erhalten bleiben.` }

  const previousScenes = scenes.map((s) => ({ ...s }))
  const remainingScenes = scenes.filter((_, i) => i !== index)
  const target = ctx.project.reel_duration_seconds ?? 30
  const structure: ReelStoryboardStructure = {
    ...ctx.structure, scenes: rebalanceScenes(remainingScenes, target), _previous_scenes: previousScenes,
  }
  return saveStructure(ctx.supabase, ctx.draftId, structure)
}

export async function restoreReelTimelineScenes(projectId: string): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  if (!ctx.structure._previous_scenes || ctx.structure._previous_scenes.length === 0) return { ok: false, error: 'Nichts zum Wiederherstellen.' }
  const structure: ReelStoryboardStructure = { ...ctx.structure, scenes: ctx.structure._previous_scenes, _previous_scenes: null }
  return saveStructure(ctx.supabase, ctx.draftId, structure)
}

/**
 * §"Text, Dauer, Übergang und Camera Motion bearbeiten" + automatischer
 * Dauer-Ausgleich bei Dauer-Änderungen, damit die Gesamtdauer "automatisch
 * neu validiert" UND exakt bleibt (siehe rebalanceScenes-Kommentar).
 */
export async function updateReelTimelineScene(
  projectId: string, index: number,
  patch: Partial<Pick<ReelTimelineScene, 'text_overlay' | 'duration_seconds' | 'transition' | 'camera_motion'>>,
): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  const scenes = [...ctx.structure.scenes]
  if (index < 0 || index >= scenes.length) return { ok: false, error: 'Ungültige Position.' }

  const durationChanged = patch.duration_seconds !== undefined
  const nextScene: ReelTimelineScene = {
    ...scenes[index],
    ...(patch.text_overlay !== undefined ? { text_overlay: patch.text_overlay.slice(0, 140) } : {}),
    ...(patch.transition !== undefined ? { transition: normalizeTransition(patch.transition) } : {}),
    ...(patch.camera_motion !== undefined ? { camera_motion: normalizeCameraMotion(patch.camera_motion) } : {}),
    ...(durationChanged ? { duration_seconds: Math.max(MIN_SCENE_DURATION_SECONDS, Math.min(MAX_SCENE_DURATION_SECONDS, patch.duration_seconds!)) } : {}),
  }
  scenes[index] = nextScene

  const target = ctx.project.reel_duration_seconds ?? 30
  const finalScenes = durationChanged ? rebalanceOthersAround(scenes, index, target) : scenes
  return saveStructure(ctx.supabase, ctx.draftId, { ...ctx.structure, scenes: finalScenes })
}

/** Hält die SOEBEN geänderte Szene fest und gleicht nur die übrigen Szenen aus -- sonst würde eine Dauer-Änderung durch den anschließenden Ausgleich sofort wieder überschrieben. */
function rebalanceOthersAround(scenes: ReelTimelineScene[], fixedIndex: number, target: number): ReelTimelineScene[] {
  const fixed = scenes[fixedIndex]
  const others = scenes.filter((_, i) => i !== fixedIndex)
  const othersTarget = target - fixed.duration_seconds
  const rebalancedOthers = rebalanceScenes(others, Math.max(othersTarget, others.length * MIN_SCENE_DURATION_SECONDS))
  const result: ReelTimelineScene[] = []
  let otherIdx = 0
  for (let i = 0; i < scenes.length; i++) {
    if (i === fixedIndex) result.push(fixed)
    else result.push(rebalancedOthers[otherIdx++])
  }
  return result
}

/**
 * §"Einzelne Text-Overlays per GPT-5.6 Terra neu vorschlagen lassen"
 * (Nutzervorgabe, wörtlich): EIN neuer, günstiger Vision-Aufruf für genau das
 * eine Szenenbild (Foto ODER Video-Standbild, nie das Rohvideo) -- dieselbe
 * Grundregel wie in Sprint 3 (lib/actions/reel-storyboard.ts): niemals ohne
 * visuelle Grundlage texten, keine Gesichtsidentifikation.
 */
export async function regenerateReelSceneTextOverlay(projectId: string, index: number): Promise<Result & { textOverlay?: string }> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'Die Content-KI ist aktuell nicht konfiguriert.' }
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  const scene = ctx.structure.scenes[index]
  if (!scene) return { ok: false, error: 'Ungültige Position.' }

  let storagePath: string | null = null
  let mimeType = 'image/webp'
  if (scene.source_type === 'photo') {
    const { data: row } = await ctx.supabase.from('memory_photos').select('storage_path').eq('id', scene.source_id).maybeSingle()
    storagePath = row?.storage_path ?? null
  } else {
    const { data: row } = await ctx.supabase.from('memory_videos').select('thumbnail_storage_path').eq('id', scene.source_id).maybeSingle()
    storagePath = row?.thumbnail_storage_path ?? null
    mimeType = 'image/jpeg'
  }
  if (!storagePath) return { ok: false, error: 'Bild für diese Szene nicht gefunden.' }

  try {
    const { data: signed } = await ctx.supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60)
    if (!signed?.signedUrl) return { ok: false, error: 'Bild konnte nicht geladen werden.' }
    const res = await fetch(signed.signedUrl)
    const buffer = Buffer.from(await res.arrayBuffer())

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const otherTexts = ctx.structure.scenes.filter((_, i) => i !== index).map((s) => s.text_overlay).filter(Boolean)
    const promptText = [
      'Schlage EINEN neuen, kurzen Textoverlay (max. 8 Wörter) für genau dieses eine Bild eines Familienreise-Reels vor.',
      'Analysiere ausschließlich Bildkomposition, Motiv, Aktivität, Licht und Ort. Führe KEINE Gesichtsidentifikation durch und nenne keine Namen/Identitäten.',
      otherTexts.length > 0 ? `Bereits genutzte Texte anderer Szenen (nicht wiederholen): ${otherTexts.join(' / ')}` : null,
      'Erfinde keine Fakten, die im Bild nicht zu sehen sind.',
    ].filter(Boolean).join('\n\n')

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [
        { type: 'input_text', text: promptText },
        { type: 'input_image', image_url: `data:${mimeType};base64,${buffer.toString('base64')}`, detail: 'high' },
      ] }],
      text: { format: { type: 'json_schema', name: 'scene_text_overlay', schema: {
        type: 'object', properties: { text_overlay: { type: 'string' } }, required: ['text_overlay'], additionalProperties: false,
      }, strict: true } },
    })
    const parsed = JSON.parse(response.output_text) as { text_overlay: string }

    const scenes = [...ctx.structure.scenes]
    scenes[index] = { ...scenes[index], text_overlay: parsed.text_overlay.slice(0, 140) }
    const saveResult = await saveStructure(ctx.supabase, ctx.draftId, { ...ctx.structure, scenes })
    return { ...saveResult, textOverlay: parsed.text_overlay }
  } catch {
    return { ok: false, error: 'Der Textvorschlag ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.' }
  }
}

/**
 * §Content Studio 3.0, Sprint 6: "echte, nachweislich lizenzfreie
 * Musik-Presets nur dann ergänzen, wenn die Audiodateien mit klarer
 * Lizenzquelle vorliegen; sonst weiterhin nur eigene Musik oder keine
 * Musik" (Nutzervorgabe, wörtlich) -- es gibt keine solchen verifizierbaren
 * Dateien, daher bewusst nur noch `{source:'none'}` (eigene Musik läuft
 * weiterhin ausschließlich über `uploadReelMusic`). `music_preset_key`
 * bleibt als Feld in `ReelStoryboardStructure` erhalten (Altkompatibilität
 * für ggf. bereits gespeicherte Drafts), wird aber nie mehr neu gesetzt.
 */
export async function updateReelMusicChoice(projectId: string, choice: { source: 'none' }): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }

  // §Vorherige eigene Musikdatei wird beim Wechsel auf "Keine Musik" entfernt -- keine verwaisten Dateien im Storage.
  if (ctx.structure.music_source === 'custom' && ctx.structure.music_storage_path)
    await ctx.supabase.storage.from(STORAGE_BUCKET).remove([ctx.structure.music_storage_path])

  const structure: ReelStoryboardStructure = {
    ...ctx.structure, music_source: choice.source, music_preset_key: null, music_storage_path: null,
  }
  return saveStructure(ctx.supabase, ctx.draftId, structure)
}

export async function createReelMusicUploadSlot(): Promise<UploadSlot | null> {
  const { id: familyId } = await getFamily()
  const slots = await createUploadSlots(familyId, 1)
  return slots[0] ?? null
}

/**
 * §"Eigene private Datei" (Nutzervorgabe): identisches Signed-Upload +
 * `storage.move()`-Muster wie der Videoupload (Sprint 2) -- kein
 * Function-Buffering, Datei bleibt im bereits vorhandenen privaten
 * `documents`-Bucket (kein neuer Bucket/keine neue Migration nötig).
 */
export async function uploadReelMusic(projectId: string, stagingPath: string, mimeType: string): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }

  if (!ALLOWED_MUSIC_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MUSIC_MIME_TYPES)[number])) {
    await ctx.supabase.storage.from(STORAGE_BUCKET).remove([stagingPath])
    return { ok: false, error: 'Nicht unterstütztes Audioformat.' }
  }
  const folder = stagingPath.split('/').slice(0, -1).join('/')
  const fileName = stagingPath.split('/').pop() ?? ''
  const { data: listing } = await ctx.supabase.storage.from(STORAGE_BUCKET).list(folder, { search: fileName })
  const sizeBytes = listing?.find((f) => f.name === fileName)?.metadata?.size ?? null
  if (sizeBytes !== null && sizeBytes > MAX_MUSIC_FILE_SIZE_BYTES) {
    await ctx.supabase.storage.from(STORAGE_BUCKET).remove([stagingPath])
    return { ok: false, error: 'Datei zu groß (max. 15 MB).' }
  }

  if (ctx.structure.music_source === 'custom' && ctx.structure.music_storage_path)
    await ctx.supabase.storage.from(STORAGE_BUCKET).remove([ctx.structure.music_storage_path])

  const extension = MUSIC_EXTENSION_BY_MIME[mimeType] ?? 'mp3'
  const finalPath = `${ctx.familyId}/reel-music/${projectId}/${crypto.randomUUID()}.${extension}`
  const { error: moveError } = await ctx.supabase.storage.from(STORAGE_BUCKET).move(stagingPath, finalPath)
  if (moveError) return { ok: false, error: 'Speicherfehler: ' + moveError.message }

  const structure: ReelStoryboardStructure = {
    ...ctx.structure, music_source: 'custom', music_preset_key: null, music_storage_path: finalPath,
  }
  return saveStructure(ctx.supabase, ctx.draftId, structure)
}

export async function removeReelMusic(projectId: string): Promise<Result> {
  const ctx = await loadOwnedDraftContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }
  if (ctx.structure.music_storage_path) await ctx.supabase.storage.from(STORAGE_BUCKET).remove([ctx.structure.music_storage_path])
  const structure: ReelStoryboardStructure = { ...ctx.structure, music_source: 'none', music_preset_key: null, music_storage_path: null }
  return saveStructure(ctx.supabase, ctx.draftId, structure)
}
