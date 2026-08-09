import { createLumiCoreClient } from './supabase/lumi-core-server'

/** §"Token- und Kostenkontrolle" (Nutzervorgabe) -- exakt dasselbe Muster wie `flight_search_usage`/`FLIGHT_SEARCH_MONTHLY_LIMIT`, nur für echte OpenAI-Aufrufe von Frag LUMI. Cache-Treffer zählen nie mit (siehe lib/actions/concierge-actions.ts, Zähler wird erst nach erfolgreichem `generateLumiBrainAnswer`-Aufruf erhöht). */
const DEFAULT_MONTHLY_LIMIT = 100

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function isLumiBrainLimitReached(familyId: string): Promise<boolean> {
  const lumiCore = await createLumiCoreClient()
  const monthlyLimit = Number(process.env.LUMI_BRAIN_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT))
  const { data: usage } = await lumiCore
    .from('travel_lumi_brain_usage')
    .select('question_count')
    .eq('household_id', familyId)
    .eq('month_key', currentMonthKey())
    .maybeSingle()
  return (usage?.question_count ?? 0) >= monthlyLimit
}

/** Nur nach einem ECHTEN OpenAI-Aufruf zu rufen -- niemals bei einem Cache-Treffer. */
export async function incrementLumiBrainUsage(familyId: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const monthKey = currentMonthKey()
  const { data: usage } = await lumiCore
    .from('travel_lumi_brain_usage')
    .select('question_count')
    .eq('household_id', familyId)
    .eq('month_key', monthKey)
    .maybeSingle()

  const { error } = await lumiCore.from('travel_lumi_brain_usage').upsert(
    { household_id: familyId, month_key: monthKey, question_count: (usage?.question_count ?? 0) + 1, updated_at: new Date().toISOString() },
    { onConflict: 'household_id,month_key' },
  )
  if (error) console.error('[lumi_brain_usage] Speicherfehler:', error.message)
}
