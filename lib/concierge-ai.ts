import OpenAI from 'openai'

const OPENAI_MODEL = 'gpt-5.4'

export type ConciergeAiResult = {
  title: string
  body: string
  /** Kurzer, konkreter Titel, geeignet als Journey-Termin, falls die Familie "In Journey übernehmen"/"Alternative speichern" wählt. */
  eventTitle: string
}

const CONCIERGE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Kurze, klare Kernaussage/Überschrift der Antwort — eine starke Empfehlung, keine Aufzählung von Optionen.' },
    body: { type: 'string', description: 'Konkrete Begründung/Ausführung, 50-90 Wörter, direkt und persönlich wie ein Reiseberater, keine Floskeln.' },
    event_title: { type: 'string', description: 'Kurzer, konkreter Titel (max. 8 Wörter) für einen möglichen Journey-Termin, falls die Familie diesen Vorschlag übernehmen möchte.' },
  },
  required: ['title', 'body', 'event_title'],
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
  if (!process.env.OPENAI_API_KEY) return null

  const prompt = `Du bist der persönliche Reise-Concierge dieser Familie (${context.memberNames.join(', ') || 'Familie'}) für den heutigen Tag (${context.dateLabel}) in ${context.locationLabel}.
${context.weatherSummary ? `Wetter heute: ${context.weatherSummary}.` : 'Wetterdaten nicht verfügbar.'}
Bereits bekannter Tagesplan: ${context.knownPlanText || 'Noch nichts Festes geplant.'}
${context.highlightTitle ? `Besonderes Ereignis heute: ${context.highlightTitle}.` : ''}
${context.isRegenerate ? 'Die Familie möchte eine andere/aktualisierte Antwort als zuvor.' : ''}

Frage der Familie: "${context.questionText}"

Antworte mit GENAU EINER starken, konkreten Empfehlung — keine Liste konkurrierender Optionen. Widerspreche nicht dem bereits bekannten Plan, ergänze ihn sinnvoll. Erfinde keine konkreten Preise, Öffnungszeiten oder Adressen. Schreibe auf Deutsch, direkt und persönlich, wie ein vertrauter Reiseberater — kurz, konkret, handlungsorientiert.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'concierge_answer', schema: CONCIERGE_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    return { title: parsed.title, body: parsed.body, eventTitle: parsed.event_title }
  } catch {
    return null
  }
}

export type FiveRecommendationsResult = { title: string; reason: string }[]

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
          title: { type: 'string', description: 'Name des empfohlenen Orts, exakt wie in der Liste der Places-Treffer.' },
          reason: { type: 'string', description: 'Kurze Begründung (max. 30 Wörter), warum das für diese Familie passt.' },
        },
        required: ['title', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
}

/**
 * §Developer-Bereich, Testmodul "OpenAI-Empfehlungen": nimmt eine bereits
 * vorhandene Liste von Places-Treffern (kein neuer Places-Aufruf) und lässt
 * daraus genau 5 familienpassende Empfehlungen auswählen/begründen -- eigene
 * Schema-Form (Array statt Einzelantwort), sonst gleicher Aufrufstil wie
 * `generateConciergeAnswer`. Nur auf ausdrücklichen Klick, nie automatisch.
 */
export async function generateFiveRecommendations(context: {
  locationLabel: string
  placeNames: string[]
  familyDnaText: string
}): Promise<FiveRecommendationsResult | null> {
  if (!process.env.OPENAI_API_KEY) return null
  if (context.placeNames.length === 0) return null

  const prompt = `Du bist der persönliche Reise-Concierge dieser Familie für ${context.locationLabel}.
${context.familyDnaText || 'Keine besonderen Präferenzen bekannt.'}

Hier ist eine Liste tatsächlich vor Ort verfügbarer Orte (Restaurants, Sehenswürdigkeiten, Strände, Naturziele):
${context.placeNames.map((n) => `- ${n}`).join('\n')}

Wähle genau 5 dieser Orte aus der Liste aus, die am besten zu dieser Familie passen, und begründe jede Wahl kurz. Erfinde keine neuen Orte, wähle ausschließlich aus der gegebenen Liste.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'five_recommendations', schema: FIVE_RECOMMENDATIONS_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    return parsed.recommendations
  } catch {
    return null
  }
}
