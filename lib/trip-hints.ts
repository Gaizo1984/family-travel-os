import type { SupabaseClient } from '@supabase/supabase-js'
import type { HintPriority } from '@/lib/hints/types'

export type TripHint = {
  id: string
  hintType: string
  priority: HintPriority
  title: string
  reasoning: string
  relevantAt: string | null
  actionLabel: string
  actionHref: string
}

const PRIORITY_RANK: Record<HintPriority, number> = { critical: 0, upcoming: 1, recommendation: 2 }

export const TRIP_HINT_PRIORITY_LABELS: Record<HintPriority, string> = {
  critical: 'Heute wichtig',
  upcoming: 'Demnächst',
  recommendation: 'Empfehlung',
}

/**
 * §"Auf dem Dashboard maximal drei Hinweise anzeigen" (Nutzervorgabe,
 * wörtlich): reiner Lesepfad -- der Generierungs-Cron (lib/hint-generation.ts)
 * hat bereits priorisiert/dedupliziert, hier wird nur noch sortiert und
 * gekappt. Familienweit statt reisegebunden, da "Heute wichtig"/"Demnächst"/
 * "Empfehlung" auch reiseübergreifend gelten sollen (z. B. eine bevorstehende
 * Reise, während gerade eine andere läuft).
 */
export async function loadTopTripHints(supabase: SupabaseClient, familyId: string, limit = 3): Promise<TripHint[]> {
  const { data } = await supabase
    .from('trip_hints')
    .select('id, hint_type, priority, title, reasoning, relevant_at, action_label, action_href')
    .eq('family_id', familyId)
    .eq('status', 'active')
    .order('relevant_at', { ascending: true, nullsFirst: false })
    .limit(20)

  const rows = (data ?? []) as Array<{
    id: string; hint_type: string; priority: string; title: string; reasoning: string
    relevant_at: string | null; action_label: string; action_href: string
  }>

  return rows
    .map((r) => ({
      id: r.id, hintType: r.hint_type, priority: r.priority as HintPriority, title: r.title,
      reasoning: r.reasoning, relevantAt: r.relevant_at, actionLabel: r.action_label, actionHref: r.action_href,
    }))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, limit)
}
