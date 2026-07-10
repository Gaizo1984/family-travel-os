'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'

/** Gleiches Modell wie die bestehende Pass-/ESTA-/Beleg-Auslesung — austauschbar über diese Konstante. */
const OPENAI_MODEL = 'gpt-5.4'

const TRIP_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    feasible: { type: 'boolean', description: 'false, wenn aus dem Wunsch keine sinnvollen Reiseideen ableitbar sind' },
    ideas: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Zielregion/-land, ggf. mit Route' },
          route_summary: { type: ['string', 'null'], description: 'Kurze Stationenfolge, falls sinnvoll' },
          best_season: { type: ['string', 'null'], description: 'Beste Reisezeit für dieses Ziel' },
          duration_days_min: { type: ['number', 'null'] },
          duration_days_max: { type: ['number', 'null'] },
          reasoning: { type: 'string', description: 'Warum dieses Ziel zu genau dieser Familie passt (Why-it-fits)' },
          budget_range_min: { type: ['number', 'null'], description: 'Grobe Budget-Schätzung, niemals ein erfundener Exaktpreis' },
          budget_range_max: { type: ['number', 'null'] },
          budget_currency: { type: 'string' },
          includes_flights: { type: 'boolean' },
        },
        required: [
          'destination', 'route_summary', 'best_season', 'duration_days_min', 'duration_days_max',
          'reasoning', 'budget_range_min', 'budget_range_max', 'budget_currency', 'includes_flights',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['feasible', 'ideas'],
  additionalProperties: false,
}

const TRIP_IDEA_PROMPT = (
  'Du entwickelst aus einem Reisewunsch einer Familie genau drei kuratierte, ' +
  'unterscheidbare Reiseideen. Nutze ausschließlich die gegebenen Familiendaten ' +
  '(Reisekompass-Gewichtungen, Hotelkriterien, individuelle Reisebedürfnisse, ' +
  'Alter der Reisenden) und den Freitext-Wunsch als Grundlage — erfinde keine ' +
  'Fakten über die Familie hinzu. Erfinde niemals exakte Preise oder ' +
  'Verfügbarkeiten — Budgetangaben sind immer grobe, transparente Bandbreiten. ' +
  'Behaupte keine Live-Wetter- oder Flugpreisdaten. Setze "feasible" auf false, ' +
  'wenn der Wunsch keine sinnvolle Reiseidee zulässt (z. B. leerer/unsinniger Text).'
)

