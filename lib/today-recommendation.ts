import { createClient } from './supabase/server'
import { generateTodayRecommendation } from './today-ai'
import type { TodayRecommendation } from './today-ai'

/** Fest vorgegebenes Vokabular für die morgendliche Tagesstil-Frage — nur wenn kein Kalender-Highlight vorliegt. */
export const DAY_STYLE_OPTIONS = [
  { key: 'entspannung', label: 'Entspannung' },
  { key: 'abenteuer', label: 'Abenteuer' },
  { key: 'familie', label: 'Familie' },
  { key: 'kulinarik', label: 'Kulinarik' },
  { key: 'ueberraschung', label: 'Überraschung' },
] as const

export type CachedTodayRecommendation = TodayRecommendation & {
  dayStyle: string | null
  highlightTitle: string | null
  createdAt: string
}

/**
 * §"Die KI erzeugt den Tagesplan nur einmal pro Kalendertag. Ergebnis
 * speichern und bis Mitternacht wiederverwenden.": reiner Lesezugriff, kein
 * KI-Aufruf. `for_date` + UNIQUE(family_id, trip_id, for_date) sorgen dafür,
 * dass ab dem nächsten Kalendertag automatisch neu generiert wird.
 */
export async function getCachedTodayRecommendation(
  familyId: string,
  tripId: string,
  forDate: string,
): Promise<CachedTodayRecommendation | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('today_recommendations')
    .select('day_summary, recommendation, alternative, day_style, highlight_title, created_at')
    .eq('family_id', familyId)
    .eq('trip_id', tripId)
    .eq('for_date', forDate)
    .maybeSingle()

  if (!data) return null
  return {
    daySummary: data.day_summary,
    recommendation: data.recommendation as unknown as { title: string; description: string },
    alternative: data.alternative as unknown as { title: string; description: string } | null,
    dayStyle: data.day_style,
    highlightTitle: data.highlight_title,
    createdAt: data.created_at,
  }
}

/**
 * Generiert (per KI) und speichert in einem Schritt — aufgerufen entweder
 * automatisch (ein Kalender-Highlight wurde erkannt) oder nachdem die
 * Familie morgens einen Tagesstil gewählt hat. `upsert` mit dem UNIQUE-Index
 * verhindert Dubletten, falls zwei Anfragen sich zeitlich überschneiden.
 */
export async function generateAndCacheTodayRecommendation(
  familyId: string,
  tripId: string,
  forDate: string,
  context: {
    dateLabel: string
    locationLabel: string
    weatherSummary: string | null
    familyDnaText: string
    knownPlanText: string
  },
  highlightTitle: string | null,
  dayStyle: string | null,
): Promise<CachedTodayRecommendation | null> {
  const result = await generateTodayRecommendation({ ...context, highlightTitle, dayStyle })
  if (!result) return null

  const supabase = await createClient()
  const { data } = await supabase.from('today_recommendations').upsert(
    {
      family_id: familyId,
      trip_id: tripId,
      for_date: forDate,
      day_style: dayStyle,
      highlight_title: highlightTitle,
      day_summary: result.daySummary,
      recommendation: result.recommendation,
      alternative: result.alternative,
    },
    { onConflict: 'family_id,trip_id,for_date' },
  ).select('created_at').single()

  return { ...result, dayStyle, highlightTitle, createdAt: data?.created_at ?? new Date().toISOString() }
}
