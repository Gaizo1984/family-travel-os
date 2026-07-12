'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { generateConciergeAnswer } from '@/lib/concierge-ai'

export type CachedCategorySuggestion = {
  category: string
  questionText: string
  title: string
  body: string
  eventTitle: string
  updatedAt: string
  daysAgo: number
}

/**
 * §Mehrtägiger Cache (siehe Migration concierge_category_suggestions):
 * "vor X Tagen" statt nur einer Uhrzeit, da eine Kategorie-Empfehlung anders
 * als concierge_messages (tagesgebunden) über mehrere Tage gültig bleibt,
 * bis die Familie ausdrücklich "Aktualisieren" klickt.
 */
export async function getCategorySuggestion(familyId: string, tripId: string, category: string): Promise<CachedCategorySuggestion | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('concierge_category_suggestions')
    .select('category, question_text, title, body, event_title, updated_at')
    .eq('family_id', familyId).eq('trip_id', tripId).eq('category', category)
    .maybeSingle()

  if (!data) return null
  const daysAgo = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / 86400000)
  return {
    category: data.category, questionText: data.question_text, title: data.title, body: data.body,
    eventTitle: data.event_title, updatedAt: data.updated_at, daysAgo,
  }
}

/**
 * §"KI nur auf Klick": einziger Auslöser für einen OpenAI-Aufruf innerhalb
 * einer Kategorie-Seite (Aktivitäten/Strände/...). Nutzt dieselbe
 * `generateConciergeAnswer` wie Frag LUMI (lib/concierge-ai.ts) — keine
 * zweite KI-Implementierung — speichert das Ergebnis aber in
 * `concierge_category_suggestions` statt `concierge_messages`, da
 * Kategorie-Vorschläge über mehrere Tage gültig bleiben sollen (Upsert,
 * nicht tagesgebunden). Dient sowohl der Erstgenerierung als auch dem
 * "Aktualisieren"-Button (`is_regenerate`).
 */
export async function generateCategorySuggestion(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const category = String(formData.get('category') ?? '')
  const questionText = String(formData.get('question_text') ?? '')
  const dateLabel = String(formData.get('date_label') ?? '')
  const locationLabel = String(formData.get('location_label') ?? '')
  const weatherSummary = String(formData.get('weather_summary') ?? '').trim() || null
  const knownPlanText = String(formData.get('known_plan_text') ?? '')
  const highlightTitle = String(formData.get('highlight_title') ?? '').trim() || null
  const memberNames = String(formData.get('member_names') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const isRegenerate = String(formData.get('is_regenerate') ?? '') === 'true'
  const returnTo = String(formData.get('return_to') ?? '/today')

  if (!familyId || !tripId || !category || !questionText) redirect(returnTo)

  const result = await generateConciergeAnswer({
    questionText, dateLabel, locationLabel, weatherSummary, knownPlanText, highlightTitle, memberNames, isRegenerate,
  })

  if (!result)
    redirect(`${returnTo}?error=${encodeURIComponent('Die KI ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('concierge_category_suggestions').upsert(
    {
      family_id: familyId, trip_id: tripId, category, question_text: questionText,
      title: result.title, body: result.body, event_title: result.eventTitle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'family_id,trip_id,category' },
  )

  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(returnTo)
}