export async function generateTripIdeas(formData: FormData) {
  const wishText = String(formData.get('wish_text') ?? '').trim()
  const roughTimeframe = String(formData.get('rough_timeframe') ?? '').trim()
  const durationRaw = String(formData.get('duration_days') ?? '').trim()
  const departureCity = String(formData.get('departure_city') ?? '').trim()
  const budgetAmountRaw = String(formData.get('budget_amount') ?? '').trim()
  const budgetCurrency = String(formData.get('budget_currency') ?? 'EUR').trim() || 'EUR'
  const includesFlights = formData.get('includes_flights') === 'on'
  const travelerIds = formData.getAll('traveler_ids').map(String)

  const planPath = '/plan'

  if (wishText.length < 10)
    redirect(`${planPath}?error=${encodeURIComponent('Bitte etwas ausführlicher beschreiben, wonach euch gerade ist (mindestens ein paar Worte).')}`)

  if (!process.env.OPENAI_API_KEY)
    redirect(`${planPath}?error=${encodeURIComponent('Die Reiseideen-KI ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { data: family } = await supabase.from('families').select('id').limit(1).single()
  if (!family?.id)
    redirect(`${planPath}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  const { data: allPersons } = await supabase.from('persons').select('id, name, birth_date').eq('family_id', family.id)
  const selectedTravelers = (allPersons ?? []).filter((p) => travelerIds.length === 0 || travelerIds.includes(p.id))

  const { data: pastTrips } = await supabase.from('past_trips').select('country_or_region, year').eq('family_id', family.id)
  const { data: completedTrips } = await supabase.from('trips').select('title').eq('family_id', family.id).in('status', ['completed', 'active'])

  const dnaSummary = await buildFamilyDnaSummary(family.id)
  const dnaText = formatFamilyDnaForPrompt(dnaSummary, roughTimeframe || undefined)

  const travelHistoryText = [
    ...(completedTrips ?? []).map((t) => t.title),
    ...(pastTrips ?? []).map((p) => `${p.country_or_region} (${p.year})`),
  ].join(', ')

  const contextParts = [
    `Reisewunsch: "${wishText}"`,
    roughTimeframe ? `Grober Zeitraum: ${roughTimeframe}` : null,
    durationRaw ? `Gewünschte Dauer: etwa ${durationRaw} Tage` : null,
    departureCity ? `Abflugort: ${departureCity}` : null,
    budgetAmountRaw ? `Verfügbares Budget: etwa ${budgetAmountRaw} ${budgetCurrency}${includesFlights ? ' (inkl. Flüge)' : ' (ohne Flüge)'}` : null,
    `Mitreisende: ${selectedTravelers.map((p) => p.name).join(', ')}`,
    dnaText || null,
    travelHistoryText ? `Bisherige Reisen (zur Vermeidung von Wiederholungen): ${travelHistoryText}` : null,
  ].filter(Boolean).join('\n')

  let parsed: {
    feasible: boolean
    ideas: Array<{
      destination: string; route_summary: string | null; best_season: string | null
      duration_days_min: number | null; duration_days_max: number | null; reasoning: string
      budget_range_min: number | null; budget_range_max: number | null; budget_currency: string
      includes_flights: boolean
    }>
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: `${TRIP_IDEA_PROMPT}\n\n${contextParts}` }],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'trip_ideas',
          schema: TRIP_IDEA_SCHEMA,
          strict: true,
        },
      },
    })
    parsed = JSON.parse(response.output_text)
  } catch {
    redirect(`${planPath}?error=${encodeURIComponent('Die Reiseideen-KI ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)
  }

  if (!parsed.feasible || parsed.ideas.length === 0)
    redirect(`${planPath}?error=${encodeURIComponent('Aus diesem Wunsch konnten keine Reiseideen entwickelt werden. Bitte etwas konkreter beschreiben.')}`)

  const { data: session, error: sessionError } = await supabase.from('trip_idea_sessions').insert({
    family_id: family.id,
    input_text: wishText,
    clarifying_answers: {
      rough_timeframe: roughTimeframe || null,
      duration_days: durationRaw ? Number(durationRaw) : null,
      departure_city: departureCity || null,
      budget_amount: budgetAmountRaw ? Number(budgetAmountRaw) : null,
      budget_currency: budgetCurrency,
      includes_flights: includesFlights,
    },
    status: 'suggested',
  }).select('id').single()

  if (sessionError || !session)
    redirect(`${planPath}?error=${encodeURIComponent('Speicherfehler: ' + (sessionError?.message ?? 'unbekannt'))}`)

  const { error: ideasError } = await supabase.from('trip_ideas').insert(
    parsed.ideas.map((idea) => ({
      session_id: session.id,
      family_id: family.id,
      origin: 'plan_ai',
      destination: idea.destination,
      route_summary: idea.route_summary,
      best_season: idea.best_season,
      duration_days_min: idea.duration_days_min,
      duration_days_max: idea.duration_days_max,
      reasoning: idea.reasoning,
      budget_range_min: idea.budget_range_min,
      budget_range_max: idea.budget_range_max,
      budget_currency: idea.budget_currency || budgetCurrency,
      includes_flights: idea.includes_flights,
    })),
  )

  if (ideasError)
    redirect(`${planPath}?error=${encodeURIComponent('Speicherfehler: ' + ideasError.message)}`)

  redirect(`/plan/ideas/${session.id}`)
}
