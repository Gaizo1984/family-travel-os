'use server'

import { redirect } from 'next/navigation'
import { generateAndCacheTodayRecommendation, DAY_STYLE_OPTIONS } from '@/lib/today-recommendation'

/**
 * §"Existieren keine Highlights, fragt die App morgens einmal nach dem
 * gewünschten Tagesstil... Die Auswahl gilt bis Mitternacht.": die Seite
 * übergibt den bereits berechneten Kontext (Datum, Standort, Wetter, Familien-
 * DNA, bekannter Plan) als versteckte Formularfelder, damit hier nicht
 * dieselbe Datenbeschaffung (Wetter-Geokodierung, Familien-DNA-Abfrage, ...)
 * ein zweites Mal laufen muss.
 */
export async function chooseTodayStyle(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const forDate = String(formData.get('for_date') ?? '')
  const dayStyle = String(formData.get('day_style') ?? '')

  const dateLabel = String(formData.get('date_label') ?? '')
  const locationLabel = String(formData.get('location_label') ?? '')
  const weatherSummary = String(formData.get('weather_summary') ?? '').trim() || null
  const familyDnaText = String(formData.get('family_dna_text') ?? '')
  const knownPlanText = String(formData.get('known_plan_text') ?? '')

  const validStyle = DAY_STYLE_OPTIONS.some((o) => o.key === dayStyle)
  if (!familyId || !tripId || !forDate || !validStyle) redirect('/today')

  await generateAndCacheTodayRecommendation(
    familyId, tripId, forDate,
    { dateLabel, locationLabel, weatherSummary, familyDnaText, knownPlanText },
    null, dayStyle,
  )

  redirect('/today')
}
