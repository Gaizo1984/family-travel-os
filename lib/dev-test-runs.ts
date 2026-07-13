import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export type DevTestRun = {
  moduleKey: string
  success: boolean
  summary: string | null
  errorMessage: string | null
  result: Json | null
  ranAt: string
}

/**
 * Gemeinsamer Lese-/Schreibzugriff auf `dev_test_runs` für alle Testmodule
 * im Developer-Bereich (Mehr → Developer). `result` ist bewusst eine vom
 * Aufrufer selbst zusammengestellte, kompakte Zusammenfassung -- niemals die
 * vollständige/rohe Google-/OpenAI-Antwort und niemals Keys/Secrets.
 */
export async function getLastTestRun(moduleKey: string): Promise<DevTestRun | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dev_test_runs')
    .select('module_key, success, summary, error_message, result, ran_at')
    .eq('module_key', moduleKey)
    .maybeSingle()

  if (!data) return null
  return {
    moduleKey: data.module_key, success: data.success, summary: data.summary,
    errorMessage: data.error_message, result: data.result, ranAt: data.ran_at,
  }
}

export async function getAllTestRuns(): Promise<Record<string, DevTestRun>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dev_test_runs')
    .select('module_key, success, summary, error_message, result, ran_at')

  const byModule: Record<string, DevTestRun> = {}
  for (const row of data ?? []) {
    byModule[row.module_key] = {
      moduleKey: row.module_key, success: row.success, summary: row.summary,
      errorMessage: row.error_message, result: row.result, ranAt: row.ran_at,
    }
  }
  return byModule
}

export async function recordTestRun(
  moduleKey: string,
  run: { success: boolean; summary?: string | null; errorMessage?: string | null; result?: Json | null },
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('dev_test_runs').upsert(
    {
      module_key: moduleKey, success: run.success,
      summary: run.summary ?? null, error_message: run.errorMessage ?? null, result: run.result ?? null,
      ran_at: new Date().toISOString(),
    },
    { onConflict: 'module_key' },
  )
}
