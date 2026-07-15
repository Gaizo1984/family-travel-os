import OpenAI from 'openai'
import { BUDGET_CATEGORY_ORDER, BUDGET_CATEGORY_LABELS, type BudgetCategory } from '@/lib/budget'
import { LUXURY_TIER_LABELS, type LuxuryHotelTier } from '@/lib/data/luxury-hotel-brands'

/** Gleiches Modell wie die übrigen KI-Flows (concierge, trip-idea-generation, content-sessions). */
const OPENAI_MODEL = 'gpt-5.4'

export type HotelCandidateFact = {
  name: string
  rating: number | null
  userRatingCount: number | null
  priceLevel: string | null
  transferMinutes: number | null
  address: string
  types: string[]
  /** §"Qualitativ neu kalibrieren": bereits VOR der KI deterministisch aus echten Fakten (Marke oder Bewertung+Preisniveau) bestimmt -- die KI ordnet nicht selbst ein, sie bekommt es nur als Kontext, um die Auswahl auszubalancieren. */
  tier: LuxuryHotelTier
}

export type HotelPick = {
  placeName: string
  familyFitReasoning: string
  styleImpression: string
  bestFor: string
  caveats: string
}

function buildHotelShortlistSchema(availableCount: number) {
  const minItems = Math.min(3, availableCount)
  const maxItems = Math.min(6, availableCount)
  return {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        minItems,
        maxItems,
        items: {
          type: 'object',
          properties: {
            place_name: { type: 'string', description: 'Name des Hotels, EXAKT wie in der Kandidatenliste.' },
            family_fit_reasoning: {
              type: 'string',
              description: 'Warum dieses Hotel zu genau dieser Familie passt -- NUR gestützt auf Name, Bewertung, Rezensionsanzahl, Preisklasse, Transferzeit, Adresse und Places-Typen aus der Kandidatenliste. Keine erfundenen Ausstattungsmerkmale (Kinderclub, Zimmer-/Villengröße, Pool, Strandlage, Restaurants etc.), die dort nicht stehen.',
            },
            style_impression: { type: 'string', description: 'Kurzer Stil-/Charaktereindruck (max. 15 Wörter), abgeleitet aus Name/Typen/Preisklasse -- keine erfundenen Details.' },
            best_for: { type: 'string', description: 'Für wen/welchen Reisetyp dieses Hotel am ehesten passt, z. B. "Paare" oder "Familien mit Kleinkindern" -- kurz.' },
            caveats: { type: 'string', description: 'Ehrliche Einschränkungen/Bedenken (z. B. lange Transferzeit, wenige Rezensionen, hohe Preisklasse) -- leerer String, wenn keine.' },
          },
          required: ['place_name', 'family_fit_reasoning', 'style_impression', 'best_for', 'caveats'],
          additionalProperties: false,
        },
      },
    },
    required: ['picks'],
    additionalProperties: false,
  }
}

/**
 * §"Reiseideen 2.0, Hotel-Shortlist": identisches Prinzip wie
 * `generateFiveRecommendations` (lib/concierge-ai.ts) -- die KI wählt und
 * bewertet nur, harte Fakten (Name, Bewertung, Preisklasse, Transferzeit)
 * liefert ausschließlich der Aufrufer aus bereits geladenen Places-/Routes-
 * Daten. Das Schema enthält bewusst keine Zahlen-/Faktenfelder, nur
 * Rückabgleich (`place_name`) plus qualitative Einschätzungen -- verhindert
 * Halluzination strukturell statt nur per Prompt-Bitte. Nur auf
 * ausdrücklichen Klick (siehe lib/actions/trip-idea-advisor.ts).
 */
