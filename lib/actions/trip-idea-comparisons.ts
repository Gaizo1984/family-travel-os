'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { generateIdeaComparisonScores } from '@/lib/trip-idea-advisor-ai'
import type { LuxuryHotelTier } from '@/lib/data/luxury-hotel-brands'
import type { HotelShortlist } from '@/lib/trip-idea-hotel-types'
import type { Json } from '@/lib/supabase/types'

const TIER_RANK: Record<LuxuryHotelTier, number> = { standard: 1, premium: 2, ultra_luxury: 3 }

/** Höchstes Tier unter den (bereits qualifizierten) Shortlist-Hotels -- `null`, wenn noch keine Shortlist oder ausschließlich Fallback-Hotels (tier=null) vorhanden sind. */
function bestHotelTier(shortlist: HotelShortlist | null): LuxuryHotelTier | null {
  if (!shortlist) return null
  let best: LuxuryHotelTier | null = null
  for (const item of shortlist.items) {
    if (!item.tier) continue
    if (!best || TIER_RANK[item.tier] > TIER_RANK[best]) best = item.tier
  }
  return best
}

type IdeaForComparison = {
  id: string
  destination: string
  route_summary: string | null
  best_season: string | null
  reasoning: string | null
  duration_days_min: number | null
  duration_days_max: number | null
  budget_range_min: number | null
  budget_range_max: number | null
  budget_currency: string
  hotel_shortlist: HotelShortlist | null
  budget_breakdown: { totalMin: number | null; totalMax: number | null; currency: string } | null
}

/**
 * §"Favoriten & Vergleich": einziger Auslöser für den gebündelten KI-Aufruf
 * (Places/Routes sind hier nicht involviert -- alle Hotelfakten kommen bereits
 * aus der jeweils vorhandenen `hotel_shortlist` der Ideen). Berechnet die 3
 * "harten" Kriterien (Gesamtkosten/Reisedauer/Hotelqualität) direkt aus
 * echten gespeicherten Daten, nie von der KI. Cached nach dem Muster von
 * category_places_cache -- ein "Neu vergleichen" überschreibt einfach den
 * bestehenden Eintrag (upsert).
 */
export async function generateIdeaComparison(formData: FormData) {
  const ideaIds = formData.getAll('idea_ids').map(String).filter(Boolean)
  const fallbackReturn = '/discover/ideas'

  if (ideaIds.length < 2 || ideaIds.length > 3)
    redirect(`${fallbackReturn}?error=${encodeURIComponent('Bitte genau 2 oder 3 Ideen für den Vergleich auswählen.')}`)

  const compareUrl = `/discover/ideas/compare?ids=${ideaIds.join(',')}`

  const supabase = await createClient()
  const { data: ideasRaw } = await supabase
    .from('trip_ideas')
    .select('id, family_id, destination, route_summary, best_season, reasoning, duration_days_min, duration_days_max, budget_range_min, budget_range_max, budget_currency, hotel_shortlist, budget_breakdown')
    .in('id', ideaIds)

  const ideas = (ideasRaw ?? []) as unknown as (IdeaForComparison & { family_id: string })[]
  if (ideas.length < 2) redirect(`${fallbackReturn}?error=${encodeURIComponent('Die ausgewählten Ideen konnten nicht geladen werden.')}`)

  const familyId = ideas[0].family_id
  const dnaSummary = await buildFamilyDnaSummary(familyId)
  const dnaText = formatFamilyDnaForPrompt(dnaSummary, new Date().toISOString().slice(0, 10))

  const aiIdeas = ideas.map((idea) => ({
    destination: idea.destination,
    routeSummary: idea.route_summary,
    bestSeason: idea.best_season,
    reasoning: idea.reasoning,
    bestHotelTier: bestHotelTier(idea.hotel_shortlist),
  }))

  const aiScores = await generateIdeaComparisonScores({ ideas: aiIdeas, familyDnaText: dnaText })
  const aiByDestination = new Map((aiScores ?? []).map((s) => [s.destination, s]))

  const scores: Record<string, unknown> = {}
  for (const idea of ideas) {
    const ai = aiByDestination.get(idea.destination)
    scores[idea.id] = {
      destination: idea.destination,
      totalCostMin: idea.budget_breakdown?.totalMin ?? idea.budget_range_min,
      totalCostMax: idea.budget_breakdown?.totalMax ?? idea.budget_range_max,
      currency: idea.budget_breakdown?.currency ?? idea.budget_currency,
      durationMin: idea.duration_days_min,
      durationMax: idea.duration_days_max,
      bestHotelTier: bestHotelTier(idea.hotel_shortlist),
      // §"Ehrliche 'nicht einschätzbar'-Option statt Erfindung": ohne
      // KI-Treffer bleiben die qualitativen Felder explizit unbestimmt statt
      // stillschweigend einen Wert zu behaupten.
      flightBurden: ai?.flightBurden ?? 'nicht einschätzbar',
      flightBurdenReasoning: ai?.flightBurdenReasoning ?? 'Keine KI-Einschätzung verfügbar.',
      weatherFit: ai?.weatherFit ?? 'nicht einschätzbar',
      weatherFitReasoning: ai?.weatherFitReasoning ?? 'Keine KI-Einschätzung verfügbar.',
      kidFriendliness: ai?.kidFriendliness ?? null,
      kidFriendlinessReasoning: ai?.kidFriendlinessReasoning ?? 'Keine KI-Einschätzung verfügbar.',
      experienceValue: ai?.experienceValue ?? null,
      experienceValueReasoning: ai?.experienceValueReasoning ?? 'Keine KI-Einschätzung verfügbar.',
      lumiFit: ai?.lumiFit ?? null,
      lumiFitReasoning: ai?.lumiFitReasoning ?? 'Keine KI-Einschätzung verfügbar.',
    }
  }

  const comparisonKey = [...ideaIds].sort().join(',')
  const { error } = await supabase.from('trip_idea_comparisons').upsert(
    { family_id: familyId, idea_ids: ideaIds, comparison_key: comparisonKey, scores: scores as Json },
    { onConflict: 'family_id,comparison_key' },
  )
  if (error) redirect(`${compareUrl}&error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(compareUrl)
}
