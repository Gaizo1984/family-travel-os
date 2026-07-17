import { createClient } from './supabase/server'
import { generateConciergeAnswer } from './concierge-ai'
import type { ConciergeLink } from './concierge'

export type CachedConciergeMessage = {
  questionKey: string
  questionText: string
  title: string
  body: string
  eventTitle: string
  links: ConciergeLink[]
  createdAt: string
  stale: boolean
}

type StoredActions = { event_title?: string; links?: ConciergeLink[] }[]

/** Normalisiert Freitext-Fragen für den Cache-Schlüssel (Groß-/Kleinschreibung, Leerraum) — keine "neue Frage" nur wegen Tippweise. */
export function normalizeQuestionKey(questionText: string): string {
  return questionText.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
}

/** §"Bei Änderungen Hinweis 'Empfehlung aktualisieren' statt automatisch neu zu rechnen": Fingerprint aus den volatilen Signalen (Wetter, bekannter Plan spiegelt Journey/Buchungen bereits wider). */
export function buildContextFingerprint(weatherSummary: string | null, knownPlanText: string): string {
  return `${weatherSummary ?? ''}||${knownPlanText}`
}

/** Liest alle heutigen Concierge-Nachrichten dieser Reise (oder, bei `tripId=null`, des Allgemein-Modus), neueste zuerst — inkl. Stale-Markierung bei geänderten Rahmenbedingungen. */
export async function listTodayConciergeMessages(
  familyId: string,
  tripId: string | null,
  forDate: string,
  currentFingerprint: string,
): Promise<CachedConciergeMessage[]> {
  const supabase = await createClient()
  let query = supabase
    .from('concierge_messages')
    .select('question_key, question_text, answer_title, answer_body, actions, context_fingerprint, created_at')
    .eq('family_id', familyId)
    .eq('for_date', forDate)
  query = tripId ? query.eq('trip_id', tripId) : query.is('trip_id', null)
  const { data } = await query.order('created_at', { ascending: false })

  return (data ?? []).map((row) => {
    const actions = (row.actions as unknown as StoredActions) ?? []
    return {
      questionKey: row.question_key,
      questionText: row.question_text,
      title: row.answer_title,
      body: row.answer_body,
      eventTitle: actions[0]?.event_title ?? row.answer_title,
      links: actions[0]?.links ?? [],
      createdAt: row.created_at,
      stale: row.context_fingerprint !== null && row.context_fingerprint !== currentFingerprint,
    }
  })
}

export async function getCachedConciergeMessage(
  familyId: string, tripId: string, forDate: string, questionKey: string,
): Promise<CachedConciergeMessage | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('concierge_messages')
    .select('question_key, question_text, answer_title, answer_body, actions, created_at')
    .eq('family_id', familyId).eq('trip_id', tripId).eq('for_date', forDate).eq('question_key', questionKey)
    .maybeSingle()

  if (!data) return null
  const actions = (data.actions as unknown as StoredActions) ?? []
  return {
    questionKey: data.question_key,
    questionText: data.question_text,
    title: data.answer_title,
    body: data.answer_body,
    eventTitle: actions[0]?.event_title ?? data.answer_title,
    links: actions[0]?.links ?? [],
    createdAt: data.created_at,
    stale: false,
  }
}

/** Generiert (KI) und speichert (upsert) — für die erste Antwort auf eine Frage und für "Änderung prüfen"/Regenerieren gleichermaßen. */
export async function generateAndCacheConciergeMessage(
  familyId: string,
  tripId: string | null,
  forDate: string,
  questionKey: string,
  questionText: string,
  context: {
    dateLabel: string
    locationLabel: string
    weatherSummary: string | null
    knownPlanText: string
    highlightTitle: string | null
    memberNames: string[]
  },
  isRegenerate: boolean,
): Promise<CachedConciergeMessage | null> {
  const result = await generateConciergeAnswer({ questionText, ...context, isRegenerate })
  if (!result) return null

  const fingerprint = buildContextFingerprint(context.weatherSummary, context.knownPlanText)
  const supabase = await createClient()
  const { data } = await supabase.from('concierge_messages').upsert(
    {
      family_id: familyId,
      trip_id: tripId,
      for_date: forDate,
      question_key: questionKey,
      question_text: questionText,
      answer_title: result.title,
      answer_body: result.body,
      actions: [{ event_title: result.eventTitle }],
      context_fingerprint: fingerprint,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'family_id,trip_id,for_date,question_key' },
  ).select('created_at').single()

  return {
    questionKey, questionText, title: result.title, body: result.body,
    eventTitle: result.eventTitle, links: [], createdAt: data?.created_at ?? new Date().toISOString(), stale: false,
  }
}
