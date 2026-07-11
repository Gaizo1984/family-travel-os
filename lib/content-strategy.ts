import { createClient } from './supabase/server'
import { generateContentStrategy } from './content-strategy-ai'
import type { ContentStrategy } from './content-strategy-ai'

/** Liest eine ggf. bereits heute generierte Strategie — kein KI-Aufruf. */
export async function getCachedContentStrategy(
  familyId: string,
  tripId: string,
  forDate: string,
): Promise<ContentStrategy | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('content_strategies')
    .select('content_type, reasoning, storyline, shotlist, best_time, effort')
    .eq('family_id', familyId)
    .eq('trip_id', tripId)
    .eq('for_date', forDate)
    .maybeSingle()

  if (!data) return null
  return {
    contentType: data.content_type,
    reasoning: data.reasoning,
    storyline: data.storyline,
    shotlist: data.shotlist as unknown as string[],
    bestTime: data.best_time ?? '',
    effort: data.effort ?? '',
  }
}

/**
 * Generiert und speichert (upsert) — sowohl für die erste Strategie des Tages
 * als auch für "Andere Strategie" (überschreibt gezielt den heutigen Eintrag).
 */
export async function generateAndCacheContentStrategy(
  familyId: string,
  tripId: string,
  forDate: string,
  context: {
    dateLabel: string
    locationLabel: string
    weatherSummary: string | null
    knownPlanText: string
    highlightTitle: string | null
  },
  regenerate: boolean,
): Promise<ContentStrategy | null> {
  const result = await generateContentStrategy({ ...context, regenerate })
  if (!result) return null

  const supabase = await createClient()
  await supabase.from('content_strategies').upsert(
    {
      family_id: familyId,
      trip_id: tripId,
      for_date: forDate,
      content_type: result.contentType,
      reasoning: result.reasoning,
      storyline: result.storyline,
      shotlist: result.shotlist,
      best_time: result.bestTime,
      effort: result.effort,
    },
    { onConflict: 'family_id,trip_id,for_date' },
  )

  return result
}
