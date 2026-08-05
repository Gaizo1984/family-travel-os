import type { SupabaseClient } from '@supabase/supabase-js'

export type PackingStatus = 'offen' | 'eingepackt' | 'noch_besorgen' | 'nicht_benoetigt'
/** §"3-stufige Priorität statt Ja/Nein" (Nutzervorgabe, Packliste 2.0): ersetzt das bisherige `is_essential`-Boolean, keine zweite überlappende Skala. */
export type PackingPriority = 'unverzichtbar' | 'empfohlen' | 'optional'
/** §"'Noch prüfen' ist kein Prioritätswert" (Nutzervorgabe, wörtlich): eigenständiges, filterbares Feld statt nur in `reasoning`-Text eingebettet (wie in 1.0). */
export type NeedsCheck = 'baggage_allowance' | 'hotel_amenity' | 'airline_rule'
export type LuggageAssignment = 'personal_item' | 'hand_luggage' | 'checked_luggage' | 'stroller_or_separate' | 'unassigned'
export type PackingSource = 'basisliste' | 'wetter' | 'aktivitaet' | 'buchung' | 'hotel' | 'bestaetigte_vorliebe' | 'fruehere_reiseerfahrung' | 'manuell'
export type PackingCategory =
  | 'dokumente' | 'kleidung' | 'schuhe' | 'hygiene' | 'medikamente_und_gesundheit' | 'technik'
  | 'handgepaeck' | 'strand_und_pool' | 'sport_und_aktivitaeten' | 'kinder_und_baby'
  | 'unterhaltung' | 'snacks' | 'gemeinsam' | 'sonstiges'

export const PACKING_STATUS_ORDER: PackingStatus[] = ['offen', 'eingepackt', 'noch_besorgen', 'nicht_benoetigt']
export const PACKING_STATUS_LABELS: Record<PackingStatus, string> = {
  offen: 'Offen',
  eingepackt: 'Eingepackt',
  noch_besorgen: 'Noch besorgen',
  nicht_benoetigt: 'Nicht benötigt',
}

export const PACKING_PRIORITY_ORDER: PackingPriority[] = ['unverzichtbar', 'empfohlen', 'optional']
export const PACKING_PRIORITY_LABELS: Record<PackingPriority, string> = {
  unverzichtbar: 'Unverzichtbar',
  empfohlen: 'Empfohlen',
  optional: 'Optional',
}

export const NEEDS_CHECK_ORDER: NeedsCheck[] = ['baggage_allowance', 'hotel_amenity', 'airline_rule']
export const NEEDS_CHECK_LABELS: Record<NeedsCheck, string> = {
  baggage_allowance: 'Gepäckfreigrenze prüfen',
  hotel_amenity: 'Hotel-Ausstattung prüfen',
  airline_rule: 'Airline-/Sicherheitsregel prüfen',
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
  'dokumente', 'kleidung', 'schuhe', 'hygiene', 'medikamente_und_gesundheit', 'technik',
  'handgepaeck', 'strand_und_pool', 'sport_und_aktivitaeten', 'kinder_und_baby',
  'unterhaltung', 'snacks', 'gemeinsam', 'sonstiges',
]
export const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  dokumente: 'Dokumente und Reiseunterlagen',
  kleidung: 'Kleidung',
  schuhe: 'Schuhe',
  hygiene: 'Hygiene',
  medikamente_und_gesundheit: 'Medikamente und Gesundheit',
  technik: 'Technik und Ladegeräte',
  handgepaeck: 'Handgepäck',
  strand_und_pool: 'Strand und Pool',
  sport_und_aktivitaeten: 'Sport und Aktivitäten',
  kinder_und_baby: 'Kinder und Baby',
  unterhaltung: 'Unterhaltung',
  snacks: 'Snacks und Reiseverpflegung',
  gemeinsam: 'Gemeinsame Reiseausstattung',
  sonstiges: 'Sonstiges',
}

/** §"Sicherheitskritische Inhalte niemals automatisch entfernen" (Nutzervorgabe, wörtlich: Reisepässe/Dokumente, notwendige Medikamente) -- von computeRegenerationDiff genutzt, um diese Kategorien vom "nicht mehr erforderlich"-Bucket auszuschließen, unabhängig vom KI-Output. */
export const SAFETY_CRITICAL_CATEGORIES: PackingCategory[] = ['dokumente', 'medikamente_und_gesundheit']

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
  luggageId: string | null
  weightGrams: number | null
  priority: PackingPriority
  needsCheck: NeedsCheck | null
  isLastMinute: boolean
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
  quantity: number; status: string; luggage_assignment: string; luggage_id: string | null; weight_grams: number | null
  priority: string; needs_check: string | null; is_last_minute: boolean
  reasoning: string | null; source: string; source_key: string | null; note: string | null
  sort_order: number; created_at: string; updated_at: string
}

const PACKING_ITEM_SELECT = 'id, trip_id, person_id, label, category, quantity, status, luggage_assignment, luggage_id, weight_grams, priority, needs_check, is_last_minute, reasoning, source, source_key, note, sort_order, created_at, updated_at'

