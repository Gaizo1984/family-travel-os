'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createPendingMemoryCandidate } from '@/lib/family-memories'

/**
 * §"LUMI darf aus einer einzelnen Teilnahme nicht direkt eine dauerhafte
 * Vorliebe ableiten -- erst nach mehreren passenden Aktivitäten... einen
 * Memory-Vorschlag erzeugen" (Nutzervorgabe, mehrfach präzisiert: "mindestens
 * 3 passende Aktivitäten derselben Person in einer ähnlichen Kategorie").
 * Läuft best-effort nach einer neu angelegten Aktivitätsbuchung
 * (lib/actions/bookings.ts::createBooking) -- niemals bei reinem Bearbeiten,
 * niemals blockierend für das eigentliche Speichern der Buchung.
 */
const OPENAI_MODEL = 'gpt-5.4'

/** §"Abgelehnte ähnliche Vorschläge für eine angemessene Zeit nicht erneut anzeigen" (Nutzervorgabe, wörtlich) -- benannte, leicht anpassbare Konstante statt eines vergrabenen Magic Numbers. */
const DECLINED_ACTIVITY_THEME_COOLDOWN_DAYS = 60

/** §"Mindestens 3 passende Aktivitäten" (Nutzervorgabe, wörtlich) -- unterhalb dieser Schwelle lohnt sich nicht einmal der KI-Aufruf, ein Muster ist per Definition nicht möglich. */
const MIN_ACTIVITIES_FOR_PATTERN = 3

const THEME_SCHEMA = {
  type: 'object',
  properties: {
    theme: {
      type: ['string', 'null'],
      description: 'Kurze, spezifische Themenbeschreibung (2-5 Wörter, z. B. "Tier- und Naturaktivitäten", "Wassersportaktivitäten") NUR wenn mindestens 3 der Titel klar dazu passen -- sonst null. Kein pauschales Thema wie "Aktivitäten" oder "Ausflüge".',
    },
    matching_titles: {
      type: 'array', items: { type: 'string' },
      description: 'Die Titel aus der Liste, die zum erkannten Thema passen. Leeres Array, wenn theme null ist.',
    },
  },
  required: ['theme', 'matching_titles'],
  additionalProperties: false,
}

function buildPrompt(personName: string, activityTitles: string[], recentlyDeclinedThemes: string[]): string {
  const titlesList = activityTitles.map((t) => `- ${t}`).join('\n')
  const declinedText = recentlyDeclinedThemes.length > 0
    ? `\n\nDiese Themen wurden von der Familie kürzlich bereits abgelehnt -- schlage sie NICHT erneut vor, auch nicht sinngemäß ähnlich formuliert:\n${recentlyDeclinedThemes.map((t) => `- ${t}`).join('\n')}`
    : ''

  return `Hier sind alle bisherigen Aktivitäts-Buchungstitel von ${personName} auf Familienreisen (echte Daten, nichts hinzufügen):
${titlesList}

Prüfe: gibt es unter diesen Titeln ein klar erkennbares, spezifisches gemeinsames Thema, dem MINDESTENS 3 der Titel zuzuordnen sind? Berücksichtige dabei die Art/Kategorie der Aktivität (nicht nur, dass überhaupt teilgenommen wurde). Inhaltlich sehr ähnliche Themen darfst du sinnvoll bündeln (z. B. Schnorcheln und Tauchen als "Wassersportaktivitäten"), aber nicht zu grob -- das Thema muss spezifisch genug sein, um eine echte Vorliebe zu beschreiben, kein pauschales "mag Aktivitäten".

Wenn die Titel kein klares Muster zeigen, widersprüchlich sind oder nur eine zufällige Mischung ohne erkennbaren Schwerpunkt darstellen: gib theme=null zurück. Erzwinge niemals ein Muster.${declinedText}`
}

/**
 * Lädt kürzlich abgelehnte Themen dieser Person (innerhalb des Cooldowns) --
 * werden der KI als Negativbeispiele mitgegeben (§"ähnliche ... nicht erneut",
 * semantischer Abgleich durch die KI selbst statt einer separaten, fragilen
 * Ähnlichkeits-Heuristik).
 */
async function loadRecentlyDeclinedThemes(familyId: string, personId: string): Promise<string[]> {
  const supabase = await createClient()
  const cutoff = new Date(Date.now() - DECLINED_ACTIVITY_THEME_COOLDOWN_DAYS * 86400000).toISOString()
  const { data } = await supabase
    .from('family_memories')
    .select('structured_value')
    .eq('family_id', familyId)
    .eq('person_id', personId)
    .eq('category', 'activity')
    .eq('status', 'declined')
    .gte('updated_at', cutoff)

  return (data ?? [])
    .map((r) => (r.structured_value as Record<string, unknown> | null)?.theme)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
}

/** §"Keine Duplikate": ein bereits vorhandener pending/confirmed Vorschlag zum exakt selben Thema für dieselbe Person wird nicht doppelt angelegt (unabhängig vom Cooldown -- das betrifft nur Ablehnungen). */
async function hasExistingActiveTheme(familyId: string, personId: string, theme: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('family_memories')
    .select('id')
    .eq('family_id', familyId)
    .eq('person_id', personId)
    .eq('category', 'activity')
    .in('status', ['pending', 'confirmed'])
    .eq('structured_value->>theme', theme)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function maybeSuggestActivityPreference(familyId: string, personId: string, personName: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return

  const supabase = await createClient()
  // §"bookings" hat keine eigene family_id-Spalte und keine tatsächlich
  // familien-scopende RLS-Policy (siehe supabase/migrations/20260708000003_dev_rls_policies.sql:
  // "dev_select"/"dev_write" mit USING (true)) -- deshalb hier bewusst über
  // die Reisen der Familie eingegrenzt, statt mich auf RLS zu verlassen.
  const { data: familyTrips } = await supabase.from('trips').select('id').eq('family_id', familyId)
  const familyTripIds = (familyTrips ?? []).map((t) => t.id)
  if (familyTripIds.length === 0) return

  const { data: rows } = await supabase
    .from('bookings')
    .select('title')
    .eq('type', 'activity')
    .in('trip_id', familyTripIds)
    .contains('participant_person_ids', [personId])

  const activityTitles = (rows ?? []).map((r) => r.title).filter((t): t is string => Boolean(t))
  if (activityTitles.length < MIN_ACTIVITIES_FOR_PATTERN) return

  const recentlyDeclinedThemes = await loadRecentlyDeclinedThemes(familyId, personId)

  let theme: string | null = null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: buildPrompt(personName, activityTitles, recentlyDeclinedThemes) }] }],
      text: { format: { type: 'json_schema', name: 'activity_theme', schema: THEME_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text) as { theme: string | null; matching_titles: string[] }
    if (parsed.theme && parsed.matching_titles.length >= MIN_ACTIVITIES_FOR_PATTERN) {
      theme = parsed.theme
    }
  } catch (e) {
    console.error('[activity-preference-learning] KI-Klassifikation fehlgeschlagen:', e)
    return
  }

  if (!theme) return
  if (await hasExistingActiveTheme(familyId, personId, theme)) return

  await createPendingMemoryCandidate({
    familyId, personId, tripId: null,
    memoryType: 'family_member_preference',
    category: 'activity',
    structuredValue: { theme, source: 'activity_pattern' },
    summary: `${personName} ${theme} besonders mag`,
    source: 'activity_pattern',
  })
}
