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
  /**
   * §"Qualitativ neu kalibrieren": bereits VOR der KI deterministisch aus
   * echten Fakten (Marke oder Bewertung+Preisniveau) bestimmt -- die KI
   * ordnet nicht selbst ein, sie bekommt es nur als Kontext, um die Auswahl
   * auszubalancieren. `null` = Fallback-Modus: kein Kandidat in dieser
   * Region erreicht den gewünschten Mindeststandard (siehe `belowStandardMode`
   * in `selectHotelShortlist`).
   */
  tier: LuxuryHotelTier | null
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
  /** §"Fallback für Regionen ohne qualifizierte Hotels": true, wenn KEIN Kandidat den Mindeststandard erreicht -- alle `candidates` haben dann `tier: null`. */
  belowStandardMode: boolean
}): Promise<HotelPick[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'hotel_shortlist' })
    return null
  }
  if (context.candidates.length === 0) return null

  const candidateText = context.candidates
    .map((c) => {
      const parts = [
        `Einordnung: ${c.tier ? LUXURY_TIER_LABELS[c.tier] : 'unterhalb des gewünschten 5-Sterne-Mindeststandards'}`,
        c.rating !== null ? `Bewertung ${c.rating} (${c.userRatingCount ?? 0} Rezensionen)` : 'keine Bewertung bekannt',
        c.priceLevel ? `Preisklasse ${c.priceLevel}` : 'Preisklasse unbekannt',
        c.transferMinutes !== null ? `${c.transferMinutes} Min Transferzeit` : 'Transferzeit unbekannt',
        `Adresse: ${c.address}`,
        `Typen: ${c.types.join(', ') || 'unbekannt'}`,
      ]
      return `- ${c.name}: ${parts.join(', ')}`
    })
    .join('\n')

  const qualityInstruction = context.belowStandardMode
    ? 'WICHTIG: Kein einziges Hotel in dieser Region erreicht den eigentlich gewünschten gehobenen 5-Sterne-Mindeststandard (Westin/Le Méridien oder besser) -- das ist eine Ausnahme, keine Regel. Wähle trotzdem die besten der unten aufgeführten, real existierenden Optionen aus und sei in caveats bei JEDEM Hotel ausdrücklich und ehrlich deutlich, dass es UNTER dem gewünschten Niveau liegt.'
    : 'Alle Kandidaten sind bereits auf gehobenes 5-Sterne-Niveau oder höher vorgefiltert.'

  const prompt = `Du bist Reiseberater für eine Familie, die eine Reiseidee nach ${context.destination} entwickelt.
${context.familyDnaText || 'Keine besonderen Präferenzen bekannt.'}

Hotel-Kandidaten (ausschließlich echte, bereits über Google Places geprüfte Hotels -- wähle NUR aus dieser Liste, erfinde nichts). ${qualityInstruction}
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

export type TripVariantType = 'best_overall' | 'premium' | 'value' | 'relaxed' | 'special_experience'

export const TRIP_VARIANT_LABELS: Record<TripVariantType, string> = {
  best_overall: 'Bestes Gesamtpaket',
  premium: 'Premium/Luxus',
  value: 'Bestes Preis-Leistungs-Verhältnis',
  relaxed: 'Entspannte Anreise',
  special_experience: 'Besonderes Erlebnis',
}

export type TransferBurden = 'gering' | 'mittel' | 'hoch'

export type TripVariant = {
  variantType: TripVariantType
  title: string
  routeSummary: string
  stageCount: number | null
  hasStopover: boolean
  durationDaysMin: number | null
  durationDaysMax: number | null
  transferBurden: TransferBurden
  themeFocus: string
  budgetRangeMin: number | null
  budgetRangeMax: number | null
  budgetCurrency: string
  recommendedHotelName: string | null
  pros: string[]
  cons: string[]
  whyThisVariant: string
}

const TRANSFER_BURDEN_VALUES = ['gering', 'mittel', 'hoch']

const TRIP_VARIANT_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          variant_type: { type: 'string', enum: ['best_overall', 'premium', 'value', 'relaxed', 'special_experience'] },
          title: { type: 'string', description: 'Kurzer, konkreter Titel dieser Variante.' },
          route_summary: { type: 'string', description: 'Stationenfolge inkl. Reihenfolge, ausdrücklich mit oder ohne Zwischenstopp benannt.' },
          stage_count: { type: ['number', 'null'], description: 'Anzahl Etappen/Stationen dieser Variante.' },
          has_stopover: { type: 'boolean', description: 'true, wenn diese Variante einen Zwischenstopp/Stopover enthält.' },
          duration_days_min: { type: ['number', 'null'] },
          duration_days_max: { type: ['number', 'null'] },
          transfer_burden: { type: 'string', enum: TRANSFER_BURDEN_VALUES, description: 'Geschätzte Flug-/Transferbelastung dieser Variante.' },
          theme_focus: { type: 'string', description: 'Kurzer Schwerpunkt, z. B. "Schwerpunkt Erholung & Strand, wenig Stadt".' },
          budget_range_min: { type: ['number', 'null'], description: 'Grobe Schätzung, niemals ein erfundener Exaktpreis.' },
          budget_range_max: { type: ['number', 'null'] },
          budget_currency: { type: 'string' },
          recommended_hotel_name: {
            type: ['string', 'null'],
            description: 'EXAKT ein Name aus der mitgelieferten echten Hotel-Shortlist, oder null, wenn keine Shortlist vorliegt/kein Hotel passt. Niemals ein erfundener Hotelname.',
          },
          pros: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' }, description: 'Konkrete Vorteile dieser Variante.' },
          cons: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' }, description: 'Konkrete Nachteile/Trade-offs dieser Variante, ehrlich.' },
          why_this_variant: { type: 'string', description: 'Kurz: warum diese Variante wählen, was sie von den anderen vier unterscheidet.' },
        },
        required: [
          'variant_type', 'title', 'route_summary', 'stage_count', 'has_stopover',
          'duration_days_min', 'duration_days_max', 'transfer_burden', 'theme_focus',
          'budget_range_min', 'budget_range_max', 'budget_currency', 'recommended_hotel_name',
          'pros', 'cons', 'why_this_variant',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['variants'],
  additionalProperties: false,
}

/**
 * §"Reisevarianten mit echten strukturellen Unterschieden": kein neues
 * Multi-Stop-Routen-/Places-Subsystem -- Varianten unterscheiden sich über
 * strukturierte Felder (Dauer, Etappenzahl, Stopover, Transferbelastung,
 * Themenfokus, Budgetklasse), die Hotelreferenz kommt ausschließlich aus der
 * bereits vorhandenen, ECHTEN Hotel-Shortlist der Idee (kein zweiter
 * Places-Call, kein erfundener Hotelname -- `recommended_hotel_name` wird im
 * Aufrufer gegen die echte Liste abgeglichen, exakt wie bei `selectHotelShortlist`).
 */
export async function generateTripVariants(context: {
  destination: string
  routeSummary: string | null
  durationDaysMin: number | null
  durationDaysMax: number | null
  budgetRangeMin: number | null
  budgetRangeMax: number | null
  budgetCurrency: string
  familyDnaText: string
  /** Nur Name + Tier + Kernfakten der bereits echten, qualifizierten Hotels -- leer, wenn (noch) keine ausreichende Shortlist existiert. */
  hotelCandidates: Array<{ name: string; tier: LuxuryHotelTier | null; priceLevel: string | null; transferMinutes: number | null }>
}): Promise<TripVariant[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'trip_variants' })
    return null
  }

  const hasHotelCandidates = context.hotelCandidates.length >= 2
  const hotelText = hasHotelCandidates
    ? context.hotelCandidates
      .map((h) => `- ${h.name}: Einordnung ${h.tier ? LUXURY_TIER_LABELS[h.tier] : 'unterhalb des Mindeststandards'}${h.priceLevel ? `, Preisklasse ${h.priceLevel}` : ''}${h.transferMinutes !== null ? `, ${h.transferMinutes} Min Transferzeit` : ''}`)
      .join('\n')
    : ''

  const hotelInstruction = hasHotelCandidates
    ? `Echte Hotel-Kandidaten dieser Idee (bereits auf gehobenes 5-Sterne-Niveau oder höher geprüft -- wähle recommended_hotel_name NUR aus dieser Liste, exakt wie geschrieben, erfinde nichts):
