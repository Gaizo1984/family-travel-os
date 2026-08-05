'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * §"KI-Aufrufe hintergrundfest machen" (Nutzervorgabe): EIN geteilter
 * Baustein für alle umgestellten Server Actions -- Job anlegen, Server
 * Action redirected sofort, die eigentliche Arbeit läuft über `after()`
 * (Vercel `waitUntil`) unabhängig von der Client-Verbindung weiter, exakt
 * das bereits in lib/actions/memories.ts etablierte Prinzip. `loadJob` wird
 * direkt aus components/PendingGenerationView.tsx (Client-Komponente)
 * aufgerufen, deshalb 'use server' auf Dateiebene.
 *
 * `supabaseOverride` erlaubt Wiederverwendung des bereits in der
 * aufrufenden Server Action erzeugten Clients (gleiche Instanz innerhalb
 * und außerhalb von `after()`, kein zweiter Verbindungsaufbau nötig).
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
  id: string; family_id: string; kind: string; status: string
  error_message: string | null; redirect_path: string | null; created_at: string; updated_at: string
}

function mapJobRow(row: JobRow): AiGenerationJob {
  return {
    id: row.id, familyId: row.family_id, kind: row.kind, status: row.status as AiGenerationJobStatus,
    errorMessage: row.error_message, redirectPath: row.redirect_path, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function createJob(familyId: string, kind: string, supabaseOverride?: SupabaseClient): Promise<string> {
  const supabase = supabaseOverride ?? (await createClient())
  const { data, error } = await supabase.from('ai_generation_jobs').insert({ family_id: familyId, kind }).select('id').single()
  if (error || !data) throw new Error('Hintergrundauftrag konnte nicht angelegt werden: ' + (error?.message ?? 'unbekannt'))
  return data.id
}

export async function completeJob(jobId: string, redirectPath: string, supabaseOverride?: SupabaseClient): Promise<void> {
  const supabase = supabaseOverride ?? (await createClient())
  await supabase.from('ai_generation_jobs').update({ status: 'completed', redirect_path: redirectPath }).eq('id', jobId)
}

export async function failJob(jobId: string, message: string, supabaseOverride?: SupabaseClient): Promise<void> {
  const supabase = supabaseOverride ?? (await createClient())
  await supabase.from('ai_generation_jobs').update({ status: 'failed', error_message: message }).eq('id', jobId)
}

export async function loadJob(jobId: string): Promise<AiGenerationJob | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_generation_jobs')
    .select('id, family_id, kind, status, error_message, redirect_path, created_at, updated_at')
    .eq('id', jobId)
    .maybeSingle()
  return data ? mapJobRow(data as JobRow) : null
}
