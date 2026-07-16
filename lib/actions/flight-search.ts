'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, ageAtDate } from '@/lib/family-dna'
import { resolveAirportCode, searchFlights, isFlightProviderSandbox } from '@/lib/providers/flights-provider'
import { ProviderConfigError, ProviderRequestError, describeProviderError } from '@/lib/providers/provider-errors'
import { FlightScoringService } from '@/lib/flight-scoring-service'
import { generateFlightReasoning } from '@/lib/flight-advisor-ai'
import { readDateGroupFromFormData } from '@/lib/documents'
import { isoToday, isBeforeIso } from '@/lib/date-utils'
import { generateFlexibleDateCombinations } from '@/lib/flight-date-combinations'
import type { FlightSearchOption, FlightSearchResult } from '@/lib/flight-types'
import type { Json } from '@/lib/supabase/types'

/** Kostenkontrolle: KI-Begründung nur für eine begrenzte, bereits vorsortierte Kandidatenzahl -- nicht für die gesamte Trefferliste. */
const MAX_AI_REASONING_CANDIDATES = 8

/** §"Sandbox liefert tausende Fake-Angebote": nach LUMI-Score sortiert werden nur die besten N gespeichert/angezeigt -- niemand braucht Tausende Flugkarten. */
const MAX_STORED_OFFERS = 40

/** §"Mehrfachklicks/parallele Suchen verhindern": Claim gilt als "noch laufend", solange er jünger als das ist -- danach self-heals ein hängengebliebener Claim automatisch. */
const CLAIM_TTL_MS = 60_000

const DEFAULT_MONTHLY_LIMIT = 50

export type FlightSearchOutcome =
  | { status: 'ok'; searchKey: string; result: FlightSearchResult }
  | { status: 'limit_reached' }
  | { status: 'already_in_progress' }
  | { status: 'no_results' }

/**
 * §"Konkrete Fehlerursache statt allgemeiner Meldung" (Nutzervorgabe): zeigt
 * bei einem Provider-Fehler direkt HTTP-Status/Fehlercode im Banner an
 * (dieselbe Information wie die Developer-Testkarten), statt hinter einer
 * generischen "gerade fehlgeschlagen"-Meldung zu verschwinden.
 */
