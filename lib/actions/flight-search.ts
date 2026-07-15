'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
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

function buildFlightsPageUrl(params: {
  destination?: string | null; departureCity?: string | null
  departureDate?: string | null; returnDate?: string | null
  travelerIds?: string[]; ideaId?: string | null; searchKey?: string | null; error?: string | null
}): string {
  const usp = new URLSearchParams()
  if (params.destination) usp.set('destination', params.destination)
  if (params.departureCity) usp.set('departure_city', params.departureCity)
  if (params.departureDate) usp.set('departure_date', params.departureDate)
  if (params.returnDate) usp.set('return_date', params.returnDate)
  if (params.travelerIds && params.travelerIds.length > 0) usp.set('traveler_ids', params.travelerIds.join(','))
  if (params.ideaId) usp.set('idea_id', params.ideaId)
  if (params.searchKey) usp.set('search_key', params.searchKey)
  if (params.error) usp.set('error', params.error)
  return `/discover/flights?${usp.toString()}`
}

/**
 * §"Eine einzige Flugvergleich-UI, keine doppelte Logik": ersetzt die
 * frühere idee-gekoppelte `searchFlightOptions` vollständig. Funktioniert
 * sowohl mit leeren Suchparametern (Kachel auf `/discover`) als auch
 * vorausgefüllt (Deep-Link von einer Ideen-Detailseite, inkl. optionalem
 * `idea_id`-Feld) -- einziger Auslöser für den echten Providerruf ist der
 * Button-Klick auf `/discover/flights`, nie ein Seitenaufruf.
 */
export async function searchFlightsStandalone(formData: FormData) {
  const destination = String(formData.get('destination') ?? '').trim()
  const departureCity = String(formData.get('departure_city') ?? '').trim()
  const travelerIds = formData.getAll('traveler_ids').map(String)
  const ideaId = String(formData.get('idea_id') ?? '').trim() || null

  const redirectBack = (error: string, departureDate?: string | null, returnDate?: string | null): never => {
    redirect(buildFlightsPageUrl({ destination, departureCity, departureDate, returnDate, travelerIds, ideaId, error }))
  }

  if (!destination) redirectBack('Bitte ein Reiseziel angeben.')
  if (!departureCity) redirectBack('Bitte einen Abflugort angeben.')

  let departureDate: string | null = null
  let returnDate: string | null = null
  try {
    departureDate = readDateGroupFromFormData(formData, 'departure_date', 'Hinflugdatum')
    returnDate = readDateGroupFromFormData(formData, 'return_date', 'Rückflugdatum')
  } catch (e) {
    redirectBack(e instanceof Error ? e.message : 'Ungültiges Datum')
  }
  if (!departureDate) redirectBack('Bitte ein Hinflugdatum angeben.')

  const { id: familyId } = await getFamily()
  const dnaSummary = await buildFamilyDnaSummary(familyId)
  const selectedPersons = travelerIds.length > 0
    ? dnaSummary.persons.filter((p) => travelerIds.includes(p.id))
    : dnaSummary.persons

  const passengerAges: Array<number | null> = selectedPersons.length > 0
    ? selectedPersons.map((p) => ageAtDate(p.birth_date, departureDate!))
    : [null]

  let originResolved: { code: string; name: string } | null = null
  let destResolved: { code: string; name: string } | null = null
  try {
    originResolved = await resolveAirportCode(departureCity)
    destResolved = await resolveAirportCode(destination)
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'Die Flugsuche ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Flugsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    redirectBack(message, departureDate, returnDate)
  }
  if (!originResolved) redirectBack(`Kein Flughafen für "${departureCity}" gefunden -- bitte präzisieren.`, departureDate, returnDate)
  if (!destResolved) redirectBack(`Kein Zielflughafen für "${destination}" gefunden -- bitte Ziel präzisieren.`, departureDate, returnDate)

  const safeDepartureDate = departureDate!

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, safeDepartureDate)

  let outcome!: FlightSearchOutcome
  try {
    outcome = await getOrSearchFlightOptions({
      familyId,
      originCodes: [originResolved!.code],
      destinationCode: destResolved!.code,
      departureDate: safeDepartureDate,
      returnDate,
      passengerAges,
      maxStops: null,
      familyDnaText: dnaText,
      stopoverPreference: null,
      forceRefresh: formData.get('force_refresh') === 'on',
    })
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'Die Flugsuche ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Flugsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    redirectBack(message, departureDate, returnDate)
  }

  if (outcome.status === 'limit_reached')
    redirectBack('Monatliches Such-Limit erreicht -- weitere Suchen sind erst im nächsten Monat möglich.', departureDate, returnDate)
  if (outcome.status === 'already_in_progress')
    redirectBack('Für diese Suche läuft bereits eine Anfrage -- bitte kurz warten und erneut versuchen.', departureDate, returnDate)
  if (outcome.status === 'no_results')
    redirectBack('Keine Flüge für diese Route/Daten gefunden.', departureDate, returnDate)

  const okOutcome = outcome as Extract<FlightSearchOutcome, { status: 'ok' }>

  // §"Zuletzt gesucht"-Erinnerung auf der Ideen-Seite: best-effort, blockiert die eigentliche Anzeige nicht.
  if (ideaId) {
    const supabase = await createClient()
    await supabase
      .from('trip_ideas')
      .update({ flight_search_key: okOutcome.searchKey, flight_options_updated_at: okOutcome.result.searchedAt })
      .eq('id', ideaId)
  }

  redirect(buildFlightsPageUrl({
    destination, departureCity, departureDate, returnDate, travelerIds, ideaId, searchKey: okOutcome.searchKey,
  }))
}
