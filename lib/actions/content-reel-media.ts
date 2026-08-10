'use server'

import { redirect } from 'next/navigation'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'
import { createUploadSlots, type UploadSlot } from '@/lib/actions/photo-staging'
import { parseStagedPaths } from '@/lib/staged-paths'
import {
  reelMediaLimitFor, MAX_REEL_VIDEO_FILE_SIZE_BYTES,
  ALLOWED_REEL_VIDEO_MIME_TYPES, REEL_VIDEO_EXTENSION_BY_MIME,
} from '@/lib/reel-media-limits'
import { rebalanceScenes } from '@/lib/reel-scene-rebalance'
import type { ReelStoryboardStructure } from '@/lib/reel-storyboard-types'

/**
 * §Content Studio 3.0, Sprint 2 -- Medienauswahl für ein Reel-Projekt.
 * Ausschließlich Auswahl vorhandener `memory_photos`/`memory_videos` plus
 * optionaler Video-Upload (nur wenn die Reise noch KEINE `memory_videos`
 * hat, siehe `uploadReelVideos`) -- keine KI-Analyse, kein Storyboard.
 */

const STORAGE_BUCKET = 'travel-documents'

async function loadOwnedReelProject(lumiCore: Awaited<ReturnType<typeof createLumiCoreClient>>, projectId: string, familyId: string) {
  const { data: project } = await lumiCore
    .from('travel_content_projects')
    .select('id, household_id, trip_id, project_type, reel_duration_seconds')
    .eq('id', projectId)
    .eq('household_id', familyId)
    .eq('project_type', 'reel')
    .maybeSingle()
  return project
}

/** §"Direkt-Upload per Signed URL, kein Function-Buffering großer Dateien" (Nutzervorgabe): identischer Mechanismus wie Foto-Uploads (lib/actions/photo-staging.ts), hier nur für Video-Dateien wiederverwendet -- der Browser lädt direkt zu Supabase Storage hoch, nie über den Server-Action-Request-Body. */
export async function createReelVideoUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

/**
 * §"Clip-Länge begrenzen, Dateitypen und Dateigröße prüfen" (Nutzervorgabe):
 * Dauer wird ausschließlich clientseitig geprüft (components/
 * DirectVideoUploadForm.tsx) -- eine serverseitige Prüfung würde die Datei
 * laden müssen, was genau das verbotene Function-Buffering wäre. Typ und
 * Größe werden HIER zusätzlich serverseitig über die Storage-Metadaten
 * geprüft (kein Byte-Download nötig, nur `list()`), da eine clientseitige
 * Prüfung allein umgehbar wäre.
 *
 * §"Nur, wenn noch keine passenden memory_videos vorhanden sind"
 * (Nutzervorgabe): wird serverseitig NICHT hart erzwungen (der Button ist
 * im UI bereits ausgeblendet, sobald die Reise Videos hat) -- ein Zweit-
 * Check hier würde eine legitime Nachbesserung (z. B. ein zusätzliches
 * Video für eine andere Etappe) unnötig blockieren.
 *
 * §"AWS-Zwischendatei"-Lehre aus Sprint 0b/2 (Nutzervorgabe, analog):
 * Übernahme per `storage.move()` -- Datei bewegt sich innerhalb des Buckets,
 * nie durch den Node-Prozess.
 */
