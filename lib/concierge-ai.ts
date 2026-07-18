import OpenAI from 'openai'
import type { MemoryCandidateSuggestion } from './family-memories'

const OPENAI_MODEL = 'gpt-5.4'

export type ConciergeAiResult = {
  title: string
  body: string
  /** Kurzer, konkreter Titel, geeignet als Journey-Termin, falls die Familie "In Journey übernehmen"/"Alternative speichern" wählt. */
  eventTitle: string
  /**
   * §"Frag-LUMI-Probleme beheben, Punkt 1" (Nutzervorgabe): dieser generische
   * Pfad bediente bisher NUR Schnellaktionen (Wetter anpassen/Alternative
   * finden) und Freitext-Fragen, die keinen der 5 LUMI-Brain-Intents treffen
   * (siehe lib/lumi-brain-intent.ts) -- z. B. eine reine Präferenz-Aussage
   * ohne Frageform ("Wir mögen keine riesigen Resorts..."). Ohne dieses Feld
   * ging jede dort geäußerte dauerhafte Vorliebe verloren. Gleiches Muster/
   * gleiche Vorsicht wie lib/lumi-brain-ai.ts::memory_candidate.
   */
  memoryCandidate: MemoryCandidateSuggestion | null
}

const MEMORY_CANDIDATE_INSTRUCTION = 'Prüfe zusätzlich: drückt der NUTZER im Fragetext selbst eine dauerhafte, wiederholbare Vorliebe oder Erfahrung aus (z.B. "wir mögen keine riesigen Resorts mit mehreren hundert Zimmern", "Direktflug ist uns einen Mehrpreis wert")? Falls ja, fülle memory_candidate strukturiert aus. Falls die Frage/Aussage nur eine normale Sachfrage ohne eine solche Aussage ist, setze memory_candidate auf null -- niemals eine Vorliebe erfinden, die nicht im Text steht.'

const CONCIERGE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Kurze, klare Kernaussage/Überschrift der Antwort — eine starke Empfehlung, keine Aufzählung von Optionen.' },
    body: { type: 'string', description: 'Konkrete Begründung/Ausführung, 50-90 Wörter, direkt und persönlich wie ein Reiseberater, keine Floskeln.' },
    event_title: { type: 'string', description: 'Kurzer, konkreter Titel (max. 8 Wörter) für einen möglichen Journey-Termin, falls die Familie diesen Vorschlag übernehmen möchte.' },
    memory_candidate: {
      type: ['object', 'null'],
      description: 'NUR befüllen, wenn der NUTZER im Fragetext selbst eine dauerhafte, wiederholbare Vorliebe oder Erfahrung ausdrückt (nicht die Antwort selbst) -- sonst null. Niemals eine Vorliebe erfinden, die nicht im Text steht.',
      properties: {
        memory_type: { type: 'string', enum: ['confirmed_preference', 'observed_pattern', 'trip_specific_preference', 'family_member_preference', 'experience'] },
        category: { type: 'string', description: 'z.B. hotel, flight, pace, activity, destination, interest' },
        summary: { type: 'string', description: 'Kurze, menschenlesbare Zusammenfassung (max. 20 Wörter), z.B. "Kleinere, individuellere Resorts bevorzugt".' },
      },
      required: ['memory_type', 'category', 'summary'],
      additionalProperties: false,
    },
  },
  required: ['title', 'body', 'event_title', 'memory_candidate'],
  additionalProperties: false,
}

/**
 * §"Eine starke Empfehlung statt vieler Optionen": genau EIN Aufruf pro Frage
 * (Ergebnis wird vom Aufrufer in concierge_messages zwischengespeichert,
 * siehe lib/concierge-context.ts). Gibt bei fehlendem API-Key oder Fehler
 * `null` zurück, statt die Seite abstürzen zu lassen.
 */
export async function generateConciergeAnswer(context: {
  questionText: string
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  knownPlanText: string
  highlightTitle: string | null
  memberNames: string[]
  isRegenerate: boolean
}): Promise<ConciergeAiResult | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'concierge_answer' })
    return null
  }

  const prompt = `Du bist der persönliche Reise-Concierge dieser Familie (${context.memberNames.join(', ') || 'Familie'}) für den heutigen Tag (${context.dateLabel}) in ${context.locationLabel}.
${context.weatherSummary ? `Wetter heute: ${context.weatherSummary}.` : 'Wetterdaten nicht verfügbar.'}
Bereits bekannter Tagesplan: ${context.knownPlanText || 'Noch nichts Festes geplant.'}
${context.highlightTitle ? `Besonderes Ereignis heute: ${context.highlightTitle}.` : ''}
${context.isRegenerate ? 'Die Familie möchte eine andere/aktualisierte Antwort als zuvor.' : ''}

Frage der Familie: "${context.questionText}"

Antworte mit GENAU EINER starken, konkreten Empfehlung — keine Liste konkurrierender Optionen. Widerspreche nicht dem bereits bekannten Plan, ergänze ihn sinnvoll. Erfinde keine konkreten Preise, Öffnungszeiten oder Adressen. Schreibe auf Deutsch, direkt und persönlich, wie ein vertrauter Reiseberater — kurz, konkret, handlungsorientiert.

${MEMORY_CANDIDATE_INSTRUCTION}`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'concierge_answer', schema: CONCIERGE_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    const memoryCandidate: MemoryCandidateSuggestion | null = parsed.memory_candidate
      ? { memoryType: parsed.memory_candidate.memory_type, category: parsed.memory_candidate.category, summary: parsed.memory_candidate.summary }
      : null
    return { title: parsed.title, body: parsed.body, eventTitle: parsed.event_title, memoryCandidate }
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'concierge_answer', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}

