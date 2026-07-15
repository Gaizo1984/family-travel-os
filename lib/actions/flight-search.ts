'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, ageAtDate } from '@/lib/family-dna'
import { resolveAirportCode, searchFlights, isFlightProviderSandbox } from '@/lib/providers/flights-provider'
import { ProviderConfigError } from '@/lib/providers/provider-errors'
import { FlightScoringService } from '@/lib/flight-scoring-service'
import { generateFlightReasoning } from '@/lib/flight-advisor-ai'
import { readDateGroupFromFormData } from '@/lib/documents'
import type { FlightSearchOption, FlightSearchResult } from '@/lib/flight-types'
import type { Json } from '@/lib/supabase/types'

/** Kostenkontrolle: KI-Begründung nur für eine begrenzte, bereits vorsortierte Kandidatenzahl -- nicht für die gesamte Trefferliste. */
const MAX_AI_REASONING_CANDIDATES = 8

/** §"Mehrfachklicks/parallele Suchen verhindern": Claim gilt als "noch laufend", solange er jünger als das ist -- danach self-heals ein hängengebliebener Claim automatisch. */
const CLAIM_TTL_MS = 60_000

const DEFAULT_MONTHLY_LIMIT = 50

export type FlightSearchOutcome =
  | { status: 'ok'; searchKey: string; result: FlightSearchResult }
  | { status: 'limit_reached' }
  | { status: 'already_in_progress' }
  | { status: 'no_results' }

function buildSearchKey(params: {
  originCodes: string[]; destinationCode: string; departureDate: string; returnDate: string | null
  adults: number; children: number; infants: number
}): string {
  const origins = [...params.originCodes].sort().join('+')
  return [origins, params.destinationCode, params.departureDate, params.returnDate ?? 'oneway', params.adults, params.children, params.infants].join('|')
}

/**
 * Nur für Cache-Schlüssel/-Spalten (`adults`/`children`/`infants`) gedacht,
 * NICHT für die eigentliche Providersuche -- die nutzt die exakten
 * `passengerAges`. Schwelle 12/2 ist eine reine Anzeige-/Gruppierungs-
 * Konvention, unabhängig von Duffels eigener `age>=18`-Erwachsenendefinition
 * für den Passagier-Payload (siehe `lib/providers/flights-provider.ts`).
 */
function bucketPassengerAges(ages: Array<number | null>): { adults: number; children: number; infants: number } {
  let adults = 0, children = 0, infants = 0
  for (const age of ages) {
    if (age === null || age >= 12) adults++
    else if (age >= 2) children++
    else infants++
  }
  if (adults === 0) adults = 1
  return { adults, children, infants }
}

/**
 * §"Zentrale, providerneutrale Flug-Engine, keine doppelte Logik": einzige
 * Stelle, an der eine Flugsuche tatsächlich ausgeführt/gecacht wird.
 * Reiseideen, Varianten, Budget, Tagesplanung und später das Buchungsportal
 * rufen dieselbe Funktion mit eigenen Parametern auf, statt eigene
 * Suchlogik zu bauen -- auch mit mehreren `originCodes`, sobald das
 * gebraucht wird. `forceRefresh` deckt "Neu suchen" ab, ohne eine zweite
 * Funktion zu brauchen.
 *
 * Kostenkontrolle (Nutzervorgabe): vor jedem ECHTEN Providerruf (Cache-
 * Treffer verbrauchen nie Budget) wird 1) ein evtl. bereits laufender Claim
 * geprüft (`search_started_at`, self-heilend nach `CLAIM_TTL_MS`) und 2)
 * das monatliche Such-Limit (`FLIGHT_SEARCH_MONTHLY_LIMIT`) geprüft. Der
 * Zähler wird erst NACH einer erfolgreichen echten Suche erhöht.
 */
