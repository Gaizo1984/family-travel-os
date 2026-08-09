import { getSignedUrl as getLumiCoreSignedUrl, getSignedUrls as getLumiCoreSignedUrls } from '@/lib/lumi-core-storage/signed-url'

/**
 * FINALER CUTOVER: delegiert vollständig an lib/lumi-core-storage/signed-url.ts
 * (Lumi-Core-Bucket, gleiche 24h-Gültigkeit). Die bisherige familiengescopte
 * `signed_url_cache`-Tabelle entfällt -- direkte Signierung pro Aufruf, bis
 * eine Lumi-Core-Cache-Entsprechung existiert (siehe CACHE_REGENERATION.md).
 * Öffentliche Funktionssignaturen unverändert, damit kein Aufrufer angepasst
 * werden muss.
 */
export async function getCachedSignedUrlIfPresent(bucket: string, path: string): Promise<string | null> {
  return getLumiCoreSignedUrl(bucket, path)
}

export async function getCachedSignedUrl(bucket: string, path: string): Promise<string | null> {
  return getLumiCoreSignedUrl(bucket, path)
}

export async function getCachedSignedUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  return getLumiCoreSignedUrls(bucket, paths)
}

export async function forceRefreshSignedUrl(bucket: string, path: string): Promise<string | null> {
  return getLumiCoreSignedUrl(bucket, path)
}
