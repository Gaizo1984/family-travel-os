import OpenAI from 'openai'

// Gemeinsames Modell mit den übrigen KI-Flows (receipt-extraction, trip-idea-generation, content-idea-generation).
const OPENAI_MODEL = 'gpt-5.4'

export type TodayRecommendation = {
  daySummary: string
  mainRecommendation: { title: string; description: string }
  alternatives: [{ title: string; description: string }, { title: string; description: string }]
}

const TODAY_SCHEMA = {
  type: 'object',
  properties: {
    day_summary: {
      type: 'string',
      description: 'Kurze, warme Zusammenfassung des heutigen Reisetags in 1-2 Sätzen, für die Hero-Sektion',
    },
    main_recommendation: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Kurzer Titel für die empfohlene Tagesgestaltung' },
        description: { type: 'string', description: '1-2 Sätze Begründung/Beschreibung' },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
    alternatives: {
      type: 'array',
      description: 'Genau zwei kleinere Alternativen zur Hauptempfehlung',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['title', 'description'],
        additionalProperties: false,
      },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['day_summary', 'main_recommendation', 'alternatives'],
  additionalProperties: false,
}

/**
 * Ein Aufruf pro Seitenaufruf (kein Persistenz-/Review-Gate wie bei Content-
 * oder Reiseideen, da rein tagesaktueller Vorschlag ohne Weiterverarbeitung).
 * Gibt bei fehlendem API-Key oder jedem Fehler `null` zurück — die Seite
 * rendert dann ohne KI-Sektion, statt abzustürzen.
 */
export async function generateTodayRecommendation(context: {
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  familyDnaText: string
  knownPlanText: string
}): Promise<TodayRecommendation | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const prompt = `Ihr plant den heutigen Tag (${context.dateLabel}) einer Familienreise in ${context.locationLabel}.
${context.weatherSummary ? `Wetter heute: ${context.weatherSummary}.` : 'Wetterdaten nicht verfügbar.'}
${context.familyDnaText || 'Keine weiteren Familienpräferenzen hinterlegt.'}
Bereits bekannter Plan für heute: ${context.knownPlanText || 'Noch nichts Festes geplant.'}

Schlage eine sinnvolle, zur Familie und zum Wetter passende Tagesgestaltung vor: eine Hauptempfehlung und zwei kleinere Alternativen. Widerspreche NICHT dem bereits bekannten Plan, ergänze ihn sinnvoll. Erfinde keine konkreten Preise, Öffnungszeiten oder Adressen — bleibe bei allgemeinen, plausiblen Vorschlägen. Schreibe auf Deutsch, warm und konkret, keine Floskeln.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'today_recommendation', schema: TODAY_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    return {
      daySummary: parsed.day_summary,
      mainRecommendation: parsed.main_recommendation,
      alternatives: parsed.alternatives,
    }
  } catch {
    return null
  }
}