export async function uploadReelVideos(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const stagedPaths = parseStagedPaths(formData.get('uploaded_paths'))
  let mimeTypes: string[] = []
  try {
    const parsed = JSON.parse(String(formData.get('uploaded_mime_types') ?? '[]'))
    if (Array.isArray(parsed) && parsed.every((m) => typeof m === 'string')) mimeTypes = parsed
  } catch {
    mimeTypes = []
  }
  /** §Für Sprint 3 (KI-Storyboard) nötig: reale Cliplänge, nie erfunden -- clientseitig per <video>.duration ermittelt (DirectVideoUploadForm.tsx), hier nur übernommen, keine erneute Messung serverseitig (würde die Datei laden). */
  let durations: (number | null)[] = []
  try {
    const parsed = JSON.parse(String(formData.get('uploaded_durations') ?? '[]'))
    if (Array.isArray(parsed) && parsed.every((d) => d === null || typeof d === 'number')) durations = parsed
  } catch {
    durations = []
  }

  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(lumiCore, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')

  if (stagedPaths.length === 0) redirect(`${returnTo}?error=${encodeURIComponent('Kein Video hochgeladen.')}`)

  let savedCount = 0
  let rejectedCount = 0

  for (let i = 0; i < stagedPaths.length; i++) {
    const stagingPath = stagedPaths[i]
    const mimeType = mimeTypes[i] ?? ''

    if (!ALLOWED_REEL_VIDEO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_REEL_VIDEO_MIME_TYPES)[number])) {
      await lumiCore.storage.from(STORAGE_BUCKET).remove([stagingPath])
      rejectedCount++
      continue
    }

    // §Dateigröße ohne Byte-Download prüfen: list() liefert nur Metadaten.
    const folder = stagingPath.split('/').slice(0, -1).join('/')
    const fileName = stagingPath.split('/').pop() ?? ''
    const { data: listing } = await lumiCore.storage.from(STORAGE_BUCKET).list(folder, { search: fileName })
    const sizeBytes = listing?.find((f) => f.name === fileName)?.metadata?.size ?? null
    if (sizeBytes !== null && sizeBytes > MAX_REEL_VIDEO_FILE_SIZE_BYTES) {
      await lumiCore.storage.from(STORAGE_BUCKET).remove([stagingPath])
      rejectedCount++
      continue
    }

    const extension = REEL_VIDEO_EXTENSION_BY_MIME[mimeType] ?? 'mp4'
    const finalPath = `${familyId}/${crypto.randomUUID()}.${extension}`

    const { error: moveError } = await lumiCore.storage.from(STORAGE_BUCKET).move(stagingPath, finalPath)
    if (moveError) {
      console.error('[content-reel-media] Storage-Move fehlgeschlagen:', moveError.message)
      rejectedCount++
      continue
    }

    // §"Dateien aus dem Content Studio sollten nicht dauerhaft gespeichert
    // bleiben" (Nutzervorgabe, wörtlich): 48h-Frist ab Upload -- läuft nur
    // ab, wenn das Video zu diesem Zeitpunkt in KEINEM Reel-Projekt mehr
    // ausgewählt ist (siehe lib/reel-video-cleanup.ts). Manuelles, früheres
    // Löschen bleibt jederzeit möglich (lib/actions/content-reel-media.ts::deleteReelVideo).
    //
    // FINALER CUTOVER, Schema-Luecken-Schliessung: travel_memory_videos hat
    // jetzt temporary/expires_at/retained_as_memory -- Insert läuft wieder
    // vollständig über Lumi Core.
    const REEL_VIDEO_TTL_HOURS = 48
    const { error: insertError } = await lumiCore.from('travel_memory_videos').insert({
      household_id: familyId,
      trip_id: project.trip_id,
      storage_path: finalPath,
      duration_seconds: durations[i] ?? null,
      temporary: true,
      expires_at: new Date(Date.now() + REEL_VIDEO_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    })
    if (insertError) {
      console.error('[content-reel-media] DB-Insert fehlgeschlagen:', insertError.message)
      rejectedCount++
      continue
    }
    savedCount++
  }

  const params = new URLSearchParams()
  if (savedCount > 0) params.set('uploaded', String(savedCount))
  if (rejectedCount > 0) params.set('error', `${rejectedCount} Video(s) konnten nicht gespeichert werden (Format/Größe).`)
  redirect(`${returnTo}${params.toString() ? `?${params.toString()}` : ''}`)
}

