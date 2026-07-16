'use server'

import { forceRefreshSignedUrl } from '@/lib/signed-storage-url'

/**
 * Generischer Signed-URL-Refresh für jeden storage_path im
 * 'documents'-Bucket — wird von jeder Bild-Renderstelle über
 * components/SignedPhoto.tsx genutzt, nicht nur Travel Memory, damit überall
 * dieselbe Retry-Logik greift. `storagePath` kann ein Original- ODER ein
 * Thumbnail-Pfad sein (siehe lib/photo-thumbnails.ts) -- erzwingt in beiden
 * Fällen eine frische Signatur für exakt diesen Pfad und überschreibt den
 * ggf. selbst kaputten/abgelaufenen Cache-Eintrag.
 */
export async function refreshSignedUrl(storagePath: string): Promise<string | null> {
  return forceRefreshSignedUrl('documents', storagePath)
}

/**
 * TEMPORÄR (Sprint 1.2 — Diagnose): loggt Bild-Lade-/Renderfehler serverseitig
 * (Vercel-Logs), damit sie auch ohne geöffnete Browser-Konsole sichtbar sind.
 * Sollte entfernt werden, sobald die tatsächliche Ursache des gemeldeten Bugs
 * gefunden (oder ausgeschlossen) ist.
 */
export async function logPhotoDiagnostic(payload: {
  storagePath: string | null
  url: string
  phase: 'render' | 'load'
  httpStatus: string | null
  retried: boolean
}): Promise<void> {
  console.error('[PhotoDiagnostic]', JSON.stringify(payload))
}
