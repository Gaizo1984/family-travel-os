import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * §"Nachreise-Dialog... schrittweise und nicht wie ein langes Formular"
 * (Nutzervorgabe): eine feste Schrittfolge, serverseitig als
 * `trip_debriefs.current_step` gemerkt -- ermöglicht "später fortsetzen"
 * geräte-/sitzungsübergreifend (siehe lib/actions/trip-debriefs.ts).
 */
export const DEBRIEF_STEPS = [
  'intro',
  'hotel_rating',
  'best_moment',
  'worst_moment',
  'person_highlights',
  'would_revisit',
  'highlight_photos',
  'packing_feedback',
  'summary',
] as const

export type DebriefStep = (typeof DEBRIEF_STEPS)[number]

export const DEBRIEF_STEP_LABELS: Record<DebriefStep, string> = {
  intro: 'Start',
  hotel_rating: 'Unterkunft',
  best_moment: 'Schönstes Erlebnis',
  worst_moment: 'Verbesserungspotenzial',
  person_highlights: 'Persönliche Highlights',
  would_revisit: 'Wiederbesuch',
  highlight_photos: 'Highlight-Fotos',
  packing_feedback: 'Packliste',
  summary: 'Zusammenfassung',
}

export function nextDebriefStep(step: DebriefStep): DebriefStep | null {
  const i = DEBRIEF_STEPS.indexOf(step)
  return i >= 0 && i < DEBRIEF_STEPS.length - 1 ? DEBRIEF_STEPS[i + 1] : null
}

export function previousDebriefStep(step: DebriefStep): DebriefStep | null {
  const i = DEBRIEF_STEPS.indexOf(step)
  return i > 0 ? DEBRIEF_STEPS[i - 1] : null
}

export type DebriefStatus = 'active' | 'completed' | 'skipped' | 'closed'

export type DebriefAnswers = {
  hotel_rating?: { rating: number; note?: string }
  best_moment?: { text: string }
  worst_moment?: { text: string }
  person_highlights?: Record<string, string>
  would_revisit?: { value: 'yes' | 'no' | 'maybe' }
  packing_feedback?: { missing?: string; unnecessary?: string; always_pack?: string; person_id?: string }
}

export type TripDebrief = {
  id: string
  familyId: string
  tripId: string
  status: DebriefStatus
  currentStep: DebriefStep
  answers: DebriefAnswers
}

type DebriefRow = {
  id: string; family_id: string; trip_id: string; status: string
  current_step: string | null; answers: Record<string, unknown>
}

function mapRow(row: DebriefRow): TripDebrief {
  return {
    id: row.id, familyId: row.family_id, tripId: row.trip_id, status: row.status as DebriefStatus,
    currentStep: (row.current_step as DebriefStep) ?? 'intro',
    answers: (row.answers ?? {}) as DebriefAnswers,
  }
}

/** Höchstens ein aktiver Dialog je Reise (Migration erzwingt das per partiellem Unique-Index) -- für die Anzeige reicht daher `maybeSingle`. */
export async function loadActiveDebrief(supabase: SupabaseClient, tripId: string): Promise<TripDebrief | null> {
  const { data } = await supabase
    .from('trip_debriefs')
    .select('id, family_id, trip_id, status, current_step, answers')
    .eq('trip_id', tripId)
    .eq('status', 'active')
    .maybeSingle()
  return data ? mapRow(data as DebriefRow) : null
}

/** Für einen Dashboard-Hinweis "ihr habt einen offenen Rückblick" -- über alle Reisen der Familie. */
export async function loadActiveDebriefsForFamily(supabase: SupabaseClient, familyId: string): Promise<TripDebrief[]> {
  const { data } = await supabase
    .from('trip_debriefs')
    .select('id, family_id, trip_id, status, current_step, answers')
    .eq('family_id', familyId)
    .eq('status', 'active')
  return ((data ?? []) as DebriefRow[]).map(mapRow)
}

export type DebriefMemoryCandidate = {
  personId: string | null
  category: string
  memoryType: 'confirmed_preference' | 'family_member_preference'
  summary: string
  structuredValue: Record<string, unknown>
}

/**
 * §"Kontrolliertes Lernen" (Nutzervorgabe): reine, seiteneffektfreie Regel-
 * Funktion -- welche Nachreise-Antworten ein anerkanntes, wiederholbares
 * Vorlieben-Muster erfüllen und deshalb einen bestätigungspflichtigen
 * family_memories-Vorschlag rechtfertigen. Von der Zusammenfassungs-Seite
 * (Vorschau, "was wird vorgeschlagen") UND von confirmDebrief (tatsächliches
 * Anlegen, lib/actions/trip-debriefs.ts) gemeinsam genutzt -- keine zweite
 * Kopie derselben Regeln.
 */