/** §"Ausgewählte Medien in content_reel_media_items speichern" + Mindest-/Maximalanzahl je Dauer-Preset (Nutzervorgabe). */
export async function addReelMediaItem(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const sourceType = String(formData.get('source_type') ?? '')
  const sourceId = String(formData.get('source_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(lumiCore, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')
  if (sourceType !== 'photo' && sourceType !== 'video') redirect(returnTo)

  const { count } = await lumiCore
    .from('travel_content_reel_media_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const limit = reelMediaLimitFor(project.reel_duration_seconds ?? 30)
  if ((count ?? 0) >= limit.max) {
    redirect(`${returnTo}?error=${encodeURIComponent(`Maximal ${limit.max} Medien für ${project.reel_duration_seconds}s-Reels.`)}`)
  }

  await lumiCore.from('travel_content_reel_media_items').insert({
    project_id: projectId, source_type: sourceType, source_id: sourceId, sort_order: count ?? 0,
  })

  redirect(returnTo)
}

export async function removeReelMediaItem(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(lumiCore, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')

  await lumiCore.from('travel_content_reel_media_items').delete().eq('id', itemId).eq('project_id', projectId)

  redirect(returnTo)
}

/** §Content Studio 3.0, Sprint 3: Posterframe-Upload für ein Video, das noch keins hat -- gleiches Signed-Upload-Muster wie der Videoupload selbst. */
export async function createReelThumbnailUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

/**
 * §"Bei Videos nur ein Standbild/Posterframe analysieren, niemals das
 * Rohvideo an OpenAI senden" (Nutzervorgabe): das Standbild wird clientseitig
 * per <video>+<canvas> aus dem Video selbst erzeugt (components/
 * GenerateReelStoryboardButton.tsx) -- hier nur per `storage.move()`
 * übernommen (kein Function-Buffering) und in memory_videos.thumbnail_storage_path
 * hinterlegt, damit spätere Storyboard-Läufe (und künftig auch andere
 * Ansichten) es wiederverwenden können, statt es bei jedem Lauf neu zu erzeugen.
 */
export async function saveReelVideoThumbnail(formData: FormData): Promise<{ ok: boolean }> {
  const videoId = String(formData.get('video_id') ?? '')
  const stagingPath = String(formData.get('staging_path') ?? '')
  if (!videoId || !stagingPath) return { ok: false }

  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()

  const { data: video } = await lumiCore.from('travel_memory_videos').select('id, household_id').eq('id', videoId).eq('household_id', familyId).maybeSingle()
  if (!video) return { ok: false }

  const finalPath = `${familyId}/thumb-${crypto.randomUUID()}.jpg`
  const { error: moveError } = await lumiCore.storage.from(STORAGE_BUCKET).move(stagingPath, finalPath)
  if (moveError) return { ok: false }

  const { error: updateError } = await lumiCore.from('travel_memory_videos').update({ thumbnail_storage_path: finalPath }).eq('id', videoId)
  return { ok: !updateError }
}

/**
 * §"Das Hochgeladene Video würde ich zudem gerne löschen" + "Videos aus dem
 * Content Studio sollten nicht dauerhaft gespeichert bleiben" (Nutzervorgabe,
 * wörtlich): manuelles, sofortiges Löschen -- unabhängig von der 48h-Frist
 * (lib/reel-video-cleanup.ts). Anders als der automatische Cleanup (der ein
 * noch verwendetes Video NIE anfasst) entfernt diese Aktion das Video
 * BEWUSST auch aus jedem Storyboard, das es referenziert (Szene raus +
 * Dauer-Ausgleich, exakt das Muster von removeReelTimelineScene) -- der
 * Nutzer trifft die Entscheidung hier aktiv selbst, die Reel-PROJEKTE bleiben
 * dabei erhalten (nur die eine Szene fällt weg), wie gefordert.
 */
export async function deleteReelVideo(videoId: string, returnTo: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()

  const { data: video } = await lumiCore
    .from('travel_memory_videos')
    .select('id, household_id, trip_id, storage_path, thumbnail_storage_path')
    .eq('id', videoId).eq('household_id', familyId).maybeSingle()
  if (!video) redirect(`${returnTo}?error=${encodeURIComponent('Video nicht gefunden.')}`)

  // §Storyboards derselben Reise durchsuchen (ein Video kann in mehreren Reel-Projekten ausgewählt sein).
  const { data: reelProjects } = video.trip_id
    ? await lumiCore.from('travel_content_projects').select('id').eq('trip_id', video.trip_id).eq('project_type', 'reel')
    : { data: [] as { id: string }[] }
  const projectIds = (reelProjects ?? []).map((p) => p.id)

  if (projectIds.length > 0) {
    const { data: drafts } = await lumiCore
      .from('travel_content_drafts')
      .select('id, structure')
      .eq('draft_type', 'video_reel')
      .in('project_id', projectIds)

    for (const draft of drafts ?? []) {
      const structure = draft.structure as unknown as ReelStoryboardStructure
      const idx = structure.scenes.findIndex((s) => s.source_type === 'video' && s.source_id === videoId)
      if (idx === -1) continue

      const previousScenes = structure.scenes.map((s) => ({ ...s }))
      const remainingScenes = structure.scenes.filter((_, i) => i !== idx)
      const target = structure.reel_duration_seconds ?? 30
      const newStructure: ReelStoryboardStructure = {
        ...structure, scenes: rebalanceScenes(remainingScenes, target), _previous_scenes: previousScenes,
      }
      await lumiCore.from('travel_content_drafts').update({ structure: newStructure }).eq('id', draft.id)
    }
  }

  await lumiCore.from('travel_content_reel_media_items').delete().eq('source_type', 'video').eq('source_id', videoId)

  const pathsToRemove = [video.storage_path, video.thumbnail_storage_path].filter((p): p is string => Boolean(p))
  const { error: removeError } = await lumiCore.storage.from(STORAGE_BUCKET).remove(pathsToRemove)
  if (removeError) redirect(`${returnTo}?error=${encodeURIComponent('Storage-Datei konnte nicht gelöscht werden.')}`)

  const { error: deleteError } = await lumiCore.from('travel_memory_videos').delete().eq('id', videoId)
  if (deleteError) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler beim Löschen.')}`)

  redirect(returnTo)
}

/** §"Reihenfolge änderbar" (Nutzervorgabe): identisches Swap-Muster wie `reorderMemoryPhoto` (lib/actions/memories.ts). */
export async function reorderReelMediaItem(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const direction = String(formData.get('direction') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(lumiCore, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')

  const { data: itemsRaw } = await lumiCore
    .from('travel_content_reel_media_items')
    .select('id, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  const items = itemsRaw ?? []

  const index = items.findIndex((it) => it.id === itemId)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= items.length) redirect(returnTo)

  const reordered = [...items]
  ;[reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]]

  await Promise.all(reordered.map((it, i) => lumiCore.from('travel_content_reel_media_items').update({ sort_order: i }).eq('id', it.id)))

  redirect(returnTo)
}