function describeFlightSearchFailure(e: unknown): string {
  if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) return describeProviderError(e)
  return 'Die Flugsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
}

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
  const sortedAll = FlightScoringService.sortByDefault(withBadges)

  // §"Sandbox liefert tausende Fake-Angebote": Duffels Testmodus kann
  // mehrere Tausend synthetische Kombinationen zurückgeben -- ungekürzt
  // gespeichert/gerendert sprengt das den JSONB-Cache-Eintrag und die
  // Ergebnisseite (Tausende Flugkarten). Niemand braucht mehr als die
  // bereits nach LUMI-Score sortierten besten Treffer.
  const sorted = sortedAll.slice(0, MAX_STORED_OFFERS)

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
  // §"Nie stillschweigend 'ok' zurückgeben, wenn nichts gespeichert wurde":
  // ein bloß geloggter, aber ignorierter Speicherfehler hätte zuvor zu einem
  // Redirect mit einem search_key geführt, unter dem die Ergebnisseite
  // nichts findet -- kein Banner, keine Karten, nur eine leere Seite.
  if (upsertError) {
    console.error('[flight_search_cache] Speicherfehler:', upsertError.message)
    throw new Error('Suchergebnisse konnten nicht gespeichert werden.')
  }

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
  travelerIds?: string[]; ideaId?: string | null; searchKey?: string | null
  mode?: 'fixed' | 'flexible'
  windowStartDate?: string | null; windowEndDate?: string | null
  nightsMin?: string | null; nightsMax?: string | null
  batch?: number | null; searchKeys?: string[] | null
  error?: string | null
}): string {
  const usp = new URLSearchParams()
  if (params.destination) usp.set('destination', params.destination)
  if (params.departureCity) usp.set('departure_city', params.departureCity)
  if (params.departureDate) usp.set('departure_date', params.departureDate)
  if (params.returnDate) usp.set('return_date', params.returnDate)
  if (params.travelerIds && params.travelerIds.length > 0) usp.set('traveler_ids', params.travelerIds.join(','))
  if (params.ideaId) usp.set('idea_id', params.ideaId)
  if (params.searchKey) usp.set('search_key', params.searchKey)
  if (params.mode) usp.set('mode', params.mode)
  if (params.windowStartDate) usp.set('window_start_date', params.windowStartDate)
  if (params.windowEndDate) usp.set('window_end_date', params.windowEndDate)
  if (params.nightsMin) usp.set('nights_min', params.nightsMin)
  if (params.nightsMax) usp.set('nights_max', params.nightsMax)
  if (params.batch != null) usp.set('batch', String(params.batch))
  if (params.searchKeys && params.searchKeys.length > 0) usp.set('search_keys', params.searchKeys.join(','))
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
  const searchMode: 'fixed' | 'flexible' = String(formData.get('search_mode') ?? 'fixed') === 'flexible' ? 'flexible' : 'fixed'

  const redirectBack = (error: string, extra?: Partial<Parameters<typeof buildFlightsPageUrl>[0]>): never => {
    redirect(buildFlightsPageUrl({ destination, departureCity, travelerIds, ideaId, mode: searchMode, error, ...extra }))
  }

  if (!destination) redirectBack('Bitte ein Reiseziel angeben.')
  if (!departureCity) redirectBack('Bitte einen Abflugort angeben.')

  const { id: familyId } = await getFamily()
  const dnaSummary = await buildFamilyDnaSummary(familyId)
  const selectedPersons = travelerIds.length > 0
    ? dnaSummary.persons.filter((p) => travelerIds.includes(p.id))
    : dnaSummary.persons

  let originResolved: { code: string; name: string } | null = null
  let destResolved: { code: string; name: string } | null = null
  try {
    originResolved = await resolveAirportCode(departureCity)
    destResolved = await resolveAirportCode(destination)
  } catch (e) {
    redirectBack(describeFlightSearchFailure(e))
  }
  if (!originResolved) redirectBack(`Kein Flughafen für "${departureCity}" gefunden -- bitte präzisieren.`)
  if (!destResolved) redirectBack(`Kein Zielflughafen für "${destination}" gefunden -- bitte Ziel präzisieren.`)

  if (searchMode === 'flexible') {
    await searchFlightsFlexible(formData, {
      familyId, dnaSummary, selectedPersons, destination, departureCity, travelerIds, ideaId, redirectBack,
      originCode: originResolved!.code, destinationCode: destResolved!.code,
    })
    return
  }

  let departureDate: string | null = null
  let returnDate: string | null = null
  try {
    departureDate = readDateGroupFromFormData(formData, 'departure_date', 'Hinflugdatum')
    returnDate = readDateGroupFromFormData(formData, 'return_date', 'Rückflugdatum')
  } catch (e) {
    redirectBack(e instanceof Error ? e.message : 'Ungültiges Datum')
  }
  if (!departureDate) redirectBack('Bitte ein Hinflugdatum angeben.')

  const today = isoToday()
  if (isBeforeIso(departureDate!, today)) redirectBack('Das Hinflugdatum darf nicht in der Vergangenheit liegen.')
  if (returnDate && isBeforeIso(returnDate, departureDate!))
    redirectBack('Der Rückflug darf nicht vor dem Hinflug liegen.', { departureDate })

  const passengerAges: Array<number | null> = selectedPersons.length > 0
    ? selectedPersons.map((p) => ageAtDate(p.birth_date, departureDate!))
    : [null]

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
    redirectBack(describeFlightSearchFailure(e), { departureDate, returnDate })
  }

  if (outcome.status === 'limit_reached')
    redirectBack('Monatliches Such-Limit erreicht -- weitere Suchen sind erst im nächsten Monat möglich.', { departureDate, returnDate })
  if (outcome.status === 'already_in_progress')
    redirectBack('Für diese Suche läuft bereits eine Anfrage -- bitte kurz warten und erneut versuchen.', { departureDate, returnDate })
  if (outcome.status === 'no_results')
    redirectBack('Keine Flüge für diese Route/Daten gefunden.', { departureDate, returnDate })

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
    destination, departureCity, departureDate, returnDate, travelerIds, ideaId, searchKey: okOutcome.searchKey, mode: 'fixed',
  }))
}

/**
 * Flexible Suche: erzeugt aus Reisefenster + Nächte-Bereich eine gedeckelte
 * Anzahl Datumskombinationen (`lib/flight-date-combinations.ts`, deterministisch,
 * kein zweiter Suchalgorithmus) und ruft für jede dieselbe, unveränderte
 * `getOrSearchFlightOptions`-Engine auf wie der feste Modus -- Cache-Treffer
 * lösen dabei keinen neuen Duffel-Call aus. Bricht kontrolliert ab, sobald
 * das monatliche Limit erreicht wird, statt abzustürzen.
 */
