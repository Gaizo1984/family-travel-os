import { createClient } from './supabase/server'
import { generateContentStrategy } from './content-strategy-ai'
import type { ContentStrategy } from './content-strategy-ai'
import type { ContentPostingPlanContext } from './content-strategy-context'

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

export type PostingPlanDayEntry = ContentStrategy & { forDate: string; dateLabel: string; locationLabel: string }

/**
 * §"KI Urlaubs-/Postingfahrplan": liest/generiert für jeden Tag des
 * Kontexts die (bereits pro Tag zwischengespeicherte) Content-Strategie --
 * exakt dieselbe Cache-Tabelle/Funktion wie "Today's Content Strategy",
 * nur über mehrere Tage geloopt statt nur für heute. Ein fehlgeschlagener
 * Tag (z. B. KI kurzzeitig nicht verfügbar) darf die übrigen Tage nicht
 * verhindern -- wird einfach ausgelassen.
 */
export async function getOrGeneratePostingPlan(
  familyId: string,
  context: ContentPostingPlanContext,
): Promise<PostingPlanDayEntry[]> {
  const entries: PostingPlanDayEntry[] = []

  for (const day of context.days) {
    let strategy = await getCachedContentStrategy(familyId, context.tripId, day.forDate)
    if (!strategy) {
      strategy = await generateAndCacheContentStrategy(
        familyId, context.tripId, day.forDate,
        {
          dateLabel: day.dateLabel, locationLabel: day.locationLabel, weatherSummary: day.weatherSummary,
          knownPlanText: day.knownPlanText, highlightTitle: day.highlightTitle,
        },
        false,
      )
    }
    if (strategy) entries.push({ ...strategy, forDate: day.forDate, dateLabel: day.dateLabel, locationLabel: day.locationLabel })
  }

  return entries
}