export type RecommendationCandidate = {
  name: string; category: string
  rating: number | null; userRatingCount: number | null; openNow: boolean | null
  durationMinutes: number | null; distanceKm: number | null
}
export type RecommendationFamilyMember = { name: string; age: number | null; isMinor: boolean }

export type AiRecommendationPick = {
  placeName: string; why: string
  kinderEignung: string; wetterEignung: string; tripLength: string; besondereHinweise: string
}
export type FiveRecommendationsResult = AiRecommendationPick[]

const FIVE_RECOMMENDATIONS_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          place_name: { type: 'string', description: 'Name des empfohlenen Orts, EXAKT wie in der gelieferten Kandidatenliste.' },
          why: { type: 'string', description: 'Kurze Begründung (max. 30 Wörter), warum das für diese Familie passt -- nur basierend auf den gelieferten Fakten.' },
          kinder_eignung: { type: 'string', description: 'Eignung für JEDES einzelne minderjährige Familienmitglied namentlich ansprechen. Falls ungeeignet: das ausdrücklich sagen und eine familiengeeignete Alternative AUS DER KANDIDATENLISTE nennen.' },
          wetter_eignung: { type: 'string', description: 'Kurze Einschätzung zur Wettertauglichkeit, basierend auf dem gelieferten Wetterkontext (falls vorhanden).' },
          trip_length: { type: 'string', description: 'Kurztrip, Halbtag oder Tagestrip -- abgeleitet aus der gelieferten Fahrzeit. Orte direkt am Hotel als einfache Nahoption kennzeichnen, nicht als großen Ausflug.' },
          besondere_hinweise: { type: 'string', description: 'Zusätzliche wichtige Hinweise, leerer String falls keine.' },
        },
        required: ['place_name', 'why', 'kinder_eignung', 'wetter_eignung', 'trip_length', 'besondere_hinweise'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
}

/**
 * §"OpenAI-Empfehlungen faktenbasiert machen": die KI wählt und bewertet
 * nur, harte Fakten (Fahrzeit, Entfernung, Bewertung, Öffnungsstatus)
 * liefert ausschließlich der Aufrufer aus bereits geladenen Places-/Routes-
 * Daten -- die KI gibt nur `place_name` (zum Rückabgleich) plus qualitative
 * Einschätzungen zurück, nie Zahlen. Das verhindert Zahlen-Halluzination
 * strukturell statt nur per Prompt-Bitte. Nur auf ausdrücklichen Klick.
 */
export async function generateFiveRecommendations(context: {
  locationLabel: string
  candidates: RecommendationCandidate[]
  familyDnaText: string
  members: RecommendationFamilyMember[]
  weatherSummary: string | null
}): Promise<FiveRecommendationsResult | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'five_recommendations' })
    return null
  }
  if (context.candidates.length === 0) return null

  const memberText = context.members.length > 0
    ? context.members.map((m) => `${m.name}${m.age !== null ? ` (${m.age} Jahre${m.isMinor ? ', minderjährig' : ''})` : ''}`).join(', ')
    : 'keine Familienmitglieder hinterlegt'

  const candidateText = context.candidates
    .map((c) => {
      const parts = [
        `${c.name} [${c.category}]`,
        c.rating !== null ? `Bewertung ${c.rating} (${c.userRatingCount ?? 0} Rezensionen)` : 'keine Bewertung bekannt',
        c.openNow !== null ? (c.openNow ? 'jetzt geöffnet' : 'jetzt geschlossen') : 'Öffnungsstatus unbekannt',
        c.durationMinutes !== null ? `${c.durationMinutes} Min Fahrzeit, ${c.distanceKm} km` : 'Fahrzeit unbekannt',
      ]
      return `- ${parts.join(', ')}`
    })
    .join('\n')

  const prompt = `Du bist der persönliche Reise-Concierge dieser Familie für ${context.locationLabel}.
${context.familyDnaText || 'Keine besonderen Präferenzen bekannt.'}
Familienmitglieder (jedes MUSS in kinder_eignung berücksichtigt werden, keines darf stillschweigend fehlen): ${memberText}.
${context.weatherSummary ? `Aktuelles Wetter: ${context.weatherSummary}.` : 'Kein Wetterkontext verfügbar.'}

Kandidaten (ausschließlich echte, bereits geprüfte Orte -- wähle NUR aus dieser Liste, erfinde nichts):
${candidateText}

Wähle genau 5 dieser Orte aus, die am besten zu dieser Familie passen. Regeln für trip_length: Fahrzeiten über 90 Minuten je Strecke sind kein normaler Ausflug mehr -- kennzeichne sie klar als Tagestrip, sinnvoll nur mit weiteren kombinierbaren Stopps. Orte mit sehr kurzer Fahrzeit (nahe am Hotel) sind eine einfache Nahoption, kein großer Ausflug. Gib place_name exakt wie in der Liste zurück, ohne Zusätze. Keine pauschalen Aussagen ohne Grundlage in den gelieferten Daten.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'five_recommendations', schema: FIVE_RECOMMENDATIONS_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    return parsed.recommendations.map((r: any) => ({
      placeName: r.place_name, why: r.why,
      kinderEignung: r.kinder_eignung, wetterEignung: r.wetter_eignung,
      tripLength: r.trip_length, besondereHinweise: r.besondere_hinweise,
    }))
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'five_recommendations', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}
