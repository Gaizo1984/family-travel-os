import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'

/**
 * §"Egress-Analyse 2026-07-16": `createSignedUrl` erzeugte bisher an ~30
 * Stellen im Projekt bei JEDEM Render ein frisches Token -- die resultierende
 * Bild-URL änderte sich dadurch bei jedem Seitenaufruf, wodurch der Browser
 * dasselbe Foto NIE aus dem Cache laden konnte (Hauptursache für einen
 * Egress-zu-Storage-Multiplikator von ~53x: 5,236 GB Egress bei nur 99 MB
 * Storage). Diese Datei ist die EINZIGE Stelle im Projekt, die Signed URLs
 * erzeugt -- sie cached das Ergebnis serverseitig in `signed_url_cache`
 * (family-gescoped, RLS wie alle anderen Tabellen), damit dieselbe Bild-URL
 * über ihre Gültigkeitsdauer hinweg stabil bleibt und der Browser sie normal
 * per HTTP-Cache wiederverwenden kann.
 *
 * Der Supabase-Token selbst ist deutlich länger gültig
 * (`SIGNED_URL_EXPIRY_SECONDS`) als das Wiederverwendungsfenster
 * (`REUSE_MARGIN_SECONDS` Sicherheitsabstand vor dem tatsächlichen Ablauf),
 * damit nie eine bereits abgelaufene URL aus dem Cache ausgeliefert wird.
 *
 * §"Bei Fehlern immer auf das Original zurückfallen" (Nutzervorgabe, gilt
 * hier analog): schlägt der Cache-Lese-/Schreibzugriff fehl (z. B. Migration
 * noch nicht angewendet), wird einfach direkt signiert -- ein Foto darf nie
 * an einem Cache-Problem scheitern.
 */
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 // 24h Token-Gültigkeit
const REUSE_MARGIN_SECONDS = 60 * 60 * 4 // Wiederverwendung stoppt 4h vor tatsächlichem Ablauf

type CacheRow = { signed_url: string; expires_at: string }

function isStillFresh(row: CacheRow): boolean {
  return new Date(row.expires_at).getTime() - Date.now() > REUSE_MARGIN_SECONDS * 1000
}

async function signFresh(bucket: string, path: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('[signed-storage-url] Signierung fehlgeschlagen', { bucket, path, error: error?.message })
    return null
  }
  return data.signedUrl
}

function scheduleCacheWrite(familyId: string, entries: Array<{ bucket: string; path: string; url: string }>): void {
  if (entries.length === 0) return
  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString()
  // §"Läuft im Hintergrund nach der Antwort" (etabliertes Muster, siehe
  // lib/actions/memories.ts): verzögert die Antwort nicht um einen
  // zusätzlichen Schreib-Roundtrip, aber Vercel garantiert die Ausführung
  // trotzdem (anders als ein unbeaufsichtigtes "fire and forget").
  after(async () => {
    const supabase = await createClient()
    const { error } = await supabase.from('signed_url_cache').upsert(
      entries.map((e) => ({ family_id: familyId, bucket: e.bucket, storage_path: e.path, signed_url: e.url, expires_at: expiresAt })),
      { onConflict: 'family_id,bucket,storage_path' },
    )
    if (error) console.error('[signed-storage-url] Cache-Schreibfehler', error.message)
  })
}

/** Nur ein Cache-Lesezugriff, KEINE frische Signierung -- nutzt `lib/photo-thumbnails.ts`, um festzustellen, ob ein Thumbnail bereits existiert, ohne einen zusätzlichen Storage-Aufruf zu brauchen. */
export async function getCachedSignedUrlIfPresent(bucket: string, path: string): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { id: familyId } = await getFamily()
    const { data } = await supabase
      .from('signed_url_cache')
      .select('signed_url, expires_at')
      .eq('family_id', familyId)
      .eq('bucket', bucket)
      .eq('storage_path', path)
      .maybeSingle()
    if (data && isStillFresh(data)) return data.signed_url
    return null
  } catch {
    return null
  }
}

/** Liefert eine über ihre Gültigkeitsdauer stabile Signed URL für einen Storage-Pfad -- aus dem Cache, wenn vorhanden und noch frisch genug, sonst frisch signiert (und für nächste Aufrufe gecacht). */
export async function getCachedSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { id: familyId } = await getFamily()

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('signed_url_cache')
      .select('signed_url, expires_at')
      .eq('family_id', familyId)
      .eq('bucket', bucket)
      .eq('storage_path', path)
      .maybeSingle()
    if (data && isStillFresh(data)) return data.signed_url
  } catch (e) {
    console.error('[signed-storage-url] Cache-Lesefehler, signiere direkt', e)
  }

  const url = await signFresh(bucket, path)
  if (url) scheduleCacheWrite(familyId, [{ bucket, path, url }])
  return url
}

/** Batch-Variante für Listen (Galerie/Memories/Yearbook) -- ein Cache-Read für alle Pfade, parallele Neusignierung nur für fehlende/fast abgelaufene. */
export async function getCachedSignedUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()
  const { id: familyId } = await getFamily()
  const result = new Map<string, string>()
  const needsFresh: string[] = [...paths]

  try {
    const supabase = await createClient()
    const { data: cachedRows } = await supabase
      .from('signed_url_cache')
      .select('storage_path, signed_url, expires_at')
      .eq('family_id', familyId)
      .eq('bucket', bucket)
      .in('storage_path', paths)
    for (const row of cachedRows ?? []) {
      if (!isStillFresh(row)) continue
      result.set(row.storage_path, row.signed_url)
      const idx = needsFresh.indexOf(row.storage_path)
      if (idx !== -1) needsFresh.splice(idx, 1)
    }
  } catch (e) {
    console.error('[signed-storage-url] Batch-Cache-Lesefehler, signiere alle direkt', e)
  }

  if (needsFresh.length > 0) {
    const freshEntries = await Promise.all(needsFresh.map(async (path) => ({ path, url: await signFresh(bucket, path) })))
    const valid = freshEntries.filter((e): e is { path: string; url: string } => e.url !== null)
    for (const e of valid) result.set(e.path, e.url)
    scheduleCacheWrite(familyId, valid.map((e) => ({ bucket, path: e.path, url: e.url })))
  }

  return result
}

/** §Root-Cause-Fix "Broken Image" (siehe components/SignedPhoto.tsx): erzwingt eine NEUE Signatur (überspringt den Cache-Read) und überschreibt den Cache-Eintrag -- für den Fall, dass die zwischengespeicherte URL selbst kaputt/abgelaufen ist. */
export async function forceRefreshSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { id: familyId } = await getFamily()
  const url = await signFresh(bucket, path)
  if (url) scheduleCacheWrite(familyId, [{ bucket, path, url }])
  return url
}
