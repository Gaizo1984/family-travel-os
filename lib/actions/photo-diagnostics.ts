'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * TEMPORÄR (Sprint 1.2 — Diagnose des gemeldeten "Broken Image"-Bugs bei
 * Travel Memory, konnte im Code/live nicht reproduziert werden). Generischer
 * Signed-URL-Refresh für jeden storage_path im 'documents'-Bucket — wird von
 * jeder Bild-Renderstelle über components/SignedPhoto.tsx genutzt, nicht nur
 * Travel Memory, damit überall dieselbe Retry-Logik greift.
 */
export async function refreshSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? null
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
