import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type ContentSessionCleanupResult = { deleted: number; failed: number }

/**
 * §"Cleanup darf nur temporäre, abgelaufene Bilder löschen -- dauerhafte
 * memory_photos niemals automatisch löschen": Query ist bewusst eng
 * (temporary=true, retained_as_memory=false, expires_at < now()) --
 * memory_photos wird von dieser Funktion nie berührt, auch nicht indirekt
 * (kein Cascade/Trigger darauf). Gehärtetes Löschmuster: Storage-Datei
 * zuerst, DB-Zeile nur bei Erfolg. Ein Fehlschlag bei einem Foto bricht die
 * übrigen nicht ab. Content-Entwürfe (content_drafts) werden nie angefasst
 * -- sie referenzieren Fotos nur lose über Foto-ID im JSON, kein
 * Foreign-Key-Zwang, bleiben also unabhängig von dieser Löschung bestehen.
 * Aufgerufen sowohl vom Vercel-Cron (app/api/cron/cleanup-content-sessions)
 * als auch als Best-Effort-Fallback beim Öffnen von /content-studio.
 */
export async function cleanupExpiredContentSessionPhotos(): Promise<ContentSessionCleanupResult> {
  const supabase = createServiceRoleClient()

  const { data: expiredRaw } = await supabase
    .from('content_project_photos')
    .select('id, project_id, storage_path')
    .eq('temporary', true)
    .eq('retained_as_memory', false)
    .lt('expires_at', new Date().toISOString())

  const expired = expiredRaw ?? []
  let deleted = 0
  let failed = 0
  const touchedProjectIds = new Set<string>()

  for (const photo of expired) {
    const { error: storageError } = await supabase.storage.from('documents').remove([photo.storage_path])
    if (storageError) {
      // Nur Foto-/Projekt-ID und Fehlercode loggen -- keine Bild-URLs/Base64/personenbezogenen Inhalte.
      console.error('[content-session-cleanup] storage delete failed', { photoId: photo.id, projectId: photo.project_id })
      failed++
      continue
    }
    const { error: dbError } = await supabase.from('content_project_photos').delete().eq('id', photo.id)
    if (dbError) {
      console.error('[content-session-cleanup] db delete failed', { photoId: photo.id, projectId: photo.project_id })
      failed++
      continue
    }
    touchedProjectIds.add(photo.project_id)
    deleted++
  }

  // Sessions, deren temporäre Fotos jetzt vollständig weg sind, als 'images_deleted' markieren.
  for (const projectId of touchedProjectIds) {
    const { count } = await supabase
      .from('content_project_photos').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('temporary', true)
    if ((count ?? 0) === 0) {
      await supabase.from('content_projects').update({ status: 'images_deleted' }).eq('id', projectId)
    }
  }

  return { deleted, failed }
}