${hotelText}

Für "premium": wähle NICHT automatisch das Ultra-Luxus-Hotel aus der Liste, falls eines vorhanden ist -- nur wenn es wirklich die beste Passung für diese Variante ist, sonst ein Premium- oder Standard-Tier-Hotel.
Für "value": KEINE Hotelqualität unterhalb des Mindeststandards -- wähle ein Standard-Tier-Hotel aus der Liste (weiterhin Westin-/Le-Méridien-Niveau oder besser), niemals ein günstigeres Hotel außerhalb dieser Liste.`
    : 'Für diese Reiseidee liegt noch keine ausreichende Hotel-Shortlist vor -- setze recommended_hotel_name bei ALLEN Varianten auf null und differenziere ausschließlich über Dauer, Route, Etappenzahl, Stopover, Themenfokus, Transferbelastung und Budgetklasse.'

  const prompt = `Du bist Reiseberater für eine Familie und entwickelst zu EINER bereits gewählten Reiseidee (Ziel: ${context.destination}${context.routeSummary ? `, bisherige Route: ${context.routeSummary}` : ''}) fünf unterscheidbare Varianten.
${context.familyDnaText || 'Keine besonderen Präferenzen bekannt.'}
Bisherige grobe Eckdaten: ${context.durationDaysMin ?? '?'}-${context.durationDaysMax ?? '?'} Tage, Budget ca. ${context.budgetRangeMin ?? '?'}-${context.budgetRangeMax ?? '?'} ${context.budgetCurrency}.

