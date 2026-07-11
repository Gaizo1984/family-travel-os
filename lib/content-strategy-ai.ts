import OpenAI from 'openai'

// Gemeinsames Modell mit den übrigen KI-Flows.
const OPENAI_MODEL = 'gpt-5.4'

export type ContentStrategy = {
  contentType: string
  reasoning: string
  storyline: string
  shotlist: string[]
  bestTime: string
  effort: string
}

const CONTENT_STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    content_type: { type: 'string', description: 'Konkreter Content-Typ, z. B. "Reel", "Carousel", "Foto-Story", "Einzelfoto"' },
    reasoning: {
      type: 'string',
      description: 'Warum genau das HEUTE die beste Content-Strategie ist — konkret bezogen auf Wetter, bekannten Tagesplan oder ein erkanntes Highlight, keine Floskeln, 2-3 Sätze.',
    },
    storyline: { type: 'string', description: 'Kurzer roter Faden/Erzählbogen für den Content, 1-2 Sätze.' },
    shotlist: {
      type: 'array',
      description: 'Konkrete, umsetzbare Einzelaufnahmen/Szenen in sinnvoller Reihenfolge.',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 6,
    },
    best_time: { type: 'string', description: 'Beste Tageszeit fürs Filmen/Fotografieren, konkret, z. B. "17:30 Uhr, goldene Stunde am Strand".' },
    effort: { type: 'string', enum: ['gering', 'mittel', 'hoch'], description: 'Geschätzter Aufwand für die Familie, diesen Content umzusetzen.' },
  },
  required: ['content_type', 'reasoning', 'storyline', 'shotlist', 'best_time', 'effort'],
  additionalProperties: false,
}

/**
 * §"Vom Ideengenerator zum Content Director": statt mehrerer generischer
 * Ideen genau EINE, auf den heutigen Tag zugeschnittene Strategie — wird vom
 * Aufrufer in content_strategies zwischengespeichert (lib/content-strategy.ts),
 * "Andere Strategie" überschreibt den Tages-Eintrag gezielt neu.
 */
export async function generateContentStrategy(context: {
  dateLabel: string
  locationLabel: string
  weatherSummary: string | null
  knownPlanText: string
  highlightTitle: string | null
  regenerate: boolean
}): Promise<ContentStrategy | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const highlightInstruction = context.highlightTitle
    ? `Es gibt heute ein besonderes Ereignis: "${context.highlightTitle}" — priorisiere dieses als Content-Anlass.`
    : 'Kein besonderes Kalender-Ereignis erkannt — leite die Strategie aus Wetter, Standort und bekanntem Tagesplan ab (z. B. Sonnenuntergang, wenn das Wetter dafür geeignet ist).'

  const prompt = `Du bist der Content Director dieser Familienreise für heute (${context.dateLabel}) in ${context.locationLabel}.
${context.weatherSummary ? `Wetter heute: ${context.weatherSummary}.` : 'Wetterdaten nicht verfügbar.'}
Bereits bekannter Tagesplan: ${context.knownPlanText || 'Noch nichts Festes geplant.'}
${highlightInstruction}
${context.regenerate ? 'Die Familie möchte eine ANDERE Strategie als zuvor — schlage eine spürbar unterschiedliche Herangehensweise vor.' : ''}

Entwickle GENAU EINE konkrete, umsetzbare Content-Strategie für heute — keine mehreren konkurrierenden Vorschläge. Erfinde keine konkreten Preise, Öffnungszeiten oder Orte, die nicht gegeben sind. Schreibe auf Deutsch, konkret und direkt umsetzbar.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'content_strategy', schema: CONTENT_STRATEGY_SCHEMA, strict: true } },
    })

    const parsed = JSON.parse(response.output_text)
    return {
      contentType: parsed.content_type,
      reasoning: parsed.reasoning,
      storyline: parsed.storyline,
      shotlist: parsed.shotlist,
      bestTime: parsed.best_time,
      effort: parsed.effort,
    }
  } catch {
    return null
  }
}
