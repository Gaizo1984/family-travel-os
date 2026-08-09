'use server'

import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

/**
 * §"KI-Aufrufe hintergrundfest machen" (Nutzervorgabe): EIN geteilter
 * Baustein für alle umgestellten Server Actions -- Job anlegen, Server
 * Action redirected sofort, die eigentliche Arbeit läuft über `after()`
 * (Vercel `waitUntil`) unabhängig von der Client-Verbindung weiter, exakt
 * das bereits in lib/actions/memories.ts etablierte Prinzip. `loadJob` wird
 * direkt aus components/PendingGenerationView.tsx (Client-Komponente)
 * aufgerufen, deshalb 'use server' auf Dateiebene.
 *
 * FINALER CUTOVER: `ai_generation_jobs` -> `travel_ai_generation_jobs`
 * (Lumi Core), `family_id` -> `household_id`. `supabaseOverride` erlaubt
 * weiterhin die Wiederverwendung des bereits in der aufrufenden Server
 * Action erzeugten Lumi-Core-Clients (gleiche Instanz innerhalb und
 * außerhalb von `after()`, kein zweiter Verbindungsaufbau nötig) --
 * erwartet jetzt einen Lumi-Core-Client, keinen Travel-Client mehr.
 */

export type AiGenerationJobStatus = 'pending' | 'completed' | 'failed'

export type AiGenerationJob = {
  id: string
  familyId: string
  kind: string
  status: AiGenerationJobStatus
  errorMessage: string | null
  redirectPath: string | null
  createdAt: string
  updatedAt: string
}

type JobRow = {
  id: string; household_id: string; kind: string; status: string
  error_message: string | null; redirect_path: string | null; created_at: string; updated_at: string
}

function mapJobRow(row: JobRow): AiGenerationJob {
  return {
    id: row.id, familyId: row.household_id, kind: row.kind, status: row.status as AiGenerationJobStatus,
    errorMessage: row.error_message, redirectPath: row.redirect_path, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function createJob(householdId: string, kind: string, supabaseOverride?: SupabaseClient<LumiCoreDatabase>): Promise<string> {
  const lumiCore = supabaseOverride ?? (await createLumiCoreClient())
  const { data, error } = await lumiCore.from('travel_ai_generation_jobs').insert({ household_id: householdId, kind }).select('id').single()
  if (error || !data) throw new Error('Hintergrundauftrag konnte nicht angelegt werden: ' + (error?.message ?? 'unbekannt'))
  return data.id
}

export async function completeJob(jobId: string, redirectPath: string, supabaseOverride?: SupabaseClient<LumiCoreDatabase>): Promise<void> {
  const lumiCore = supabaseOverride ?? (await createLumiCoreClient())
  await lumiCore.from('travel_ai_generation_jobs').update({ status: 'completed', redirect_path: redirectPath }).eq('id', jobId)
}

export async function failJob(jobId: string, message: string, supabaseOverride?: SupabaseClient<LumiCoreDatabase>): Promise<void> {
  const lumiCore = supabaseOverride ?? (await createLumiCoreClient())
  await lumiCore.from('travel_ai_generation_jobs').update({ status: 'failed', error_message: message }).eq('id', jobId)
}

export async function loadJob(jobId: string): Promise<AiGenerationJob | null> {
  const lumiCore = await createLumiCoreClient()
  const { data } = await lumiCore
    .from('travel_ai_generation_jobs')
    .select('id, household_id, kind, status, error_message, redirect_path, created_at, updated_at')
    .eq('id', jobId)
    .maybeSingle()
  return data ? mapJobRow(data as JobRow) : null
}
