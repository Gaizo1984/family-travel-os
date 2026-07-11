import OpenAI from 'openai'

// Gemeinsames Modell mit den übrigen KI-Flows (receipt-extraction, trip-idea-generation, content-idea-generation).
const OPENAI_MODEL = 'gpt-5.4'

export type TodayRecommendation = {
  daySummary: string
  recommendation: { title: string; description: string }
  alternative: { title: string; description: string } | null
}

const TODAY_SCHEMA = {
  type: 'object',
  properties: {
    day_summary: {
      type: 'string',
      description: 'SEHR kurze, warme Zusammenfassung des heutigen Reisetags für die Hero-Sektion — maximal 3-4 kurze Zeilen (ca. 25-30 Wörter). Details gehören NICHT hierhin, sondern in recommendation.',
    },
    recommendation: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Kurzer Titel für die empfohlene Tagesgestaltung' },
        description: {
          type: 'string',
          description: 'Konkrete Beschreibung mit ungefähren Uhrzeiten/Tageszeiten und benannten Aktivitätsarten (kein vages Fließ-Geschwafel) — 70 bis 90 Wörter, nicht mehr.',
        },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
    alternative: {
      type: 'object',
      description: 'GENAU EINE klar benannte Alternative zur Hauptempfehlung, für den Fall dass sich Wetter oder Familienlaune ändern — keine zweite konkurrierende Hauptoption, sondern ein bewusst anders gearteter Plan B.',
      properties: {
        title: { type: 'string', description: 'Kurzer Titel für die Alternative' },
        description: { type: 'string', description: 'Kurze Beschreibung, 30-50 Wörter, nicht mehr.' },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
  },
  required: ['day_summary', 'recommendation', 'alternative'],
  additionalProperties: false,
}

/**
 * §"Nur eine Hauptempfehlung anzeigen – keine drei konkurrierenden Vorschläge":
 * genau EIN Aufruf pro Kalendertag (Ergebnis wird vom Aufrufer in
 * today_recommendations zwischengespeichert, siehe lib/actions/today-recommendation.ts).
 * Gibt bei fehlendem API-Key oder jedem Fehler `null` zurück — die Seite
 * rendert dann ohne KI-Sektion, statt abzustürzen.
 */
export async function generateTodayRecommendation(context: {
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  familyDnaText: string
  knownPlanText: string
  highlightTitle: string | null
  dayStyle: string | null
}): Promise<TodayRecommendation | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const focusInstruction = context.highlightTitle
    ? `Im heutigen Plan steht bereits ein besonderes Highlight: "${context.highlightTitle}". Baue deine Empfehlung UM DIESES Highlight herum (z. B. sinnvolle Vor-/Nachbereitung, Timing drumherum) — erfinde KEINE konkurrierende Alternative dazu.`
    : context.dayStyle
      ? `Die Familie hat sich heute für den Tagesstil "${context.dayStyle}" entschieden — richte deine Empfehlung konsequent danach aus.`
      : 'Kein besonderes Highlight bekannt und kein Tagesstil gewählt — schlage etwas Ausgewogenes vor, das zur Familie passt.'

  const prompt = `Du bist der persönliche Reise-Concierge dieser Familie für den heutigen Tag (${context.dateLabel}) in ${context.locationLabel}.
${context.weatherSummary ? `Wetter heute: ${context.weatherSummary}.` : 'Wetterdaten nicht verfügbar.'}
${context.familyDnaText || 'Keine weiteren Familienpräferenzen hinterlegt.'}
Bereits bekannter Plan für heute: ${context.knownPlanText || 'Noch nichts Festes geplant.'}
${focusInstruction}

Sprich die Familie direkt und persönlich an, wie ein Concierge, der ihre Reise wirklich kennt — konkret, warm, ohne Floskeln, keine drei konkurrierenden Optionen, nur EINE klare Hauptempfehlung. Widerspreche NICHT dem bereits bekannten Plan, ergänze ihn sinnvoll. Erfinde keine konkreten Preise, Öffnungszeiten oder Adressen — bleibe bei allgemeinen, plausiblen Vorschlägen. Schreibe auf Deutsch. day_summary bleibt extrem kurz (maximal 3-4 Zeilen), alle Details gehören in recommendation.description (70-90 Wörter, mit ungefähren Uhrzeiten/Tageszeiten, kein vages Geschwafel). Ergänze zusätzlich GENAU EINE Alternative (alternative.title/alternative.description, 30-50 Wörter) für den Fall, dass sich Wetter oder Laune ändern — z. B. drinnen statt draußen, ruhiger statt aktiv — bewusst anders als die Hauptempfehlung, aber ebenfalls konkret statt vage.`

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
      recommendation: parsed.recommendation,
      alternative: parsed.alternative ?? null,
    }
  } catch {
    return null
  }
}
