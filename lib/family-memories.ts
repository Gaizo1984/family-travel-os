import { createClient } from './supabase/server'
import type { Json } from './supabase/types'
import type { LumiBrainIntent } from './lumi-brain-intent'

/**
 * §"Kontrolliertes LUMI Memory" (Nutzervorgabe): strukturierte Kategorien und
 * Werte, Freitext nur als kurze lesbare Zusammenfassung -- niemals der
 * gesamte Bestand ungefiltert an OpenAI. Diese Datei ist die EINE Quelle für
 * Lesen/Formatieren/Relevanzfilter; Schreiben (bestätigen/ablehnen/löschen)
 * läuft über lib/actions/family-memories.ts.
 */

export type MemoryType = 'confirmed_preference' | 'observed_pattern' | 'trip_specific_preference' | 'family_member_preference' | 'experience'
export type MemoryStatus = 'pending' | 'confirmed' | 'declined'

export type FamilyMemory = {
  id: string
  familyId: string
  personId: string | null
  tripId: string | null
  memoryType: MemoryType
  category: string
  structuredValue: Record<string, unknown>
  summary: string
  source: string
  status: MemoryStatus
  priority: number | null
  validUntil: string | null
  createdAt: string
  updatedAt: string
}

type MemoryRow = {
  id: string; family_id: string; person_id: string | null; trip_id: string | null
  memory_type: string; category: string; structured_value: Json; summary: string
  source: string; status: string; priority: number | null; valid_until: string | null
  created_at: string; updated_at: string
}

const MEMORY_SELECT = 'id, family_id, person_id, trip_id, memory_type, category, structured_value, summary, source, status, priority, valid_until, created_at, updated_at'

function mapRow(row: MemoryRow): FamilyMemory {
  return {
    id: row.id, familyId: row.family_id, personId: row.person_id, tripId: row.trip_id,
    memoryType: row.memory_type as MemoryType, category: row.category,
    structuredValue: (row.structured_value as Record<string, unknown>) ?? {},
    summary: row.summary, source: row.source, status: row.status as MemoryStatus,
    priority: row.priority, validUntil: row.valid_until, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

/** Für die "Unsere Vorlieben"-Seite -- alle Einträge einer Familie, optional nach Status gefiltert. */
export async function listFamilyMemories(familyId: string, status?: MemoryStatus): Promise<FamilyMemory[]> {
  const supabase = await createClient()
  let query = supabase.from('family_memories').select(MEMORY_SELECT).eq('family_id', familyId)
  if (status) query = query.eq('status', status)
  const { data } = await query.order('updated_at', { ascending: false })
  return ((data ?? []) as MemoryRow[]).map(mapRow)
}

/**
 * §"Relevanz- und Kontextfilter für Memory, niemals den gesamten
 * Memory-Bestand ungefiltert an OpenAI senden" (Nutzervorgabe): Mapping von
 * LUMI-Brain-Intent auf relevante Kategorien -- exakt die drei im Dokument
 * genannten Fälle (Hotelfrage/Flugfrage/Tagesplanung) plus sinnvolle
 * Ergänzung für Familienfit. `'all'` nur für Inspiration (dort ist genau die
 * Bandbreite bisheriger Erfahrungen gefragt).
 */
export const MEMORY_CATEGORIES_BY_INTENT: Record<string, string[] | 'all'> = {
  reise_check: [],
  familienfit: ['pace', 'activity', 'family_member_preference'],
  vergleich_hotel: ['hotel'],
  vergleich_flight: ['flight'],
  vergleich_general: ['hotel', 'flight'],
  journey_support: ['pace', 'activity', 'interest'],
  inspiration: 'all',
}

/** Übersetzt einen erkannten LUMI-Brain-Intent in den Kategorie-Schlüssel für MEMORY_CATEGORIES_BY_INTENT. */
export function memoryCategoriesForIntent(intent: LumiBrainIntent): string[] | 'all' {
  if (intent.type === 'vergleich') return MEMORY_CATEGORIES_BY_INTENT[`vergleich_${intent.subject}`] ?? []
  return MEMORY_CATEGORIES_BY_INTENT[intent.type] ?? []
}

const MAX_RELEVANT_MEMORIES = 8

/** Nur bestätigte Einträge, nur die für den Intent relevanten Kategorien, hart begrenzt -- Token-/Kostenkontrolle. */
export async function loadRelevantMemories(familyId: string, categories: string[] | 'all'): Promise<FamilyMemory[]> {
  if (categories !== 'all' && categories.length === 0) return []

  const supabase = await createClient()
  let query = supabase.from('family_memories').select(MEMORY_SELECT).eq('family_id', familyId).eq('status', 'confirmed')
  if (categories !== 'all') query = query.in('category', categories)

  const { data } = await query
    .order('priority', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(MAX_RELEVANT_MEMORIES)
  return ((data ?? []) as MemoryRow[]).map(mapRow)
}

/** Kurzer Fließtext fürs Prompt -- nur `summary` (nie `structured_value` roh), analog `formatFamilyDnaForPrompt`. */
export function formatMemoriesForPrompt(memories: FamilyMemory[]): string {
  if (memories.length === 0) return ''
  return `Bekannte, bestätigte Vorlieben/Erfahrungen: ${memories.map((m) => m.summary).join('; ')}.`
}

/**
 * §"Ablehnung wird respektiert und nicht erneut aggressiv vorgeschlagen"
 * (Nutzervorgabe): einfacher, bewusst simpler Abgleich (exakter, case-
 * insensitiver Summary-Vergleich derselben Kategorie) -- keine Fuzzy-/
 * Ähnlichkeitslogik, die neue Fehlerquellen schaffen würde.
 */
export async function hasDeclinedSimilarMemory(familyId: string, category: string, summary: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('family_memories')
    .select('id')
    .eq('family_id', familyId)
    .eq('category', category)
    .eq('status', 'declined')
    .ilike('summary', summary)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export type MemoryCandidateInput = {
  familyId: string
  personId?: string | null
  tripId?: string | null
  memoryType: MemoryType
  category: string
  structuredValue?: Record<string, unknown>
  summary: string
  source: string
}

/** Legt einen NEUEN Kandidaten mit status='pending' an -- niemals 'confirmed' (das macht ausschließlich die explizite Bestätigung, siehe lib/actions/family-memories.ts). */
export async function createPendingMemoryCandidate(input: MemoryCandidateInput): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('family_memories').insert({
    family_id: input.familyId,
    person_id: input.personId ?? null,
    trip_id: input.tripId ?? null,
    memory_type: input.memoryType,
    category: input.category,
    structured_value: (input.structuredValue ?? {}) as Json,
    summary: input.summary,
    source: input.source,
    status: 'pending',
  }).select('id').single()

  if (error) {
    console.error('[family_memories] Anlegen fehlgeschlagen:', error.message)
    return null
  }
  return data.id
}
