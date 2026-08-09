'use server'

import OpenAI from 'openai'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { createPendingMemoryCandidate } from '@/lib/family-memories'
import { PACKING_FEEDBACK_TYPE_LABELS, type PackingFeedbackType } from '@/lib/trip-debriefs'

/**
 * §"Aus einem einzelnen Feedback darf nicht ungefragt eine allgemeine Regel
 * entstehen ... erst nach wiederholten vergleichbaren Erfahrungen einen
 * Vorschlag erzeugen" (Nutzervorgabe, wörtlich) -- exaktes Vorbild
 * lib/actions/activity-preference-learning.ts (MIN_ACTIVITIES_FOR_PATTERN,
 * Cooldown, KI-Themenerkennung, hasExistingActiveTheme-Dedup), 1:1 auf
 * Packlisten-Feedback über mehrere ABGESCHLOSSENE Reisen übertragen. Läuft
 * best-effort nach `confirmDebrief` (lib/actions/trip-debriefs.ts), niemals
 * blockierend.
 *
 * §"Personenbezogene und familienweite Erkenntnisse getrennt speichern"
 * (Nutzervorgabe, wörtlich): läuft getrennt je `person_id` (inkl. `null` =
 * "Gemeinsam") -- ein Wasserschuh-Muster bei Elias löst keinen
 * familienweiten Vorschlag aus und umgekehrt.
 */
const OPENAI_MODEL = 'gpt-5.4'
const DECLINED_PACKING_THEME_COOLDOWN_DAYS = 60
const MIN_TRIPS_FOR_PACKING_PATTERN = 3

/** §"Widersprüchliche Erfahrungen erzeugen keinen Lernvorschlag" (Nutzervorgabe, wörtlich): "unused" und "missing"/"too_few" für dasselbe grobe Thema werden bewusst NICHT gemeinsam geprüft (siehe getrennte Aufrufe je kind unten) -- ein Widerspruch innerhalb eines einzelnen kind lässt die KI selbst erkennen (theme=null, wie bei activity-preference-learning). */
const INSIGHT_LABEL_BY_KIND: Record<PackingFeedbackType, string> = {
  missing: 'immer hinzufügen',
  too_few: 'Menge erhöhen',
  too_many: 'Menge reduzieren',
  unused: 'optional anzeigen statt automatisch vorzuschlagen',
  provided_by_accommodation: 'vorher Hotelausstattung prüfen statt automatisch einzupacken',
  always_pack: 'immer hinzufügen',
}

const THEME_SCHEMA = {
  type: 'object',
  properties: {
    theme: {
      type: ['string', 'null'],
      description: 'Kurze, konkrete Gegenstandsbezeichnung oder Themenbeschreibung (2-5 Wörter, z. B. "Wasserschuhe", "Regenschutz für Wanderungen") NUR wenn mindestens 3 der Notizen klar zum selben Gegenstand/Thema passen -- sonst null. Bündle nur inhaltlich wirklich Gleiches, kein pauschales Thema wie "Kleidung".',
    },
    matching_notes: {
      type: 'array', items: { type: 'string' },
      description: 'Die Notizen aus der Liste, die zum erkannten Thema passen. Leeres Array, wenn theme null ist.',
    },
  },
  required: ['theme', 'matching_notes'],
  additionalProperties: false,
}

function buildPrompt(kindLabel: string, notes: string[], recentlyDeclinedThemes: string[]): string {
  const notesList = notes.map((n) => `- ${n}`).join('\n')
  const declinedText = recentlyDeclinedThemes.length > 0
    ? `\n\nDiese Themen wurden von der Familie kürzlich bereits abgelehnt -- schlage sie NICHT erneut vor, auch nicht sinngemäß ähnlich formuliert:\n${recentlyDeclinedThemes.map((t) => `- ${t}`).join('\n')}`
    : ''

  return `Hier sind Packlisten-Rückmeldungen einer Familie über mehrere Reisen hinweg, alle vom Typ "${kindLabel}" (echte Notizen, nichts hinzufügen):
${notesList}

Prüfe: gibt es unter diesen Notizen einen klar erkennbaren, KONKRETEN gemeinsamen Gegenstand oder ein sehr spezifisches Thema, dem MINDESTENS 3 der Notizen zuzuordnen sind (auch wenn unterschiedlich formuliert, z. B. "Wasserschuhe" und "Schuhe für den Strand")? Das Thema muss konkret genug sein, um eine echte Packliste-Regel zu begründen -- kein pauschales "Kleidung" oder "Ausrüstung".

Wenn die Notizen kein klares Muster zeigen, widersprüchlich sind oder nur eine zufällige Mischung ohne erkennbaren Schwerpunkt darstellen: gib theme=null zurück. Erzwinge niemals ein Muster.${declinedText}`
}