function mapRow(row: PackingItemRow): PackingItem {
  return {
    id: row.id, tripId: row.trip_id, personId: row.person_id, label: row.label, category: row.category,
    quantity: row.quantity, status: row.status as PackingStatus, luggageAssignment: row.luggage_assignment as LuggageAssignment,
    luggageId: row.luggage_id, weightGrams: row.weight_grams,
    priority: row.priority as PackingPriority, needsCheck: row.needs_check as NeedsCheck | null, isLastMinute: row.is_last_minute,
    reasoning: row.reasoning, source: row.source as PackingSource, sourceKey: row.source_key,
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
  openMustHave: number
  openHandLuggage: number
  openLastMinute: number
  openNeedsCheck: number
}

/** §"Fortschritt muss transparent aus den tatsächlichen Packlisteneinträgen berechnet werden, kein subjektiver KI-Score" (Nutzervorgabe, wörtlich) -- reine Aggregation, "nicht benötigt" zählt nie mit. */
export function computePackingProgress(items: PackingItem[]): PackingProgress {
  const relevant = items.filter((i) => i.status !== 'nicht_benoetigt')
  const openNotPacked = (i: PackingItem) => i.status !== 'eingepackt'
  return {
    total: relevant.length,
    packed: relevant.filter((i) => i.status === 'eingepackt').length,
    toBuy: relevant.filter((i) => i.status === 'noch_besorgen').length,
    unassignedLuggage: relevant.filter((i) => i.luggageAssignment === 'unassigned').length,
    openMustHave: relevant.filter((i) => i.priority === 'unverzichtbar' && openNotPacked(i)).length,
    openHandLuggage: relevant.filter((i) => i.luggageAssignment === 'hand_luggage' && openNotPacked(i)).length,
    openLastMinute: relevant.filter((i) => i.isLastMinute && openNotPacked(i)).length,
    openNeedsCheck: relevant.filter((i) => i.needsCheck !== null).length,
  }
}

export function computePackingProgressByPerson(items: PackingItem[], personIds: string[]): Map<string, PackingProgress> {
  const byPerson = new Map<string, PackingProgress>()
  for (const personId of personIds) {
    byPerson.set(personId, computePackingProgress(items.filter((i) => i.personId === personId)))
  }
  return byPerson
}

/** §"Vor der Abfahrt prüfen" (Nutzervorgabe): abgeleitet, keine eigene Datenspur -- unverzichtbare, noch nicht eingepackte Gegenstände kurz vor Reisebeginn. */
export const PRE_DEPARTURE_WINDOW_DAYS = 2

export function isPreDepartureItem(item: PackingItem): boolean {
  return item.priority === 'unverzichtbar' && item.status !== 'eingepackt' && item.status !== 'nicht_benoetigt'
}

/** §"Zuletzt einpacken... zusätzlich in einem kompakten Abreise-Check anzeigen" (Nutzervorgabe, wörtlich): eigenständig von "Vor der Abfahrt prüfen" -- dort zählt Priorität, hier ausschließlich das Zuletzt-Flag, unabhängig von der Priorität des Gegenstands. */
export function isLastMinuteOpenItem(item: PackingItem): boolean {
  return item.isLastMinute && item.status !== 'eingepackt' && item.status !== 'nicht_benoetigt'
}

export type PackingLuggage = {
  id: string
  tripId: string
  personId: string | null
  label: string
  allowedWeightGrams: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type PackingLuggageRow = {
  id: string; trip_id: string; person_id: string | null; label: string
  allowed_weight_grams: number | null; sort_order: number; created_at: string; updated_at: string
}

function mapLuggageRow(row: PackingLuggageRow): PackingLuggage {
  return {
    id: row.id, tripId: row.trip_id, personId: row.person_id, label: row.label,
    allowedWeightGrams: row.allowed_weight_grams, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function loadPackingLuggage(supabase: SupabaseClient, tripId: string): Promise<PackingLuggage[]> {
  const { data } = await supabase
    .from('packing_luggage')
    .select('id, trip_id, person_id, label, allowed_weight_grams, sort_order, created_at, updated_at')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: true })
  return ((data ?? []) as PackingLuggageRow[]).map(mapLuggageRow)
}

export type LuggageWeightSummary = {
  itemCount: number
  /** §"Gewichtsschätzungen müssen klar als Schätzung gekennzeichnet sein" (Nutzervorgabe): reine Summe aus item.weightGrams × quantity, niemals ein erfundener Wert -- Items ohne weightGrams tragen 0 bei, siehe hasUnknownWeights. */
  estimatedWeightGrams: number
  hasUnknownWeights: boolean
  allowedWeightGrams: number | null
  remainingGrams: number | null
}

export function computeLuggageWeightSummary(items: PackingItem[], luggage: PackingLuggage): LuggageWeightSummary {
  const assigned = items.filter((i) => i.luggageId === luggage.id && i.status !== 'nicht_benoetigt')
  const estimatedWeightGrams = assigned.reduce((sum, i) => sum + (i.weightGrams ?? 0) * i.quantity, 0)
  const hasUnknownWeights = assigned.some((i) => i.weightGrams === null)
  return {
    itemCount: assigned.length,
    estimatedWeightGrams,
    hasUnknownWeights,
    allowedWeightGrams: luggage.allowedWeightGrams,
    remainingGrams: luggage.allowedWeightGrams !== null ? luggage.allowedWeightGrams - estimatedWeightGrams : null,
  }
}
