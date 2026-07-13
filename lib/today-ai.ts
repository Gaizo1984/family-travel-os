import OpenAI from 'openai'

// Gemeinsames Modell mit den übrigen KI-Flows (receipt-extraction, trip-idea-generation, content-idea-generation).
const OPENAI_MODEL = 'gpt-5.4'

export type TodayRecommendationPart = {
  title: string; description: string
  /** Qualitativ ("Vormittag", "nach dem Frühstück") -- bewusst KEINE erfundene exakte Uhrzeit ohne Datengrundlage. */
  suggestedTimeWindow: string
  /** Kurzer Wetterbezug ("passt gut zum sonnigen Vormittag", "Alternative für den angekündigten Regen"). */
  weatherFit: string
}

export type TodayRecommendation = {
  daySummary: string
  recommendation: TodayRecommendationPart
  alternative: TodayRecommendationPart | null
}

const RECOMMENDATION_PART_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Kurzer Titel' },
    description: { type: 'string', description: 'Konkrete Beschreibung, kein vages Fließ-Geschwafel.' },
    suggested_time_window: { type: 'string', description: 'Grobe Tageszeit in Worten (z. B. "Vormittag", "nach dem Frühstück") -- keine erfundene exakte Uhrzeit.' },
    weather_fit: { type: 'string', description: 'Kurzer Satz, wie die Empfehlung zum genannten Wetter passt.' },
  },
  required: ['title', 'description', 'suggested_time_window', 'weather_fit'],
  additionalProperties: false,
}

const TODAY_SCHEMA = {
  type: 'object',
  properties: {
    day_summary: {
      type: 'string',
      description: 'SEHR kurze, warme Zusammenfassung des heutigen Reisetags für die Hero-Sektion — maximal 3-4 kurze Zeilen (ca. 25-30 Wörter). Details gehören NICHT hierhin, sondern in recommendation.',
    },
    recommendation: {
      ...RECOMMENDATION_PART_SCHEMA,
      description: 'Die Hauptempfehlung für die empfohlene Tagesgestaltung, description 70-90 Wörter.',
    },
    alternative: {
      ...RECOMMENDATION_PART_SCHEMA,
      description: 'GENAU EINE klar benannte Alternative zur Hauptempfehlung, für den Fall dass sich Wetter oder Familienlaune ändern — bewusst anders gearteter Plan B, description 30-50 Wörter.',
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

Sprich die Familie direkt und persönlich an, wie ein Concierge, der ihre Reise wirklich kennt — konkret, warm, ohne Floskeln, keine drei konkurrierenden Optionen, nur EINE klare Hauptempfehlung. Widerspreche NICHT dem bereits bekannten Plan, ergänze ihn sinnvoll. Erfinde keine konkreten Preise, Öffnungszeiten, Adressen oder exakten Uhrzeiten — bleibe bei allgemeinen, plausiblen Vorschlägen und groben Tageszeiten (suggested_time_window, z. B. "Vormittag", nicht "10:15 Uhr"). Schreibe auf Deutsch. day_summary bleibt extrem kurz (maximal 3-4 Zeilen), alle Details gehören in recommendation.description (70-90 Wörter, kein vages Geschwafel). weather_fit ist ein kurzer Satz, wie die jeweilige Option zum genannten Wetter passt. Ergänze zusätzlich GENAU EINE Alternative (30-50 Wörter) für den Fall, dass sich Wetter oder Laune ändern — z. B. drinnen statt draußen, ruhiger statt aktiv — bewusst anders als die Hauptempfehlung, aber ebenfalls konkret statt vage.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'today_recommendation', schema: TODAY_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    const toPart = (p: any): TodayRecommendationPart => ({
      title: p.title, description: p.description, suggestedTimeWindow: p.suggested_time_window, weatherFit: p.weather_fit,
    })
    return {
      daySummary: parsed.day_summary,
      recommendation: toPart(parsed.recommendation),
      alternative: parsed.alternative ? toPart(parsed.alternative) : null,
    }
  } catch {
    return null
  }
}