async function searchFlightsFlexible(
  formData: FormData,
  ctx: {
    familyId: string
    dnaSummary: Awaited<ReturnType<typeof buildFamilyDnaSummary>>
    selectedPersons: Awaited<ReturnType<typeof buildFamilyDnaSummary>>['persons']
    destination: string; departureCity: string; travelerIds: string[]; ideaId: string | null
    originCode: string; destinationCode: string
    redirectBack: (error: string, extra?: Partial<Parameters<typeof buildFlightsPageUrl>[0]>) => never
  },
): Promise<void> {
  const { familyId, dnaSummary, selectedPersons, destination, departureCity, travelerIds, ideaId, originCode, destinationCode, redirectBack } = ctx

  let windowStart: string | null = null
  let windowEnd: string | null = null
  try {
    windowStart = readDateGroupFromFormData(formData, 'window_start_date', 'Frühester Abflug')
    windowEnd = readDateGroupFromFormData(formData, 'window_end_date', 'Späteste Rückkehr')
  } catch (e) {
    redirectBack(e instanceof Error ? e.message : 'Ungültiges Datum')
  }
  if (!windowStart) redirectBack('Bitte ein frühestes Abflugdatum angeben.')
  if (!windowEnd) redirectBack('Bitte ein spätestes Rückkehrdatum angeben.')

  const today = isoToday()
  if (isBeforeIso(windowStart!, today)) redirectBack('Das Reisefenster darf nicht in der Vergangenheit beginnen.')
  if (isBeforeIso(windowEnd!, windowStart!))
    redirectBack('Die späteste Rückkehr darf nicht vor dem frühesten Abflug liegen.', { windowStartDate: windowStart, mode: 'flexible' })

  const nightsMin = Number(formData.get('nights_min') ?? '')
  const nightsMax = Number(formData.get('nights_max') ?? '')
  const flexibleExtra = { windowStartDate: windowStart!, windowEndDate: windowEnd!, nightsMin: String(nightsMin || ''), nightsMax: String(nightsMax || ''), mode: 'flexible' as const }
  if (!Number.isFinite(nightsMin) || nightsMin < 1) redirectBack('Bitte eine gültige Nächtezahl (ab) angeben.', flexibleExtra)
  if (!Number.isFinite(nightsMax) || nightsMax < nightsMin) redirectBack('Die maximale Nächtezahl muss mindestens der minimalen entsprechen.', flexibleExtra)

  const batch = Math.max(0, Number(formData.get('batch') ?? '0') || 0)
  const existingSearchKeys = String(formData.get('existing_search_keys') ?? '').split(',').map((k) => k.trim()).filter(Boolean)

  const combinations = generateFlexibleDateCombinations(windowStart!, windowEnd!, nightsMin, nightsMax, batch)
  if (combinations.length === 0)
    redirectBack('Für dieses Reisefenster und diese Nächtezahl gibt es keine weiteren Datumskombinationen.', flexibleExtra)

  // §"Analysiert viel zu lange": bis zu MAX_FLEXIBLE_DATE_COMBINATIONS
  // sequentielle Duffel-Aufrufe (je mehrere Sekunden) summierten sich zu
  // einer Laufzeit, die leicht ein Vercel-Funktions-Timeout reißt -- läuft
  // stattdessen in kleinen parallelen Blöcken, ohne die Kostenkontrolle
  // (Claim-Guard/monatliches Limit in `getOrSearchFlightOptions`) zu ändern.
  const FLEXIBLE_SEARCH_CONCURRENCY = 4
  const newSearchKeys: string[] = []
  let limitReached = false
  let lastError: string | null = null
  for (let i = 0; i < combinations.length && !limitReached; i += FLEXIBLE_SEARCH_CONCURRENCY) {
    const chunk = combinations.slice(i, i + FLEXIBLE_SEARCH_CONCURRENCY)
    const chunkOutcomes = await Promise.all(chunk.map(async (combo) => {
      const passengerAges: Array<number | null> = selectedPersons.length > 0
        ? selectedPersons.map((p) => ageAtDate(p.birth_date, combo.departureDate))
        : [null]
      const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, combo.departureDate)
      try {
        return await getOrSearchFlightOptions({
          familyId, originCodes: [originCode], destinationCode,
          departureDate: combo.departureDate, returnDate: combo.returnDate,
          passengerAges, maxStops: null, familyDnaText: dnaText, stopoverPreference: null,
        })
      } catch (e) {
        lastError = describeFlightSearchFailure(e) // einzelne fehlgeschlagene Kombination überspringen, Rest der flexiblen Suche fortsetzen -- Ursache aber für die "keine Flüge gefunden"-Meldung merken
        return null
      }
    }))

    for (const comboOutcome of chunkOutcomes) {
      if (!comboOutcome) continue
      if (comboOutcome.status === 'ok') newSearchKeys.push(comboOutcome.searchKey)
      else if (comboOutcome.status === 'limit_reached') limitReached = true
      // 'already_in_progress'/'no_results' für diese eine Kombination: überspringen, nicht die ganze Suche abbrechen
    }
  }

  const allSearchKeys = Array.from(new Set([...existingSearchKeys, ...newSearchKeys]))
  if (allSearchKeys.length === 0)
    redirectBack(
      lastError ? `Keine Flüge für die geprüften Datumsvarianten gefunden (${lastError}).` : 'Keine Flüge für die geprüften Datumsvarianten gefunden.',
      flexibleExtra,
    )

  redirect(buildFlightsPageUrl({
    destination, departureCity, travelerIds, ideaId, mode: 'flexible',
    windowStartDate: windowStart, windowEndDate: windowEnd, nightsMin: String(nightsMin), nightsMax: String(nightsMax),
    batch, searchKeys: allSearchKeys,
    error: limitReached ? `${newSearchKeys.length} von ${combinations.length} Datumsvarianten geprüft, Rest übersprungen (monatliches Such-Limit erreicht).` : undefined,
  }))
}
