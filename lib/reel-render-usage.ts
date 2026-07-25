import { createClient } from './supabase/server'

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
  const supabase = await createClient()
  const monthlyLimit = Number(process.env.REEL_RENDER_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT))
  const { data: usage } = await supabase
    .from('reel_render_usage')
    .select('render_count')
    .eq('family_id', familyId)
    .eq('month_key', currentMonthKey())
    .maybeSingle()
  return (usage?.render_count ?? 0) >= monthlyLimit
}

export async function incrementReelRenderUsage(familyId: string): Promise<void> {
  const supabase = await createClient()
  const monthKey = currentMonthKey()
  const { data: usage } = await supabase
    .from('reel_render_usage')
    .select('render_count')
    .eq('family_id', familyId)
    .eq('month_key', monthKey)
    .maybeSingle()

  const { error } = await supabase.from('reel_render_usage').upsert(
    { family_id: familyId, month_key: monthKey, render_count: (usage?.render_count ?? 0) + 1, updated_at: new Date().toISOString() },
    { onConflict: 'family_id,month_key' },
  )
  if (error) console.error('[reel_render_usage] Speicherfehler:', error.message)
}
