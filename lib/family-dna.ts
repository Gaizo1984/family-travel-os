import { createClient } from '@/lib/supabase/server'

/** Kanonisches, app-seitig validiertes Vokabular für individuelle Reisebedürfnisse (persons.travel_needs). */
export const TRAVEL_NEED_OPTIONS = [
  { key: 'kurze_transfers', label: 'Kurze Transfers' },
  { key: 'pausen', label: 'Pausen einplanen' },
  { key: 'abenteuer', label: 'Abenteuer' },
  { key: 'essen', label: 'Gutes Essen' },
  { key: 'natur', label: 'Natur' },
  { key: 'sport', label: 'Sport & Aktivität' },
] as const

/** Kanonischer Kriterienkatalog für "außergewöhnliche Hotels" (families.exceptional_hotel_criteria). */
export const HOTEL_CRITERIA_OPTIONS = [
  { key: 'lage', label: 'Außergewöhnliche Lage' },
  { key: 'architektur_design', label: 'Architektur & Design' },
  { key: 'service', label: 'Service' },
  { key: 'privatsphaere', label: 'Privatsphäre' },
  { key: 'naturintegration', label: 'Naturintegration' },
  { key: 'pool_strand', label: 'Pool & Strand' },
  { key: 'grosszuegige_zimmer', label: 'Großzügige Zimmer' },
  { key: 'charakter_statt_kette', label: 'Charakter statt Kette' },
] as const

/** Kanonische Reisekompass-Kategorien (family_preference_categories.category_key), erweiterbar ohne Migration. */
export const COMPASS_CATEGORY_ORDER = [
  'hotels_design', 'natur_landschaft', 'strand_wasser',
  'kultur_entdecken', 'erlebnisse_fuer_alle', 'reisetempo',
] as const

export const COMPASS_CATEGORY_LABELS: Record<string, string> = {
  hotels_design: 'Hotels & Design',
  natur_landschaft: 'Natur & Landschaft',
  strand_wasser: 'Strand & Wasser',
  kultur_entdecken: 'Kultur & Entdecken',
  erlebnisse_fuer_alle: 'Erlebnisse für alle',
  reisetempo: 'Reisetempo',
}

export type FamilyPreference = { category_key: string; weight: number; note: string | null }
export type FamilyDnaPerson = {
  id: string; name: string; birth_date: string | null; is_minor: boolean
  interest_tags: string[]; travel_needs: string[]
}

export type FamilyDnaSummary = {
  familyId: string
  preferences: FamilyPreference[]
  hotelCriteria: string[]
  persons: FamilyDnaPerson[]
}

/** Alter in vollen Jahren zu einem Stichtag (z. B. geplanter Reisezeitpunkt) — null ohne Geburtsdatum. */
export function ageAtDate(birthDate: string | null, atDate: string | Date): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const at = typeof atDate === 'string' ? new Date(atDate) : atDate
  let age = at.getFullYear() - birth.getFullYear()
  const hasHadBirthdayThisYear =
    at.getMonth() > birth.getMonth() ||
    (at.getMonth() === birth.getMonth() && at.getDate() >= birth.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

/**
 * Bündelt Reisekompass-Gewichte, Hotelkriterien und alle Personen-Reisebedürfnisse
 * zu einer zentralen Familien-Zusammenfassung — von allen KI-/Scoring-Flows
 * (Content-Ideen, Reiseideen, Discover) genutzt, statt dreifach dupliziert.
 */
export async function buildFamilyDnaSummary(familyId: string): Promise<FamilyDnaSummary> {
  const supabase = await createClient()

  const [{ data: preferences }, { data: family }, { data: persons }] = await Promise.all([
    supabase.from('family_preference_categories').select('category_key, weight, note').eq('family_id', familyId),
    supabase.from('families').select('exceptional_hotel_criteria').eq('id', familyId).maybeSingle(),
    supabase.from('persons').select('id, name, birth_date, is_minor, interest_tags, travel_needs').eq('family_id', familyId),
  ])

  return {
    familyId,
    preferences: preferences ?? [],
    hotelCriteria: family?.exceptional_hotel_criteria ?? [],
    persons: persons ?? [],
  }
}

/** Kurzer, für KI-Prompts geeigneter Fließtext aus der Familien-Zusammenfassung. */
export function formatFamilyDnaForPrompt(summary: FamilyDnaSummary, atDate?: string): string {
  const lines: string[] = []

  if (summary.preferences.length > 0) {
    const prefText = summary.preferences
      .map((p) => `${COMPASS_CATEGORY_LABELS[p.category_key] ?? p.category_key}: Gewichtung ${p.weight}/5${p.note ? ` (${p.note})` : ''}`)
      .join('; ')
    lines.push(`Reisekompass: ${prefText}.`)
  }

  if (summary.hotelCriteria.length > 0) {
    const labels = summary.hotelCriteria.map((key) => HOTEL_CRITERIA_OPTIONS.find((o) => o.key === key)?.label ?? key)
    lines.push(`Außergewöhnliche Hotels bedeuten für diese Familie: ${labels.join(', ')}.`)
  }

  if (summary.persons.length > 0) {
    const personText = summary.persons
      .map((p) => {
        const age = atDate ? ageAtDate(p.birth_date, atDate) : null
        const parts = [p.name]
        if (age !== null) parts.push(`${age} Jahre zum Reisezeitpunkt`)
        if (p.travel_needs.length > 0) parts.push(`Bedürfnisse: ${p.travel_needs.join(', ')}`)
        if (p.interest_tags.length > 0) parts.push(`Interessen: ${p.interest_tags.join(', ')}`)
        return parts.join(', ')
      })
      .join('; ')
    lines.push(`Reisende: ${personText}.`)
  }

  return lines.join(' ')
}
