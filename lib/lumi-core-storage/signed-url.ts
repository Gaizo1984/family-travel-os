import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

/**
 * Lumi-Core-Äquivalent zu lib/signed-storage-url.ts. Bewusst OHNE eigene
 * Cache-Tabelle (siehe README in diesem Ordner) -- direkte Signierung pro
 * Aufruf, bis die Fachdaten (inkl. einer household-gescopten
 * signed_url_cache-Entsprechung) ebenfalls nach Lumi Core migriert sind.
 * Gleiche Gültigkeitsdauer wie das Travel-Original, damit sich am
 * Nutzungsverhalten beim späteren Umstellen nichts ändert.
 */
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 // 24h

export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.storage.from(bucket).createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('[lumi-core-storage/signed-url] Signierung fehlgeschlagen', { bucket, path, error: error?.message })
    return null
  }
  return data.signedUrl
}

export async function getSignedUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (paths.length === 0) return result
  const resolved = await Promise.all(paths.map(async (path) => [path, await getSignedUrl(bucket, path)] as const))
  for (const [path, url] of resolved) if (url) result.set(path, url)
  return result
}