export async function selectHotelShortlist(context: {
  destination: string
  familyDnaText: string
  candidates: HotelCandidateFact[]
}): Promise<HotelPick[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'hotel_shortlist' })
    return null
  }
  if (context.candidates.length === 0) return null

  const candidateText = context.candidates
    .map((c) => {
      const parts = [
        `Einordnung: ${LUXURY_TIER_LABELS[c.tier]}`,
        c.rating !== null ? `Bewertung ${c.rating} (${c.userRatingCount ?? 0} Rezensionen)` : 'keine Bewertung bekannt',
        c.priceLevel ? `Preisklasse ${c.priceLevel}` : 'Preisklasse unbekannt',
        c.transferMinutes !== null ? `${c.transferMinutes} Min Transferzeit` : 'Transferzeit unbekannt',
        `Adresse: ${c.address}`,
        `Typen: ${c.types.join(', ') || 'unbekannt'}`,
      ]
      return `- ${c.name}: ${parts.join(', ')}`
    })
    .join('\n')

  const prompt = `Du bist Reiseberater für eine Familie, die eine Reiseidee nach ${context.destination} entwickelt.
${context.familyDnaText || 'Keine besonderen Präferenzen bekannt.'}

Hotel-Kandidaten (ausschließlich echte, bereits über Google Places geprüfte Hotels, alle bereits auf gehobenes 5-Sterne-Niveau oder höher vorgefiltert -- wähle NUR aus dieser Liste, erfinde nichts):
${candidateText}

Wähle die passendsten dieser Hotels aus, die am besten zu dieser Familie passen, und ordne sie nach Passung (bestes zuerst). Achte auf eine ausgewogene Auswahl: Ultra-Luxus-Hotels dürfen vorkommen, sollen aber nicht die gesamte Auswahl dominieren, wenn auch Standard-/Premium-Kandidaten vorhanden sind -- bevorzuge insgesamt eine Mischung, die nicht ausschließlich aus Ultra-Luxus besteht. Gib place_name exakt wie in der Liste zurück, ohne Zusätze. Behaupte keine Ausstattungsmerkmale (Kinderclub, Zimmer-/Villengröße, Pool, Strandlage, Restaurants etc.), die nicht Teil der gelieferten Fakten sind -- stütze dich ausschließlich auf Name, Einordnung, Bewertung, Rezensionsanzahl, Preisklasse, Transferzeit, Adresse und Places-Typen. Sei auch ehrlich in caveats, wenn ein Hotel nicht perfekt passt.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'hotel_shortlist', schema: buildHotelShortlistSchema(context.candidates.length), strict: true } },
    })
    const parsed = JSON.parse(response.output_text)
    return (parsed.picks as Array<{ place_name: string; family_fit_reasoning: string; style_impression: string; best_for: string; caveats: string }>)
      .map((p) => ({
        placeName: p.place_name,
        familyFitReasoning: p.family_fit_reasoning,
        styleImpression: p.style_impression,
        bestFor: p.best_for,
        caveats: p.caveats,
      }))
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'hotel_shortlist', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}

export type BudgetCategoryEstimate = { min: number | null; max: number | null; note: string }
export type BudgetEstimate = {
  currency: string
  totalMin: number | null
  totalMax: number | null
  byCategory: Record<BudgetCategory, BudgetCategoryEstimate>
}

const CATEGORY_PROPERTY_SCHEMA = {
  type: 'object',
  properties: {
    min: { type: ['number', 'null'], description: 'Untere Grenze der groben Schätzung, niemals ein erfundener Exaktpreis.' },
    max: { type: ['number', 'null'], description: 'Obere Grenze der groben Schätzung.' },
    note: { type: 'string', description: 'Kurze Erläuterung/Annahme (z. B. "für 2 Erwachsene + 2 Kinder"), leerer String falls nicht nötig.' },
  },
  required: ['min', 'max', 'note'],
  additionalProperties: false,
}

const BUDGET_ESTIMATE_SCHEMA = {
  type: 'object',
  properties: {
    currency: { type: 'string' },
    total_min: { type: ['number', 'null'] },
    total_max: { type: ['number', 'null'] },
    ...Object.fromEntries(BUDGET_CATEGORY_ORDER.map((cat) => [cat, CATEGORY_PROPERTY_SCHEMA])),
  },
  required: ['currency', 'total_min', 'total_max', ...BUDGET_CATEGORY_ORDER],
  additionalProperties: false,
}

/**
 * §"Reiseideen 2.0, Budgetrechner": reine KI-Schätzung ohne externe API --
 * übernimmt wörtlich die "niemals erfundene Exaktpreise"-Regel aus
 * lib/actions/trip-idea-generation.ts (TRIP_IDEA_PROMPT). Kategorien folgen
 * 1:1 der bestehenden Budget-Taxonomie (lib/budget.ts), keine Parallel-
 * Kategorien (Mietwagen fällt unter "transport", Verpflegung unter
 * "restaurants" -- wie im bestehenden Buchungs-Budget auch).
 */
export async function generateBudgetBreakdown(context: {
  destination: string
  durationDaysMin: number | null
  durationDaysMax: number | null
  existingBudgetMin: number | null
  existingBudgetMax: number | null
  existingBudgetCurrency: string
  includesFlights: boolean
  familyDnaText: string
  membersText: string
}): Promise<BudgetEstimate | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'budget_breakdown' })
    return null
  }

  const durationText = context.durationDaysMin || context.durationDaysMax
    ? `${context.durationDaysMin ?? context.durationDaysMax}${context.durationDaysMax && context.durationDaysMax !== context.durationDaysMin ? `-${context.durationDaysMax}` : ''} Tage`
    : 'Dauer noch offen'
  const existingBudgetText = context.existingBudgetMin || context.existingBudgetMax
    ? `Bereits grob geschätztes Gesamtbudget: ca. ${context.existingBudgetMin ?? '?'}-${context.existingBudgetMax ?? '?'} ${context.existingBudgetCurrency}.`
    : ''

  const categoryLabelsText = BUDGET_CATEGORY_ORDER.map((c) => `${c} (${BUDGET_CATEGORY_LABELS[c]})`).join(', ')

  const prompt = `Du schätzt ein grobes Reisebudget für eine Familie, die eine Reiseidee nach ${context.destination} entwickelt.
Dauer: ${durationText}. ${context.includesFlights ? 'Flüge sind Teil des Budgets.' : 'Flüge sind NICHT Teil des bisherigen Budgets, aber trotzdem als eigene Kategorie schätzen.'} ${existingBudgetText}
Reisende: ${context.membersText}.
${context.familyDnaText || ''}

Schätze eine grobe Kostenspanne (min/max, niemals ein erfundener Exaktpreis) für jede dieser Kategorien: ${categoryLabelsText}. Berücksichtige die Anzahl und das Alter der Reisenden (z. B. Kinderermäßigung, Familienzimmer). Erfinde keine aktuellen Live-Preise oder Verfügbarkeiten -- alle Zahlen sind transparente, grobe Bandbreiten zur Orientierung. Gib außerdem eine Gesamtsumme (total_min/total_max) und die verwendete Währung zurück.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'budget_breakdown', schema: BUDGET_ESTIMATE_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text) as Record<string, unknown>
    const byCategory = Object.fromEntries(
      BUDGET_CATEGORY_ORDER.map((cat) => [cat, parsed[cat] as BudgetCategoryEstimate]),
    ) as Record<BudgetCategory, BudgetCategoryEstimate>
    return {
      currency: String(parsed.currency ?? context.existingBudgetCurrency),
      totalMin: (parsed.total_min as number | null) ?? null,
      totalMax: (parsed.total_max as number | null) ?? null,
      byCategory,
    }
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'budget_breakdown', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}
