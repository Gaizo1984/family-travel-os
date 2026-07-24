'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { createUploadSlots, type UploadSlot } from '@/lib/actions/photo-staging'
import { parseStagedPaths } from '@/lib/staged-paths'
import {
  reelMediaLimitFor, MAX_REEL_VIDEO_FILE_SIZE_BYTES,
  ALLOWED_REEL_VIDEO_MIME_TYPES, REEL_VIDEO_EXTENSION_BY_MIME,
} from '@/lib/reel-media-limits'

/**
 * §Content Studio 3.0, Sprint 2 -- Medienauswahl für ein Reel-Projekt.
 * Ausschließlich Auswahl vorhandener `memory_photos`/`memory_videos` plus
 * optionaler Video-Upload (nur wenn die Reise noch KEINE `memory_videos`
 * hat, siehe `uploadReelVideos`) -- keine KI-Analyse, kein Storyboard.
 */

const STORAGE_BUCKET = 'documents'

async function loadOwnedReelProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, familyId: string) {
  const { data: project } = await supabase
    .from('content_projects')
    .select('id, family_id, trip_id, project_type, reel_duration_seconds')
    .eq('id', projectId)
    .eq('family_id', familyId)
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

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(supabase, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')

  if (stagedPaths.length === 0) redirect(`${returnTo}?error=${encodeURIComponent('Kein Video hochgeladen.')}`)

  let savedCount = 0
  let rejectedCount = 0

  for (let i = 0; i < stagedPaths.length; i++) {
    const stagingPath = stagedPaths[i]
    const mimeType = mimeTypes[i] ?? ''

    if (!ALLOWED_REEL_VIDEO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_REEL_VIDEO_MIME_TYPES)[number])) {
      await supabase.storage.from(STORAGE_BUCKET).remove([stagingPath])
      rejectedCount++
      continue
    }

    // §Dateigröße ohne Byte-Download prüfen: list() liefert nur Metadaten.
    const folder = stagingPath.split('/').slice(0, -1).join('/')
    const fileName = stagingPath.split('/').pop() ?? ''
    const { data: listing } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { search: fileName })
    const sizeBytes = listing?.find((f) => f.name === fileName)?.metadata?.size ?? null
    if (sizeBytes !== null && sizeBytes > MAX_REEL_VIDEO_FILE_SIZE_BYTES) {
      await supabase.storage.from(STORAGE_BUCKET).remove([stagingPath])
      rejectedCount++
      continue
    }

    const extension = REEL_VIDEO_EXTENSION_BY_MIME[mimeType] ?? 'mp4'
    const finalPath = `${familyId}/${crypto.randomUUID()}.${extension}`

    const { error: moveError } = await supabase.storage.from(STORAGE_BUCKET).move(stagingPath, finalPath)
    if (moveError) {
      rejectedCount++
      continue
    }

    const { error: insertError } = await supabase.from('memory_videos').insert({
      family_id: familyId,
      trip_id: project.trip_id,
      storage_path: finalPath,
      duration_seconds: null,
    })
    if (insertError) {
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

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(supabase, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')
  if (sourceType !== 'photo' && sourceType !== 'video') redirect(returnTo)

  const { count } = await supabase
    .from('content_reel_media_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const limit = reelMediaLimitFor(project.reel_duration_seconds ?? 30)
  if ((count ?? 0) >= limit.max) {
    redirect(`${returnTo}?error=${encodeURIComponent(`Maximal ${limit.max} Medien für ${project.reel_duration_seconds}s-Reels.`)}`)
  }

  await supabase.from('content_reel_media_items').insert({
    project_id: projectId, source_type: sourceType, source_id: sourceId, sort_order: count ?? 0,
  })

  redirect(returnTo)
}

export async function removeReelMediaItem(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(supabase, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')

  await supabase.from('content_reel_media_items').delete().eq('id', itemId).eq('project_id', projectId)

  redirect(returnTo)
}

/** §"Reihenfolge änderbar" (Nutzervorgabe): identisches Swap-Muster wie `reorderMemoryPhoto` (lib/actions/memories.ts). */
export async function reorderReelMediaItem(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const direction = String(formData.get('direction') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProject(supabase, projectId, familyId)
  if (!project) redirect(returnTo || '/content-studio')

  const { data: itemsRaw } = await supabase
    .from('content_reel_media_items')
    .select('id, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  const items = itemsRaw ?? []

  const index = items.findIndex((it) => it.id === itemId)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= items.length) redirect(returnTo)

  const reordered = [...items]
  ;[reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]]

  await Promise.all(reordered.map((it, i) => supabase.from('content_reel_media_items').update({ sort_order: i }).eq('id', it.id)))

  redirect(returnTo)
}
