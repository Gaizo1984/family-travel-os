import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

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
/**
 * FINALER CUTOVER, Schema-Luecken-Schliessung: vollständig auf Lumi Core
 * umgestellt, keine Travel-Bridge mehr nötig. `exceptional_hotel_criteria`
 * liegt jetzt im generischen, App-übergreifenden Einstellungs-Container
 * `app_preferences.settings` (Schlüssel `travel_exceptional_hotel_criteria`,
 * siehe lib/actions/family-preferences.ts), `persons` kommt aus
 * `household_members` + der neuen Zusatztabelle
 * `travel_household_member_profiles` (role_label/description/interest_tags/
 * travel_needs, siehe lib/actions/persons.ts) -- `persons[].id` ist jetzt
 * die household_member_id (nicht mehr Travels legacy person_id), konsistent
 * mit allen anderen Reisenden-Auswahlformularen im Rest der App.
 */
export async function buildFamilyDnaSummary(householdId: string): Promise<FamilyDnaSummary> {
  const lumiCore = await createLumiCoreClient()

  const [{ data: preferences }, { data: appPrefs }, { data: members }, { data: profiles }] = await Promise.all([
    lumiCore.from('travel_preference_categories').select('category_key, weight, note').eq('household_id', householdId),
    lumiCore.from('app_preferences').select('settings').eq('household_id', householdId).maybeSingle(),
    lumiCore.from('household_members').select('id, name, birth_date, is_minor').eq('household_id', householdId).is('deleted_at', null),
    lumiCore.from('travel_household_member_profiles').select('household_member_id, interest_tags, travel_needs').eq('household_id', householdId),
  ])

  const profileByMemberId = new Map((profiles ?? []).map((p) => [p.household_member_id, p]))
  const persons: FamilyDnaSummary['persons'] = (members ?? []).map((m) => ({
    id: m.id, name: m.name, birth_date: m.birth_date, is_minor: m.is_minor,
    interest_tags: profileByMemberId.get(m.id)?.interest_tags ?? [],
    travel_needs: profileByMemberId.get(m.id)?.travel_needs ?? [],
  }))

  const settings = (appPrefs?.settings ?? {}) as { travel_exceptional_hotel_criteria?: string[] }

  return {
    familyId: householdId,
    preferences: preferences ?? [],
    hotelCriteria: settings.travel_exceptional_hotel_criteria ?? [],
    persons,
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
