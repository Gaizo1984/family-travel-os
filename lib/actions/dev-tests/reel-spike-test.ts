'use server'

import path from 'node:path'
import { existsSync } from 'node:fs'
import { redirect } from 'next/navigation'
import { addBundleToSandbox, createSandbox, renderMediaOnVercel } from '@remotion/vercel'
import type { VercelSandbox } from '@remotion/vercel'
import { getFamily } from '@/lib/family'
import { createClient } from '@/lib/supabase/server'
import { recordTestRun } from '@/lib/dev-test-runs'
import type { Json } from '@/lib/supabase/types'

/**
 * §Content Studio 3.0, Sprint 0b -- isolierter Infrastruktur-Spike: beweist
 * die Kette Bundle -> Vercel Sandbox -> Render -> Rückgabe an Supabase
 * Storage, mit zwei synthetischen Testbildern (siehe remotion/), OHNE
 * echte Familienfotos, ohne Storyboard/Content-Studio-UI, ohne neue
 * Nutzertabellen.
 *
 * §Bugfix-Vorwissen aus der Remotion-Doku: `bundle()` darf NICHT innerhalb
 * einer Serverless Function laufen -- deshalb wird hier NICHT gebundelt,
 * sondern ausschließlich das beim Build per "postbuild"-Skript vorab
 * erzeugte Bundle (`remotion/.output/`, siehe next.config.ts
 * outputFileTracingIncludes) in die Sandbox kopiert.
 *
 * §"Keinen Vercel Blob Store dauerhaft verwenden" (Nutzervorgabe): die
 * Sandbox schreibt die Ausgabedatei nur ins Sandbox-eigene Dateisystem
 * (`renderMediaOnVercel` ohne `vercelBlob`/`detached`-Optionen) -- wir lesen
 * die Bytes direkt per `sandbox.readFileToBuffer()` aus und laden sie selbst
 * nach Supabase Storage hoch. Kein Vercel-Blob-Aufruf an irgendeiner Stelle.
 *
 * §"Keine Base64-Medien und keine Secrets loggen": `console.error`/das in
 * `dev_test_runs` gespeicherte Ergebnis enthalten ausschließlich Zahlen,
 * Zeitstempel und den Storage-PFAD (nicht die signierte URL selbst, die wird
 * erst beim Seitenaufruf frisch erzeugt, siehe ReelSpikeTestCard.tsx).
 */

const COMPOSITION_ID = 'ReelSpike'
const BUNDLE_DIR = path.join(process.cwd(), 'remotion', '.output')
const STORAGE_BUCKET = 'content-reels-spike'
/** §"Renderauftrag mit Timeout versehen" (Nutzervorgabe): Sicherheitsnetz je Einzelschritt, unabhängig vom Sandbox-eigenen Timeout. */
const STEP_TIMEOUT_MS = 4 * 60 * 1000

export type ReelSpikeTestResult = {
  bundleDirFound: boolean
  sandboxSetupMs: number
  addBundleMs: number
  renderMs: number
  readFileMs: number
  uploadMs: number
  totalMs: number
  activeCpuUsageMs: number | null
  vcpus: number | null
  memoryMb: number | null
  region: string | null
  persistent: boolean | null
  fileSizeBytes: number
  contentType: string
  storagePath: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: Zeitüberschreitung nach ${Math.round(ms / 1000)}s`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function runReelSpikeTest() {
  const family = await getFamily()

  if (!existsSync(BUNDLE_DIR)) {
    await recordTestRun('reel_spike', {
      success: false,
      errorMessage: 'Kein Remotion-Bundle gefunden (remotion/.output fehlt) -- läuft das "postbuild"-Skript beim Deploy?',
    })
    redirect('/mehr/developer')
  }

  let sandbox: VercelSandbox | null = null
  const t0 = Date.now()

  try {
    sandbox = await withTimeout(createSandbox(), STEP_TIMEOUT_MS, 'Sandbox-Erstellung')
    const t1 = Date.now()

    await withTimeout(addBundleToSandbox({ sandbox, bundleDir: BUNDLE_DIR }), STEP_TIMEOUT_MS, 'Bundle-Übertragung')
    const t2 = Date.now()

    const { sandboxFilePath, contentType } = await withTimeout(
      renderMediaOnVercel({ sandbox, compositionId: COMPOSITION_ID, inputProps: {}, codec: 'h264' }),
      STEP_TIMEOUT_MS,
      'Rendering',
    )
    const t3 = Date.now()

    const buffer = await withTimeout(sandbox.readFileToBuffer({ path: sandboxFilePath }), STEP_TIMEOUT_MS, 'Datei-Rückgabe')
    const t4 = Date.now()
    if (!buffer) throw new Error('Renderdatei konnte nicht aus der Sandbox gelesen werden (Datei existiert nicht).')

    // §Cumulative Nutzungswerte sind laut Vercel-Sandbox-Doku erst NACH stop() populiert.
    const stopResult = await sandbox.stop()
    const persistent = sandbox.persistent ?? null
    const activeCpuUsageMs = sandbox.activeCpuUsageMs ?? null
    const vcpus = sandbox.vcpus ?? null
    const memoryMb = sandbox.memory ?? null
    const region = sandbox.region ?? null
    void stopResult

    const supabase = await createClient()
    const storagePath = `${family.id}/${Date.now()}.mp4`
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType, cacheControl: '3600' })
    const t5 = Date.now()
    if (uploadError) throw new Error(`Upload nach Supabase Storage fehlgeschlagen: ${uploadError.message}`)

    const result: ReelSpikeTestResult = {
      bundleDirFound: true,
      sandboxSetupMs: t1 - t0,
      addBundleMs: t2 - t1,
      renderMs: t3 - t2,
      readFileMs: t4 - t3,
      uploadMs: t5 - t4,
      totalMs: t5 - t0,
      activeCpuUsageMs, vcpus, memoryMb, region, persistent,
      fileSizeBytes: buffer.byteLength,
      contentType,
      storagePath,
    }

    await recordTestRun('reel_spike', {
      success: true,
      summary: `Render in ${(result.totalMs / 1000).toFixed(1)}s gesamt, ${(result.fileSizeBytes / 1024).toFixed(0)} KB`,
      result: result as unknown as Json,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unbekannter Fehler beim Sandbox-Render'
    // §"Keine Secrets loggen": nur die Fehlermeldung, nie das Error-Objekt/den Stack mit evtl. enthaltenen Request-Details.
    await recordTestRun('reel_spike', { success: false, errorMessage: message })
  } finally {
    // §"Sicherer Cleanup": läuft in JEDEM Fall (Erfolg, Timeout, jeder Fehlerpfad) -- verhindert eine
    // dauerhaft laufende/kostenpflichtige Sandbox bei einem Abbruch mitten im Ablauf.
    await sandbox?.stop().catch(() => {})
  }

  redirect('/mehr/developer')
}
