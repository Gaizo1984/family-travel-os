import type { SupabaseClient } from '@supabase/supabase-js'

export type PackingStatus = 'offen' | 'eingepackt' | 'noch_besorgen' | 'nicht_benoetigt'
export type LuggageAssignment = 'personal_item' | 'hand_luggage' | 'checked_luggage' | 'stroller_or_separate' | 'unassigned'
export type PackingSource = 'basisliste' | 'wetter' | 'aktivitaet' | 'buchung' | 'hotel' | 'bestaetigte_vorliebe' | 'fruehere_reiseerfahrung' | 'manuell'
export type PackingCategory =
  | 'dokumente' | 'kleidung' | 'schuhe' | 'hygiene' | 'gesundheit' | 'elektronik'
  | 'handgepaeck' | 'strand_und_pool' | 'sport_und_aktivitaeten' | 'kinder_und_baby'
  | 'snacks' | 'gemeinsam' | 'kurz_vor_abfahrt'

export const PACKING_STATUS_ORDER: PackingStatus[] = ['offen', 'eingepackt', 'noch_besorgen', 'nicht_benoetigt']
export const PACKING_STATUS_LABELS: Record<PackingStatus, string> = {
  offen: 'Offen',
  eingepackt: 'Eingepackt',
  noch_besorgen: 'Noch besorgen',
  nicht_benoetigt: 'Nicht benötigt',
}

export const LUGGAGE_ASSIGNMENT_ORDER: LuggageAssignment[] = ['personal_item', 'hand_luggage', 'checked_luggage', 'stroller_or_separate', 'unassigned']
export const LUGGAGE_ASSIGNMENT_LABELS: Record<LuggageAssignment, string> = {
  personal_item: 'Persönlicher Gegenstand',
  hand_luggage: 'Handgepäck',
  checked_luggage: 'Aufgabegepäck',
  stroller_or_separate: 'Kinderwagen / separates Gepäck',
  unassigned: 'Noch nicht zugeordnet',
}

export const PACKING_CATEGORY_ORDER: PackingCategory[] = [
  'dokumente', 'kleidung', 'schuhe', 'hygiene', 'gesundheit', 'elektronik',
  'handgepaeck', 'strand_und_pool', 'sport_und_aktivitaeten', 'kinder_und_baby',
  'snacks', 'gemeinsam', 'kurz_vor_abfahrt',
]
export const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  dokumente: 'Dokumente und Reiseunterlagen',
  kleidung: 'Kleidung',
  schuhe: 'Schuhe',
  hygiene: 'Hygiene',
  gesundheit: 'Gesundheit',
  elektronik: 'Elektronik und Ladegeräte',
  handgepaeck: 'Handgepäck',
  strand_und_pool: 'Strand und Pool',
  sport_und_aktivitaeten: 'Sport und Aktivitäten',
  kinder_und_baby: 'Kinder und Baby',
  snacks: 'Snacks und Reiseverpflegung',
  gemeinsam: 'Gemeinsam',
  kurz_vor_abfahrt: 'Kurz vor Abfahrt',
}

export const PACKING_SOURCE_LABELS: Record<PackingSource, string> = {
  basisliste: 'Basisliste',
  wetter: 'Wetter',
  aktivitaet: 'Aktivität',
  buchung: 'Buchung',
  hotel: 'Hotel',
  bestaetigte_vorliebe: 'Bestätigte Vorliebe',
  fruehere_reiseerfahrung: 'Frühere Reiseerfahrung',
  manuell: 'Manuell hinzugefügt',
}

/** Fallback für eine unbekannte/ältere Kategorie -- category ist auf DB-Ebene bewusst ungebundenes TEXT, keine CHECK-Constraint. */
export function packingCategoryLabel(category: string | null): string {
  if (category && (PACKING_CATEGORY_ORDER as string[]).includes(category)) return PACKING_CATEGORY_LABELS[category as PackingCategory]
  return category ?? 'Sonstiges'
}

export type PackingItem = {
  id: string
  tripId: string
  personId: string | null
  label: string
  category: string | null
  quantity: number
  status: PackingStatus
  luggageAssignment: LuggageAssignment
  isEssential: boolean
  reasoning: string | null
  source: PackingSource
  sourceKey: string | null
  note: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type PackingItemRow = {
  id: string; trip_id: string; person_id: string | null; label: string; category: string | null
  quantity: number; status: string; luggage_assignment: string; is_essential: boolean
  reasoning: string | null; source: string; source_key: string | null; note: string | null
  sort_order: number; created_at: string; updated_at: string
}

const PACKING_ITEM_SELECT = 'id, trip_id, person_id, label, category, quantity, status, luggage_assignment, is_essential, reasoning, source, source_key, note, sort_order, created_at, updated_at'

function mapRow(row: PackingItemRow): PackingItem {
  return {
    id: row.id, tripId: row.trip_id, personId: row.person_id, label: row.label, category: row.category,
    quantity: row.quantity, status: row.status as PackingStatus, luggageAssignment: row.luggage_assignment as LuggageAssignment,
    isEssential: row.is_essential, reasoning: row.reasoning, source: row.source as PackingSource, sourceKey: row.source_key,
    note: row.note, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function loadPackingItems(supabase: SupabaseClient, tripId: string): Promise<PackingItem[]> {
  const { data } = await supabase
    .from('packing_items')
    .select(PACKING_ITEM_SELECT)
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return ((data ?? []) as PackingItemRow[]).map(mapRow)
}

export type PackingProgress = {
  total: number
  packed: number
  toBuy: number
  unassignedLuggage: number
  openEssential: number
}

/** §"Fortschritt muss transparent aus den tatsächlichen Packlisteneinträgen berechnet werden, kein subjektiver KI-Score" (Nutzervorgabe, wörtlich) -- reine Aggregation, "nicht benötigt" zählt nie mit. */
export function computePackingProgress(items: PackingItem[]): PackingProgress {
  const relevant = items.filter((i) => i.status !== 'nicht_benoetigt')
  return {
    total: relevant.length,
    packed: relevant.filter((i) => i.status === 'eingepackt').length,
    toBuy: relevant.filter((i) => i.status === 'noch_besorgen').length,
    unassignedLuggage: relevant.filter((i) => i.luggageAssignment === 'unassigned').length,
    openEssential: relevant.filter((i) => i.isEssential && i.status !== 'eingepackt').length,
  }
}

export function computePackingProgressByPerson(items: PackingItem[], personIds: string[]): Map<string, PackingProgress> {
  const byPerson = new Map<string, PackingProgress>()
  for (const personId of personIds) {
    byPerson.set(personId, computePackingProgress(items.filter((i) => i.personId === personId)))
  }
  return byPerson
}

/** §"Vor der Abfahrt prüfen" (Nutzervorgabe): abgeleitet, keine eigene Datenspur -- essentielle, noch nicht eingepackte Gegenstände kurz vor Reisebeginn. */
export const PRE_DEPARTURE_WINDOW_DAYS = 2

export function isPreDepartureItem(item: PackingItem): boolean {
  return item.isEssential && item.status !== 'eingepackt' && item.status !== 'nicht_benoetigt'
}
