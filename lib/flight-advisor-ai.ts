import OpenAI from 'openai'
import type { FlightSearchOption, CheckedBaggageStatus } from '@/lib/flight-types'

const BAGGAGE_STATUS_TEXT: Record<CheckedBaggageStatus, string> = {
  included: 'Aufgabegepäck inklusive',
  partial: 'Gepäck teilweise inklusive',
  none: 'kein Aufgabegepäck enthalten',
  not_verified: 'Gepäck nicht verifiziert',
}

/** Gleiches Modell wie die übrigen KI-Flows (concierge, trip-idea-generation, trip-idea-advisor). */
const OPENAI_MODEL = 'gpt-5.4'

const FLIGHT_REASONING_SCHEMA_ITEMS = {
  type: 'object',
  properties: {
    option_id: { type: 'string', description: 'EXAKT die id aus der Kandidatenliste, zum Rückabgleich.' },
    reasoning: {
      type: 'string',
      description: 'Kurze Begründung (max. ca. 20 Wörter), AUSSCHLIESSLICH gestützt auf Preis, Gesamtreisezeit, Umstiege und Gepäck aus der Kandidatenliste sowie die Reisebriefing-Präferenzen. Keine erfundenen Fakten, keine neuen Zahlen.',
    },
  },
  required: ['option_id', 'reasoning'],
  additionalProperties: false,
}

function buildFlightReasoningSchema(count: number) {
  return {
    type: 'object',
    properties: {
      flights: { type: 'array', minItems: count, maxItems: count, items: FLIGHT_REASONING_SCHEMA_ITEMS },
    },
    required: ['flights'],
    additionalProperties: false,
  }
}

export type FlightReasoning = { optionId: string; reasoning: string }

/**
 * §"LUMI Flight Score: keine subjektiven Bewertungen, KI erfindet nichts":
 * Rang/Badges stehen bereits fest (siehe `FlightScoringService`, läuft
 * VOR diesem Aufruf) -- die KI liefert nur eine kurze, an die bereits
 * feststehenden Fakten gebundene Begründung je Flug, niemals Zahlen oder
 * eine eigene Rangfolge. Rückabgleich per `option_id`, jede Antwort ohne
 * echten Treffer wird verworfen (gleiches Prinzip wie bei der
 * Hotel-Shortlist). Bewusst nur für eine begrenzte Kandidatenzahl gedacht
 * (Aufrufer entscheidet, z. B. Top-N je Badge), um Kosten zu begrenzen.
 */
export async function generateFlightReasoning(context: {
  options: Array<Pick<FlightSearchOption, 'id' | 'price' | 'currency' | 'totalDurationMinutes' | 'maxStopCount' | 'checkedBaggageStatus' | 'badges'>>
  familyDnaText: string
  stopoverPreference: string | null
}): Promise<FlightReasoning[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'flight_reasoning' })
    return null
  }
  if (context.options.length === 0) return null

  const optionsText = context.options
    .map((o) => {
      const hours = Math.floor(o.totalDurationMinutes / 60)
      const minutes = o.totalDurationMinutes % 60
      return `- ${o.id}: Preis ${o.price} ${o.currency}, Gesamtreisezeit ${hours}h${minutes ? ` ${minutes}min` : ''}, ${o.maxStopCount} Umstieg(e), ${BAGGAGE_STATUS_TEXT[o.checkedBaggageStatus]}, Badges: ${o.badges.join(', ') || 'keine'}`
    })
    .join('\n')

  const prompt = `Du bist Reiseberater für eine Familie und erklärst kurz, warum bestimmte Flugverbindungen zu ihr passen.
${context.familyDnaText || 'Keine besonderen Präferenzen bekannt.'}
${context.stopoverPreference ? `Anreise-Präferenz: ${context.stopoverPreference}.` : ''}

Echte Flugkandidaten (bereits real gesucht und nach Preis/Reisezeit/Umstiegen/Gepäck bewertet -- die Bewertung/Reihenfolge steht bereits fest, du änderst sie nicht):
${optionsText}

Gib für JEDEN Flug eine kurze, ehrliche Begründung zurück, ausschließlich gestützt auf die oben genannten Fakten. Erfinde keine Ausstattungsmerkmale, keine Zahlen, keine Verfügbarkeiten.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'flight_reasoning', schema: buildFlightReasoningSchema(context.options.length), strict: true } },
    })
    const parsed = JSON.parse(response.output_text) as { flights: Array<{ option_id: string; reasoning: string }> }
    return parsed.flights.map((f) => ({ optionId: f.option_id, reasoning: f.reasoning }))
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'flight_reasoning', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}
