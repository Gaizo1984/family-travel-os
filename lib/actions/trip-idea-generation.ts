'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { readDateGroupFromFormData } from '@/lib/documents'
import {
  TRAVEL_DATE_MODE_LABELS, TRIP_TYPE_PREFERENCE_LABELS, CLIMATE_PREFERENCE_LABELS, STOPOVER_PREFERENCE_LABELS,
  type TravelDateMode, type TripTypePreference, type ClimatePreference, type StopoverPreference,
} from '@/lib/travel-preferences'

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
  const departureCity = String(formData.get('departure_city') ?? '').trim()
  const budgetMinRaw = String(formData.get('budget_min') ?? '').trim()
  const budgetMaxRaw = String(formData.get('budget_max') ?? '').trim()
  const budgetCurrency = String(formData.get('budget_currency') ?? 'EUR').trim() || 'EUR'
  const includesFlights = formData.get('includes_flights') === 'on'
  const travelerIds = formData.getAll('traveler_ids').map(String)

  const travelDateMode = (String(formData.get('travel_date_mode') ?? 'flexible').trim() || 'flexible') as TravelDateMode
  const travelPeriodText = String(formData.get('travel_period_text') ?? '').trim()
  const nightsMinRaw = String(formData.get('nights_min') ?? '').trim()
  const nightsMaxRaw = String(formData.get('nights_max') ?? '').trim()
  const tripTypePreference = (String(formData.get('trip_type_preference') ?? '').trim() || null) as TripTypePreference | null
  const climatePreference = (String(formData.get('climate_preference') ?? '').trim() || null) as ClimatePreference | null
  const rainRiskTolerant = formData.get('rain_risk_tolerant') === 'on'
  const maxStopoversRaw = String(formData.get('max_stopovers') ?? '').trim()
  const stopoverPreference = (String(formData.get('stopover_preference') ?? '').trim() || null) as StopoverPreference | null
  const excludedDestinations = String(formData.get('excluded_destinations_text') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const avoidPastDestinations = formData.get('avoid_past_destinations') === 'on'
  const excludedTripTypes = formData.getAll('excluded_trip_types').map(String)
  const excludedClimates = formData.getAll('excluded_climates').map(String)

  const planPath = '/plan'

  if (wishText.length < 10)
    redirect(`${planPath}?error=${encodeURIComponent('Bitte etwas ausführlicher beschreiben, wonach euch gerade ist (mindestens ein paar Worte).')}`)

  if (travelerIds.length === 0)
    redirect(`${planPath}?error=${encodeURIComponent('Bitte mindestens einen Reisenden auswählen.')}`)

  if (!process.env.OPENAI_API_KEY)
    redirect(`${planPath}?error=${encodeURIComponent('Die Reiseideen-KI ist aktuell nicht konfiguriert.')}`)

  let travelStartDate: string | null = null
  let travelEndDate: string | null = null
  if (travelDateMode === 'exact') {
    try {
      travelStartDate = readDateGroupFromFormData(formData, 'start_date', 'Von-Datum')
      travelEndDate = readDateGroupFromFormData(formData, 'end_date', 'Bis-Datum')
    } catch (e) {
      redirect(`${planPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
    }
  }

  // §"Keine widersprüchlichen Werte": bei konkretem Datum werden die Nächte
  // serverseitig aus den echten Daten neu berechnet, nie blind aus dem
  // Client übernommen. Sonst gilt der eingegebene Bereich (bzw. min=max, wenn
  // nur ein Wert gesetzt wurde).
  let nightsMin: number | null = null
  let nightsMax: number | null = null
  if (travelDateMode === 'exact' && travelStartDate && travelEndDate) {
    const diff = Math.round((new Date(travelEndDate).getTime() - new Date(travelStartDate).getTime()) / 86400000)
    if (diff >= 0) { nightsMin = diff; nightsMax = diff }
  } else if (nightsMinRaw || nightsMaxRaw) {
    nightsMin = nightsMinRaw ? Number(nightsMinRaw) : Number(nightsMaxRaw)
    nightsMax = nightsMaxRaw ? Number(nightsMaxRaw) : Number(nightsMinRaw)
  }

  const supabase = await createClient()
  const { data: family } = await supabase.from('families').select('id').limit(1).single()
  if (!family?.id)
    redirect(`${planPath}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  const { data: allPersons } = await supabase.from('persons').select('id, name, birth_date').eq('family_id', family.id)
  const selectedTravelers = (allPersons ?? []).filter((p) => travelerIds.includes(p.id))

  const { data: pastTrips } = await supabase.from('past_trips').select('country_or_region, year').eq('family_id', family.id)
  const { data: completedTrips } = await supabase.from('trips').select('id, title').eq('family_id', family.id).in('status', ['completed', 'active'])
  // §"Lieblingshotels" (LUMI Intelligence v1, §8): kein eigenes Favoriten-Flag
  // im Schema -- bisher genutzte Unterkunftsnamen aus abgeschlossenen/
  // laufenden Reisen sind die nächstliegende, ohne Migration verfügbare
  // Annäherung, ergänzend zu den bereits vorhandenen Hotelkriterien-Tags.
  const completedTripIds = (completedTrips ?? []).map((t) => t.id)
  const { data: pastAccommodations } = completedTripIds.length > 0
    ? await supabase.from('bookings').select('title').eq('type', 'accommodation').in('trip_id', completedTripIds)
    : { data: [] as Array<{ title: string }> }

  const dnaSummary = await buildFamilyDnaSummary(family.id)
  // §"atDate-Bug beheben": nur ein echtes, valides Reisedatum (konkreter
  // Modus) wird als Stichtag für die Altersberechnung übergeben -- nie mehr
  // roher Freitext, der bei new Date(...) lautlos zu Invalid Date führte.
  const dnaText = formatFamilyDnaForPrompt(dnaSummary, travelStartDate ?? undefined)

  const travelHistoryText = [
    ...(completedTrips ?? []).map((t) => t.title),
    ...(pastTrips ?? []).map((p) => `${p.country_or_region} (${p.year})`),
  ].join(', ')
  const favoriteHotelsText = [...new Set((pastAccommodations ?? []).map((b) => b.title))].join(', ')

  const timingText = travelDateMode === 'exact' && travelStartDate && travelEndDate
    ? `${travelStartDate} bis ${travelEndDate}${nightsMin !== null ? ` (${nightsMin} Nächte)` : ''}`
    : travelDateMode === 'month' || travelDateMode === 'school_holiday'
      ? `${TRAVEL_DATE_MODE_LABELS[travelDateMode]}${travelPeriodText ? `: ${travelPeriodText}` : ''}${nightsMin !== null ? `, ${nightsMin === nightsMax ? `${nightsMin} Nächte` : `${nightsMin}-${nightsMax} Nächte`}` : ''}`
      : travelDateMode === 'flexible'
        ? `Flexibles Zeitfenster${nightsMin !== null ? `, ${nightsMin === nightsMax ? `${nightsMin} Nächte` : `${nightsMin}-${nightsMax} Nächte`}` : ''}`
        : 'Zeitraum noch offen'

  const excludedTripTypeLabels = excludedTripTypes.map((t) => TRIP_TYPE_PREFERENCE_LABELS[t as TripTypePreference] ?? t)
  const excludedClimateLabels = excludedClimates.map((c) => CLIMATE_PREFERENCE_LABELS[c as ClimatePreference] ?? c)

  const contextParts = [
    `Reisewunsch: "${wishText}"`,
    `Reisezeitraum: ${timingText}`,
    departureCity ? `Abflugort: ${departureCity}` : null,
    tripTypePreference ? `Gewünschte Reiseart: ${TRIP_TYPE_PREFERENCE_LABELS[tripTypePreference]}` : null,
    climatePreference ? `Klimawunsch: ${CLIMATE_PREFERENCE_LABELS[climatePreference]}${rainRiskTolerant ? ' (Regenrisiko akzeptabel)' : ''}` : null,
    stopoverPreference ? `Anreise-Präferenz: ${STOPOVER_PREFERENCE_LABELS[stopoverPreference]}${maxStopoversRaw ? `, max. ${maxStopoversRaw} Umstiege` : ''}` : null,
    (budgetMinRaw || budgetMaxRaw) ? `Verfügbares Budget: etwa ${budgetMinRaw || '?'}-${budgetMaxRaw || '?'} ${budgetCurrency}${includesFlights ? ' (inkl. Flüge)' : ' (ohne Flüge)'}` : null,
    `Mitreisende: ${selectedTravelers.map((p) => p.name).join(', ')}`,
    dnaText || null,
    avoidPastDestinations && travelHistoryText ? `Bisherige Reisen (zur Vermeidung von Wiederholungen): ${travelHistoryText}` : null,
    favoriteHotelsText ? `Bisher genutzte Hotels (Anhaltspunkt für den bevorzugten Hotelstil): ${favoriteHotelsText}` : null,
    excludedDestinations.length > 0 ? `Ausdrücklich auszuschließende Länder/Regionen: ${excludedDestinations.join(', ')}` : null,
    excludedTripTypeLabels.length > 0 ? `Auszuschließende Reisearten: ${excludedTripTypeLabels.join(', ')}` : null,
    excludedClimateLabels.length > 0 ? `Auszuschließende Klimata: ${excludedClimateLabels.join(', ')}` : null,
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
      departure_city: departureCity || null,
      budget_min: budgetMinRaw ? Number(budgetMinRaw) : null,
      budget_max: budgetMaxRaw ? Number(budgetMaxRaw) : null,
      budget_currency: budgetCurrency,
      includes_flights: includesFlights,
    },
    // §"Reiseideen 2.0": Teilnehmerauswahl bisher nur transient für den
    // Prompt genutzt, nie gespeichert -- wird für die spätere, alters-
    // bewusste Budget-Schätzung (lib/actions/trip-idea-advisor.ts) gebraucht.
    traveler_ids: selectedTravelers.map((p) => p.id),
    // §"Reisebriefing": strukturierte Eckdaten des Wizards, additiv --
    // Downstream (Hotel-Shortlist/Varianten/Budget/Vergleich/Flugsuche) liest
    // diese Spalten direkt statt aus clarifying_answers.
    departure_city: departureCity || null,
    travel_date_mode: travelDateMode,
    travel_start_date: travelStartDate,
    travel_end_date: travelEndDate,
    travel_period_text: travelPeriodText || null,
    nights_min: nightsMin,
    nights_max: nightsMax,
    climate_preference: climatePreference,
    trip_type_preference: tripTypePreference,
    rain_risk_tolerant: rainRiskTolerant,
    max_stopovers: maxStopoversRaw ? Number(maxStopoversRaw) : null,
    stopover_preference: stopoverPreference,
    budget_min: budgetMinRaw ? Number(budgetMinRaw) : null,
    budget_max: budgetMaxRaw ? Number(budgetMaxRaw) : null,
    excluded_destinations: excludedDestinations.length > 0 ? excludedDestinations : null,
    avoid_past_destinations: avoidPastDestinations,
    excluded_trip_types: excludedTripTypes.length > 0 ? excludedTripTypes : null,
    excluded_climates: excludedClimates.length > 0 ? excludedClimates : null,
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