export async function getOrSearchFlightOptions(params: {
  familyId: string
  originCodes: string[]
  destinationCode: string
  departureDate: string
  returnDate: string | null
  /** Ein Eintrag pro Reisendem, `null` = Alter unbekannt (wird als Erwachsener behandelt). */
  passengerAges: Array<number | null>
  maxStops: number | null
  familyDnaText: string
  stopoverPreference: string | null
  forceRefresh?: boolean
}): Promise<FlightSearchOutcome> {
  const supabase = await createClient()
  const { adults, children, infants } = bucketPassengerAges(params.passengerAges)
  const searchKey = buildSearchKey({
    originCodes: params.originCodes, destinationCode: params.destinationCode,
    departureDate: params.departureDate, returnDate: params.returnDate, adults, children, infants,
  })

  const { data: existing } = await supabase
    .from('flight_search_cache')
    .select('results, is_sandbox_data, updated_at, search_started_at')
    .eq('family_id', params.familyId)
    .eq('search_key', searchKey)
    .maybeSingle()

  const hasCachedResults = Array.isArray(existing?.results) && (existing.results as unknown[]).length > 0
  if (!params.forceRefresh && hasCachedResults) {
    return {
      status: 'ok',
      searchKey,
      result: { options: existing!.results as unknown as FlightSearchOption[], isSandboxData: existing!.is_sandbox_data, searchedAt: existing!.updated_at },
    }
  }

  if (existing?.search_started_at) {
    const startedAtMs = new Date(existing.search_started_at).getTime()
    if (Date.now() - startedAtMs < CLAIM_TTL_MS) return { status: 'already_in_progress' }
  }

  const monthKey = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const monthlyLimit = Number(process.env.FLIGHT_SEARCH_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT))
  const { data: usage } = await supabase
    .from('flight_search_usage')
    .select('search_count')
    .eq('family_id', params.familyId)
    .eq('month_key', monthKey)
    .maybeSingle()
  if ((usage?.search_count ?? 0) >= monthlyLimit) return { status: 'limit_reached' }

  // Claim setzen, BEVOR der Provider aufgerufen wird -- lässt evtl. vorhandene `results` unangetastet.
  const { error: claimError } = await supabase.from('flight_search_cache').upsert(
    {
      family_id: params.familyId, search_key: searchKey,
      origin_codes: params.originCodes, destination_code: params.destinationCode,
      departure_date: params.departureDate, return_date: params.returnDate,
      adults, children, infants,
      search_started_at: new Date().toISOString(),
    },
    { onConflict: 'family_id,search_key' },
  )
  if (claimError) console.error('[flight_search_cache] Claim-Fehler:', claimError.message)

  let rawOptions: FlightSearchOption[]
  try {
    rawOptions = await searchFlights({
      originCodes: params.originCodes,
      destinationCode: params.destinationCode,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      passengerAges: params.passengerAges,
      maxStops: params.maxStops,
    })
  } catch (e) {
    await supabase.from('flight_search_cache').update({ search_started_at: null }).eq('family_id', params.familyId).eq('search_key', searchKey)
    throw e
  }

  if (rawOptions.length === 0) {
    await supabase.from('flight_search_cache').update({ search_started_at: null }).eq('family_id', params.familyId).eq('search_key', searchKey)
    return { status: 'no_results' }
  }

  // §"LUMI Flight Score zentral, nie in der UI": Badges/Gepäckstatus/Sortierung stehen bereits fest, bevor die KI überhaupt aufgerufen wird -- sie ändert sie nie.
  const withBadges = FlightScoringService.computeBadges(rawOptions)
  const sorted = FlightScoringService.sortByDefault(withBadges)

  const topCandidates = sorted.slice(0, MAX_AI_REASONING_CANDIDATES)
  const reasoning = await generateFlightReasoning({
    options: topCandidates.map((o) => ({
      id: o.id, price: o.price, currency: o.currency, totalDurationMinutes: o.totalDurationMinutes,
      maxStopCount: o.maxStopCount, checkedBaggageStatus: o.checkedBaggageStatus, badges: o.badges,
    })),
    familyDnaText: params.familyDnaText,
    stopoverPreference: params.stopoverPreference,
  })
  const reasoningById = new Map((reasoning ?? []).map((r) => [r.optionId, r.reasoning]))
  const finalOptions = sorted.map((o) => ({ ...o, aiReasoning: reasoningById.get(o.id) ?? null }))

  const isSandboxData = isFlightProviderSandbox()
  const searchedAt = new Date().toISOString()

  const { error: upsertError } = await supabase.from('flight_search_cache').upsert(
    {
      family_id: params.familyId,
      search_key: searchKey,
      origin_codes: params.originCodes,
      destination_code: params.destinationCode,
      departure_date: params.departureDate,
      return_date: params.returnDate,
      adults, children, infants,
      is_sandbox_data: isSandboxData,
      results: finalOptions as unknown as Json,
      search_started_at: null,
      updated_at: searchedAt,
    },
    { onConflict: 'family_id,search_key' },
  )
  if (upsertError) console.error('[flight_search_cache] Speicherfehler:', upsertError.message)

  const { error: usageError } = await supabase.from('flight_search_usage').upsert(
    { family_id: params.familyId, month_key: monthKey, search_count: (usage?.search_count ?? 0) + 1, updated_at: new Date().toISOString() },
    { onConflict: 'family_id,month_key' },
  )
  if (usageError) console.error('[flight_search_usage] Speicherfehler:', usageError.message)

  return { status: 'ok', searchKey, result: { options: finalOptions, isSandboxData, searchedAt } }
}

