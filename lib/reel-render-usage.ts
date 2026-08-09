import { createLumiCoreClient } from './supabase/lumi-core-server'

/**
 * §"Monatslimit über reel_render_usage" (Nutzervorgabe, wörtlich) -- exakt
 * dasselbe Muster wie `lib/lumi-brain-usage.ts` (`lumi_brain_usage`) bzw.
 * `flight_search_usage`. Jeder Render (Vorschau UND Final) verursacht echte
 * AWS-Kosten, unabhängig vom Ausgang -- der Zähler wird deshalb bereits beim
 * STARTEN eines Renders erhöht (lib/actions/reel-render.ts::startReelRender),
 * nicht erst bei Erfolg, damit wiederholte fehlgeschlagene Versuche das
 * Limit nicht umgehen können.
 */
const DEFAULT_MONTHLY_LIMIT = 10

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function isReelRenderLimitReached(familyId: string): Promise<boolean> {
  const lumiCore = await createLumiCoreClient()
  const monthlyLimit = Number(process.env.REEL_RENDER_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT))
  const { data: usage } = await lumiCore
    .from('travel_reel_render_usage')
    .select('render_count')
    .eq('household_id', familyId)
    .eq('month_key', currentMonthKey())
    .maybeSingle()
  return (usage?.render_count ?? 0) >= monthlyLimit
}

/** §"Monatslimit und Restkontingent anzeigen" (Nutzervorgabe, wörtlich) -- reiner Lesezugriff, erhöht den Zähler nicht. */
export async function getReelRenderUsageSummary(familyId: string): Promise<{ used: number; limit: number }> {
  const lumiCore = await createLumiCoreClient()
  const monthlyLimit = Number(process.env.REEL_RENDER_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT))
  const { data: usage } = await lumiCore
    .from('travel_reel_render_usage')
    .select('render_count')
    .eq('household_id', familyId)
    .eq('month_key', currentMonthKey())
    .maybeSingle()
  return { used: usage?.render_count ?? 0, limit: monthlyLimit }
}

export async function incrementReelRenderUsage(familyId: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const monthKey = currentMonthKey()
  const { data: usage } = await lumiCore
    .from('travel_reel_render_usage')
    .select('render_count')
    .eq('household_id', familyId)
    .eq('month_key', monthKey)
    .maybeSingle()

  const { error } = await lumiCore.from('travel_reel_render_usage').upsert(
    { household_id: familyId, month_key: monthKey, render_count: (usage?.render_count ?? 0) + 1, updated_at: new Date().toISOString() },
    { onConflict: 'household_id,month_key' },
  )
  if (error) console.error('[reel_render_usage] Speicherfehler:', error.message)
}