async function loadRecentlyDeclinedThemes(familyId: string, personId: string | null): Promise<string[]> {
  const lumiCore = await createLumiCoreClient()
  const cutoff = new Date(Date.now() - DECLINED_PACKING_THEME_COOLDOWN_DAYS * 86400000).toISOString()
  let query = lumiCore
    .from('travel_memories')
    .select('structured_value')
    .eq('household_id', familyId)
    .eq('category', 'packing')
    .eq('status', 'declined')
    .gte('updated_at', cutoff)
  query = personId ? query.eq('household_member_id', personId) : query.is('household_member_id', null)
  const { data } = await query

  return (data ?? [])
    .map((r) => (r.structured_value as Record<string, unknown> | null)?.theme)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
}

async function hasExistingActiveTheme(familyId: string, personId: string | null, theme: string): Promise<boolean> {
  const lumiCore = await createLumiCoreClient()
  let query = lumiCore
    .from('travel_memories')
    .select('id')
    .eq('household_id', familyId)
    .eq('category', 'packing')
    .in('status', ['pending', 'confirmed'])
    .eq('structured_value->>theme', theme)
  query = personId ? query.eq('household_member_id', personId) : query.is('household_member_id', null)
  const { data } = await query.limit(1)
  return (data?.length ?? 0) > 0
}

type RawFeedbackRow = { trip_id: string | null; structured_value: Record<string, unknown> | null }

/**
 * §"Erst nach wiederholten vergleichbaren Erfahrungen" (Nutzervorgabe): läuft
 * je (person_id, feedback_type) getrennt -- über die bereits vorhandenen,
 * direkt aus dem Nachreise-Dialog erzeugten `family_memories`-Zeilen
 * (Kategorie `packing`, `source: 'nachreise_dialog'`), keine zweite
 * Speicherung des rohen Feedbacks nötig (lib/trip-debriefs.ts erzeugt diese
 * Zeilen bereits pro einzelnem Feedback-Eintrag).
 */
export async function maybeSuggestPackingPreference(familyId: string, personId: string | null): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return

  const lumiCore = await createLumiCoreClient()
  let query = lumiCore
    .from('travel_memories')
    .select('trip_id, structured_value')
    .eq('household_id', familyId)
    .eq('category', 'packing')
    .eq('source', 'nachreise_dialog')
    .in('status', ['pending', 'confirmed'])
  query = personId ? query.eq('household_member_id', personId) : query.is('household_member_id', null)
  const { data: rowsRaw } = await query
  const rows = (rowsRaw ?? []) as RawFeedbackRow[]

  const byKind = new Map<PackingFeedbackType, { notes: string[]; tripIds: Set<string> }>()
  for (const row of rows) {
    const kind = row.structured_value?.kind as PackingFeedbackType | undefined
    const note = row.structured_value?.note as string | undefined
    if (!kind || !note || !(kind in INSIGHT_LABEL_BY_KIND) || !row.trip_id) continue
    const entry = byKind.get(kind) ?? { notes: [], tripIds: new Set<string>() }
    entry.notes.push(note)
    entry.tripIds.add(row.trip_id)
    byKind.set(kind, entry)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  for (const [kind, { notes, tripIds }] of byKind) {
    if (tripIds.size < MIN_TRIPS_FOR_PACKING_PATTERN) continue

    const recentlyDeclinedThemes = await loadRecentlyDeclinedThemes(familyId, personId)

    let theme: string | null = null
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [{ role: 'user', content: [{ type: 'input_text', text: buildPrompt(PACKING_FEEDBACK_TYPE_LABELS[kind], notes, recentlyDeclinedThemes) }] }],
        text: { format: { type: 'json_schema', name: 'packing_theme', schema: THEME_SCHEMA, strict: true } },
      })
      const parsed = JSON.parse(response.output_text) as { theme: string | null; matching_notes: string[] }
      if (parsed.theme && parsed.matching_notes.length >= MIN_TRIPS_FOR_PACKING_PATTERN) theme = parsed.theme
    } catch (e) {
      console.error('[packing-preference-learning] KI-Klassifikation fehlgeschlagen:', e)
      continue
    }

    if (!theme) continue
    if (await hasExistingActiveTheme(familyId, personId, theme)) continue

    const insightLabel = INSIGHT_LABEL_BY_KIND[kind]
    await createPendingMemoryCandidate({
      familyId, personId, tripId: null,
      memoryType: personId ? 'family_member_preference' : 'confirmed_preference',
      category: 'packing',
      structuredValue: { theme, kind, insight: insightLabel, source: 'packing_pattern' },
      summary: `${theme}: ${insightLabel} (wiederholt bei mehreren Reisen gemeldet)`,
      source: 'packing_pattern',
    })
  }
}
