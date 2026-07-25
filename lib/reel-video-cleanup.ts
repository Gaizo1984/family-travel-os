import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type ReelVideoCleanupResult = { deleted: number; skippedInUse: number; failed: number }

/**
 * §"Dateien aus dem Content Studio sollten nicht dauerhaft gespeichert
 * bleiben, solange sie in keinem Reel-Projekt verwendet werden" + "Reel-
 * projekte sollen bis zur manuellen Löschung bestehen bleiben" (Nutzervorgabe,
 * wörtlich): exakt dasselbe gehärtete Muster wie
 * lib/content-session-cleanup.ts::cleanupExpiredContentSessionPhotos
 * (Storage-Datei zuerst, DB-Zeile nur bei Erfolg) -- mit einer zusätzlichen
 * Sicherung: ein abgelaufenes Video, das noch in einem `content_reel_media_items`
 * eingetragen ist (also aktiv in einem Reel-Projekt ausgewählt), wird NIE
 * automatisch gelöscht, egal wie lange die Frist schon überschritten ist --
 * es bleibt einfach im nächsten Lauf erneut ein Kandidat, sobald es aus dem
 * Projekt entfernt wurde. `retained_as_memory` (analog zu memory_photos)
 * bleibt als Reserve für eine spätere "dauerhaft behalten"-Aktion, wird
 * aktuell aber von keinem Aufrufer gesetzt.
 */
export async function cleanupExpiredReelVideos(): Promise<ReelVideoCleanupResult> {
  const supabase = createServiceRoleClient()

  const { data: expiredRaw } = await supabase
    .from('memory_videos')
    .select('id, storage_path, thumbnail_storage_path')
    .eq('temporary', true)
    .eq('retained_as_memory', false)
    .lt('expires_at', new Date().toISOString())

  const expired = expiredRaw ?? []
  let deleted = 0
  let skippedInUse = 0
  let failed = 0

  for (const video of expired) {
    const { count } = await supabase
      .from('content_reel_media_items')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', 'video')
      .eq('source_id', video.id)
    if ((count ?? 0) > 0) {
      skippedInUse++
      continue
    }

    const pathsToRemove = [video.storage_path, video.thumbnail_storage_path].filter((p): p is string => Boolean(p))
    const { error: storageError } = await supabase.storage.from('documents').remove(pathsToRemove)
    if (storageError) {
      console.error('[reel-video-cleanup] storage delete failed', { videoId: video.id })
      failed++
      continue
    }
    const { error: dbError } = await supabase.from('memory_videos').delete().eq('id', video.id)
    if (dbError) {
      console.error('[reel-video-cleanup] db delete failed', { videoId: video.id })
      failed++
      continue
    }
    deleted++
  }

  return { deleted, skippedInUse, failed }
}