/**
 * §"Flüge suchen"-Button auf der Ideen-Detailseite -- einziger Auslöser für
 * Flug-Provider-/OpenAI-Aufrufe dieser Idee, nie beim bloßen Seitenaufruf
 * (gleiche Disziplin wie `generateHotelShortlist`). Reines Formular-Glue:
 * lädt Kontext, löst Flughafencodes auf, delegiert die eigentliche Arbeit
 * an `getOrSearchFlightOptions`.
 */
export async function searchFlightOptions(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const sessionId = String(formData.get('session_id') ?? '')
  const returnTo = `/plan/ideas/${sessionId}/${ideaId}`

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('trip_ideas')
    .select('id, family_id, session_id, destination')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) redirect(returnTo)

  const { data: session } = idea.session_id
    ? await supabase
      .from('trip_idea_sessions')
      .select('traveler_ids, departure_city, travel_date_mode, travel_start_date, travel_end_date, stopover_preference, max_stopovers')
      .eq('id', idea.session_id)
      .maybeSingle()
    : { data: null }

  const departureCityInput = String(formData.get('departure_city') ?? '').trim()
  const departureCity = departureCityInput || session?.departure_city || ''
  if (!departureCity)
    redirect(`${returnTo}?error=${encodeURIComponent('Bitte einen Abflugort angeben.')}`)

  // §"Echtes Flugdatum ist zwingend": bei exact-Modus aus der Session, sonst
  // Just-in-time aus dem Suchformular -- schreibt nie in die Session zurück.
  let departureDate: string | null = null
  let returnDate: string | null = null
  if (session?.travel_date_mode === 'exact' && session.travel_start_date && session.travel_end_date) {
    departureDate = session.travel_start_date
    returnDate = session.travel_end_date
  } else {
    try {
      departureDate = readDateGroupFromFormData(formData, 'search_departure_date', 'Hinflugdatum')
      returnDate = readDateGroupFromFormData(formData, 'search_return_date', 'Rückflugdatum')
    } catch (e) {
      redirect(`${returnTo}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
    }
  }
  if (!departureDate)
    redirect(`${returnTo}?error=${encodeURIComponent('Bitte ein Hinflugdatum angeben.')}`)

  const dnaSummary = await buildFamilyDnaSummary(idea.family_id)
  const travelerIds = (session?.traveler_ids as string[] | null) ?? null
  const selectedPersons = travelerIds && travelerIds.length > 0
    ? dnaSummary.persons.filter((p) => travelerIds.includes(p.id))
    : dnaSummary.persons

  // §"Reisebriefing berücksichtigen": exakte Einzelalter zum Hinflugdatum, keine Bucket-Umrechnung an dieser Stelle.
  const passengerAges: Array<number | null> = selectedPersons.length > 0
    ? selectedPersons.map((p) => ageAtDate(p.birth_date, departureDate!))
    : [null]

  let originResolved: { code: string; name: string } | null = null
  let destResolved: { code: string; name: string } | null = null
  try {
    originResolved = await resolveAirportCode(departureCity)
    destResolved = await resolveAirportCode(idea.destination)
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'Die Flugsuche ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Flugsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`)
  }
  if (!originResolved) redirect(`${returnTo}?error=${encodeURIComponent(`Kein Flughafen für "${departureCity}" gefunden -- bitte präzisieren.`)}`)
  if (!destResolved) redirect(`${returnTo}?error=${encodeURIComponent(`Kein Zielflughafen für "${idea.destination}" gefunden -- bitte Ziel präzisieren.`)}`)

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, departureDate)

  let outcome: FlightSearchOutcome
  try {
    outcome = await getOrSearchFlightOptions({
      familyId: idea.family_id,
      originCodes: [originResolved.code],
      destinationCode: destResolved.code,
      departureDate,
      returnDate,
      passengerAges,
      maxStops: session?.max_stopovers ?? null,
      familyDnaText: dnaText,
      stopoverPreference: session?.stopover_preference ?? null,
      forceRefresh: formData.get('force_refresh') === 'on',
    })
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'Die Flugsuche ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Flugsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`)
  }

  if (outcome.status === 'limit_reached')
    redirect(`${returnTo}?error=${encodeURIComponent('Monatliches Such-Limit erreicht -- weitere Suchen sind erst im nächsten Monat möglich.')}`)
  if (outcome.status === 'already_in_progress')
    redirect(`${returnTo}?error=${encodeURIComponent('Für diese Suche läuft bereits eine Anfrage -- bitte kurz warten und erneut versuchen.')}`)
  if (outcome.status === 'no_results')
    redirect(`${returnTo}?error=${encodeURIComponent('Keine Flüge für diese Route/Daten gefunden.')}`)

  const { error: updateError } = await supabase
    .from('trip_ideas')
    .update({ flight_search_key: outcome.searchKey, flight_options_updated_at: outcome.result.searchedAt })
    .eq('id', ideaId)
  if (updateError) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + updateError.message)}`)

  redirect(returnTo)
}