export function buildDebriefMemoryCandidates(
  tripTitle: string, answers: DebriefAnswers, participants: Array<{ id: string; name: string }>,
): DebriefMemoryCandidate[] {
  const candidates: DebriefMemoryCandidate[] = []

  if (answers.hotel_rating && answers.hotel_rating.rating >= 4) {
    candidates.push({
      personId: null, category: 'hotel', memoryType: 'confirmed_preference',
      summary: `Familie bewertete die Unterkunft bei "${tripTitle}" mit ${answers.hotel_rating.rating}/5${answers.hotel_rating.note ? ` (${answers.hotel_rating.note})` : ''}`,
      structuredValue: { tripTitle, rating: answers.hotel_rating.rating, note: answers.hotel_rating.note ?? null },
    })
  }

  if (answers.would_revisit) {
    const label = answers.would_revisit.value === 'yes' ? 'würde wieder hinreisen' : answers.would_revisit.value === 'no' ? 'würde nicht wieder hinreisen' : 'ist unentschlossen bei einem erneuten Besuch'
    candidates.push({
      personId: null, category: 'hotel', memoryType: 'confirmed_preference',
      summary: `Familie ${label} nach "${tripTitle}"`,
      structuredValue: { tripTitle, wouldRevisit: answers.would_revisit.value },
    })
  }

  // §"Elias mochte diese eine Bootstour darf nicht automatisch zu einer
  // dauerhaften allgemeinen Vorliebe werden" (Nutzervorgabe, wörtlich): eine
  // einzelne Nachreise-Antwort pro Person wird trotzdem als Vorschlag
  // angelegt (Transparenz), ABER klar als einzelne Beobachtung EINER Reise
  // formuliert, nicht als "mag X generell" -- anders als der
  // activity-preference-learning-Pfad (der erst nach mind. 3 Buchungen ein
  // generelles Thema ableitet) bestätigt hier der Mensch selbst, was in die
  // Zusammenfassung kommt, es wird kein Muster erfunden.
  for (const [personId, text] of Object.entries(answers.person_highlights ?? {})) {
    const person = participants.find((p) => p.id === personId)
    if (!person || !text) continue
    candidates.push({
      personId, category: 'activity', memoryType: 'family_member_preference',
      summary: `${person.name} mochte bei "${tripTitle}" besonders: ${text}`,
      structuredValue: { tripTitle, note: text },
    })
  }

  // §"Nachreise-Dialog speist kontrolliert in die Packliste zurück" (Nutzervorgabe):
  // wie bei person_highlights bestätigt hier der Mensch selbst im Dialog, was in
  // die Zusammenfassung kommt -- kein Mehrfach-Reisen-Gate für diese drei Felder
  // (anders als der zukünftige automatische Mehrfach-Reisen-Mustererkenner,
  // lib/actions/packing-preference-learning.ts, Fast-Follow, noch nicht gebaut).
  if (answers.packing_feedback) {
    const { missing, unnecessary, always_pack, person_id } = answers.packing_feedback
    const person = person_id ? participants.find((p) => p.id === person_id) : null
    const personId = person?.id ?? null
    const personPrefix = person ? `${person.name}: ` : ''

    if (missing) {
      candidates.push({
        personId, category: 'packing', memoryType: person ? 'family_member_preference' : 'confirmed_preference',
        summary: `${personPrefix}Bei "${tripTitle}" hat gefehlt: ${missing}`,
        structuredValue: { tripTitle, kind: 'missing', note: missing },
      })
    }
    if (unnecessary) {
      candidates.push({
        personId, category: 'packing', memoryType: person ? 'family_member_preference' : 'confirmed_preference',
        summary: `${personPrefix}Bei "${tripTitle}" war unnötig eingepackt: ${unnecessary}`,
        structuredValue: { tripTitle, kind: 'unnecessary', note: unnecessary },
      })
    }
    if (always_pack) {
      candidates.push({
        personId, category: 'packing', memoryType: person ? 'family_member_preference' : 'confirmed_preference',
        summary: `${personPrefix}Sollte künftig immer mit: ${always_pack}`,
        structuredValue: { tripTitle, kind: 'always_pack', note: always_pack },
      })
    }
  }

  return candidates
}
