'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { generateAndCacheTodayRecommendation } from '@/lib/today-recommendation'
import { createJob, completeJob, failJob } from '@/lib/ai-generation-jobs'

/**
 * §"Wichtig: KI nur auf ausdrückliche Nutzeraktion": vormals generierte die
 * Startseite die Tagesempfehlung automatisch, sobald ein Kalender-Highlight
 * erkannt wurde. Das entfällt -- dieselbe Funktion wird jetzt ausschließlich
 * durch den Button "Tagesplanung erstellen" ausgelöst (ersetzt zugleich den
 * bisherigen Tagesstil-Auswähler, der lediglich derselben Generierung mit
 * einer zusätzlichen Vorliebe diente).
 */
export async function generateTodayPlan(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const forDate = String(formData.get('for_date') ?? '')
  const dateLabel = String(formData.get('date_label') ?? '')
  const locationLabel = String(formData.get('location_label') ?? '')
  const weatherSummary = String(formData.get('weather_summary') ?? '').trim() || null
  const familyDnaText = String(formData.get('family_dna_text') ?? '')
  const knownPlanText = String(formData.get('known_plan_text') ?? '')
  const highlightTitle = String(formData.get('highlight_title') ?? '').trim() || null

  if (!familyId || !tripId || !forDate) redirect('/today')

  const jobId = await createJob(familyId, 'today_plan_generate')

  after(async () => {
    try {
      await generateAndCacheTodayRecommendation(
        familyId, tripId, forDate,
        { dateLabel, locationLabel, weatherSummary, familyDnaText, knownPlanText },
        highlightTitle, null,
      )
      await completeJob(jobId, '/today')
    } catch (e) {
      console.error('[today-plan] generateTodayPlan fehlgeschlagen:', e instanceof Error ? e.message : e)
      await failJob(jobId, 'Die Tagesplanung ist gerade nicht verfügbar. Bitte später erneut versuchen.')
    }
  })

  redirect(`/today?job=${jobId}`)
}
