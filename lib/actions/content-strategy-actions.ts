'use server'

import { redirect } from 'next/navigation'
import { generateAndCacheContentStrategy } from '@/lib/content-strategy'

/**
 * Wird sowohl für die erste Strategie des Tages als auch für den
 * "Andere Strategie"-Button verwendet (regenerate=true überschreibt gezielt
 * den heutigen Eintrag). Kontext kommt als versteckte Formularfelder von der
 * Seite, die ihn bereits über buildContentStrategyContext ermittelt hat —
 * keine zweite Wetter-/Kalenderabfrage nötig.
 */
export async function regenerateContentStrategy(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const forDate = String(formData.get('for_date') ?? '')
  const dateLabel = String(formData.get('date_label') ?? '')
  const locationLabel = String(formData.get('location_label') ?? '')
  const weatherSummary = String(formData.get('weather_summary') ?? '').trim() || null
  const knownPlanText = String(formData.get('known_plan_text') ?? '')
  const highlightTitle = String(formData.get('highlight_title') ?? '').trim() || null

  if (!familyId || !tripId || !forDate) redirect('/content-studio')

  await generateAndCacheContentStrategy(
    familyId, tripId, forDate,
    { dateLabel, locationLabel, weatherSummary, knownPlanText, highlightTitle },
    true,
  )

  redirect('/content-studio')
}