${hotelInstruction}

Die fünf Varianten (in dieser Reihenfolge, jede mit variant_type):
1. best_overall = Bestes Gesamtpaket -- beste Balance aus Hotelqualität, Reisebelastung, Erlebnis und Budget.
2. premium = Premium/Luxus -- hochwertigste sinnvolle Variante, NICHT automatisch Ultra-Luxus.
3. value = Bestes Preis-Leistungs-Verhältnis -- weiterhin mindestens Westin-/Le-Méridien-Niveau, keine Absenkung der Hotelqualität.
4. relaxed = Entspannte Anreise -- möglichst wenige Umstiege, kurze Transfers, geringe Belastung für Kinder.
5. special_experience = Besonderes Erlebnis -- ein außergewöhnlicher, familiengeeigneter Baustein oder eine besondere Kombination, ohne unrealistische Logistik.

WICHTIG: Jede Variante MUSS sich strukturell unterscheiden -- Dauer, Etappenzahl, Stopover, Reihenfolge, Hotel, Themenfokus, Transferbelastung und/oder Budgetklasse dürfen NICHT bei allen fünf Varianten identisch sein. Keine zwei Varianten dürfen nur sprachlich unterschiedlich klingen, aber inhaltlich dasselbe Paket beschreiben. Nenne bei jeder Variante 2-4 konkrete Vor- und Nachteile sowie einen kurzen Grund, warum man genau diese Variante wählen würde. Erfinde keine Fakten, keine Live-Preise/Verfügbarkeiten -- Budgetangaben sind immer grobe, transparente Bandbreiten.`

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'trip_variants', schema: TRIP_VARIANT_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text) as {
      variants: Array<{
        variant_type: TripVariantType; title: string; route_summary: string
        stage_count: number | null; has_stopover: boolean
        duration_days_min: number | null; duration_days_max: number | null
        transfer_burden: TransferBurden; theme_focus: string
        budget_range_min: number | null; budget_range_max: number | null; budget_currency: string
        recommended_hotel_name: string | null; pros: string[]; cons: string[]; why_this_variant: string
      }>
    }
    return parsed.variants.map((v) => ({
      variantType: v.variant_type,
      title: v.title,
      routeSummary: v.route_summary,
      stageCount: v.stage_count,
      hasStopover: v.has_stopover,
      durationDaysMin: v.duration_days_min,
      durationDaysMax: v.duration_days_max,
      transferBurden: v.transfer_burden,
      themeFocus: v.theme_focus,
      budgetRangeMin: v.budget_range_min,
      budgetRangeMax: v.budget_range_max,
      budgetCurrency: v.budget_currency,
      recommendedHotelName: v.recommended_hotel_name,
      pros: v.pros,
      cons: v.cons,
      whyThisVariant: v.why_this_variant,
    }))
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'trip_variants', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}
