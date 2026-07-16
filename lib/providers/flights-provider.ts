import { ProviderConfigError, ProviderRequestError, logProviderError } from './provider-errors'
import type { FlightSearchOption, FlightItinerary, FlightSegment, BaggageEntryStatus } from '@/lib/flight-types'

/**
 * §"Zentrale, providerneutrale Flug-Engine": Aufrufer kennen ausschließlich
 * `FlightSearchProvider`/`searchFlights`/`resolveAirportCode`/
 * `isFlightProviderSandbox`/`getFlightProviderName` -- niemals Duffel-
 * spezifische Details. Ein Wechsel zu Amadeus/Travelport braucht nur eine
 * neue Klasse, die dieses Interface implementiert, plus einen neuen Wert
 * für `activeFlightSearchProvider` weiter unten. UI und KI-Schicht bleiben
 * davon vollständig unberührt.
 */
export interface FlightSearchProvider {
  isSandbox(): boolean
  /** §"Kein eigener Test-/Live-Codepfad in der UI": liefert nur einen Anzeigenamen -- UI baut daraus generisch "${name}-Testdaten", ohne selbst zu wissen, welcher Provider aktiv ist. */
  providerName(): string
  resolveAirportCode(query: string): Promise<{ code: string; name: string } | null>
  /** §"Mehrere Abflughäfen vorbereiten": originCodes ist bereits ein Array -- diese Phase ruft immer mit genau einem Element auf. */
  searchFlights(params: {
    originCodes: string[]
    destinationCode: string
    departureDate: string
    returnDate: string | null
    /** Ein Eintrag pro Reisendem, `null` = Alter unbekannt (wird als Erwachsener behandelt). */
    passengerAges: Array<number | null>
    maxStops: number | null
  }): Promise<FlightSearchOption[]>
}

const DUFFEL_BASE_URL = 'https://api.duffel.com'

function duffelHeaders(apiKey: string, isPost: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Duffel-Version': 'v2',
    Accept: 'application/json',
  }
  if (isPost) headers['Content-Type'] = 'application/json'
  return headers
}

function requireApiKey(requestType: 'flight_search' | 'airport_lookup'): string {
  const apiKey = process.env.DUFFEL_API_KEY
  if (!apiKey) {
    const err = new ProviderConfigError('flights', requestType)
    logProviderError(err)
    throw err
  }
  return apiKey
}

/**
 * §"Live-Modus-Sperre" (Nutzervorgabe): ein `duffel_live_...`-Token allein
 * reicht NICHT, um echte Live-Suchen auszulösen -- `DUFFEL_LIVE_MODE_ENABLED`
 * muss zusätzlich exakt `'true'` sein. Fehlt das, wird der Aufruf hart
 * abgelehnt statt stillschweigend zu laufen.
 */
function assertLiveModeAllowed(apiKey: string, requestType: 'flight_search' | 'airport_lookup'): void {
  const isLiveToken = apiKey.startsWith('duffel_live_')
  const liveModeEnabled = process.env.DUFFEL_LIVE_MODE_ENABLED === 'true'
  if (isLiveToken && !liveModeEnabled) {
    const err = new ProviderConfigError('flights', requestType)
    logProviderError(err)
    throw err
  }
}

/** Test- und Livebetrieb werden ausschließlich serverseitig anhand des Tokens (+ der zusätzlichen Freischaltung) unterschieden -- niemals in der UI. */
function duffelIsSandbox(): boolean {
  const apiKey = process.env.DUFFEL_API_KEY ?? ''
  const isLiveToken = apiKey.startsWith('duffel_live_')
  const liveModeEnabled = process.env.DUFFEL_LIVE_MODE_ENABLED === 'true'
  return !(isLiveToken && liveModeEnabled)
}

/**
 * §"Button reagiert nicht, keine Ergebnisse": ohne eigenes Timeout hängt ein
 * langsamer/hängender Duffel-Call unbegrenzt (bis die Plattform die Funktion
 * irgendwann selbst abbricht) -- ohne für den Nutzer sichtbaren Fehler.
 * Bricht stattdessen kontrolliert ab und wirft einen normalen, oben bereits
 * behandelten Fehler (`ProviderRequestError`), der eine klare Meldung zeigt.
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function extractDuffelErrorCode(res: Response): Promise<string | undefined> {
  try {
    const data = await res.json()
    const first = data?.errors?.[0]
    return typeof first?.code === 'string' ? first.code : undefined
  } catch {
    return undefined
  }
}

function parseIsoDurationMinutes(iso: string | undefined): number {
  if (!iso) return 0
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (!match) return 0
  const hours = match[1] ? Number(match[1]) : 0
  const minutes = match[2] ? Number(match[2]) : 0
  return hours * 60 + minutes
}

/** §"Gepäcklogik, nicht repräsentativ": pro Passagier, direkt aus Duffels segment.passengers[].baggages[] -- fehlt das Feld, ist der Status 'unknown', NIE stillschweigend 'excluded'. */
function baggageEntryStatus(passenger: any): BaggageEntryStatus {
  if (!Array.isArray(passenger?.baggages)) return 'unknown'
  const hasCheckedIncluded = passenger.baggages.some((b: any) => b?.type === 'checked' && Number(b?.quantity ?? 0) > 0)
  return hasCheckedIncluded ? 'included' : 'excluded'
}

function mapSegment(raw: any): FlightSegment {
  return {
    carrierCode: raw?.operating_carrier?.iata_code ?? raw?.operating_carrier?.id ?? '',
    carrierName: raw?.operating_carrier?.name ?? null,
    flightNumber: `${raw?.operating_carrier?.iata_code ?? ''}${raw?.operating_carrier_flight_number ?? ''}`,
    departureAirport: raw?.origin?.iata_code ?? '',
    departureTime: raw?.departing_at ?? '',
    arrivalAirport: raw?.destination?.iata_code ?? '',
    arrivalTime: raw?.arriving_at ?? '',
    durationMinutes: parseIsoDurationMinutes(raw?.duration),
    checkedBaggageByPassenger: (raw?.passengers ?? []).map(baggageEntryStatus),
  }
}

function mapSlice(raw: any): FlightItinerary {
  const segments: FlightSegment[] = (raw?.segments ?? []).map(mapSegment)
  return {
    segments,
    durationMinutes: parseIsoDurationMinutes(raw?.duration),
    stopCount: Math.max(0, segments.length - 1),
  }
}

function mapOffer(offer: any, originCode: string): FlightSearchOption | null {
  const slices = offer?.slices ?? []
  if (slices.length === 0 || !offer?.id) return null
  const price = Number(offer.total_amount)
  if (Number.isNaN(price)) return null

  const outbound = mapSlice(slices[0])
  const inbound = slices[1] ? mapSlice(slices[1]) : null

  return {
    id: String(offer.id),
    originCode,
    outbound,
    inbound,
    totalDurationMinutes: outbound.durationMinutes + (inbound?.durationMinutes ?? 0),
    maxStopCount: Math.max(outbound.stopCount, inbound?.stopCount ?? 0),
    price,
    currency: offer.total_currency ?? 'EUR',
    // §"Angebotsgültigkeit": 1:1 von Duffel übernommen -- fehlt das Feld
    // ausnahmsweise, gilt das Angebot vorsichtshalber als bereits
    // abgelaufen (Epoch), statt eine erfundene Gültigkeit zu unterstellen.
    expiresAt: typeof offer.expires_at === 'string' ? offer.expires_at : new Date(0).toISOString(),
    // Platzhalter -- der tatsächliche Wert wird von FlightScoringService.computeBadges
    // aus den rohen checkedBaggageByPassenger-Einträgen berechnet, nie hier.
    checkedBaggageStatus: 'not_verified',
    badges: [],
    comparisonHints: [],
    aiReasoning: null,
  }
}

/**
 * §"Mehrere Abflughäfen vorbereiten": iteriert bereits jetzt über
 * `originCodes` (diese Phase immer genau ein Element), markiert jedes
 * Ergebnis mit seinem tatsächlichen Origin.
 */
async function duffelSearchFlights(params: {
  originCodes: string[]
  destinationCode: string
  departureDate: string
  returnDate: string | null
  passengerAges: Array<number | null>
  maxStops: number | null
}): Promise<FlightSearchOption[]> {
  const apiKey = requireApiKey('flight_search')
  assertLiveModeAllowed(apiKey, 'flight_search')

  const passengers = params.passengerAges.map((age) => (age === null || age >= 18 ? { type: 'adult' } : { age }))

  const results: FlightSearchOption[] = []
  for (const originCode of params.originCodes) {
    const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
      { origin: originCode, destination: params.destinationCode, departure_date: params.departureDate },
    ]
    if (params.returnDate) slices.push({ origin: params.destinationCode, destination: originCode, departure_date: params.returnDate })

    try {
      const res = await fetchWithTimeout(`${DUFFEL_BASE_URL}/air/offer_requests?return_offers=true`, {
        method: 'POST',
        headers: duffelHeaders(apiKey, true),
        body: JSON.stringify({ data: { slices, passengers } }),
        cache: 'no-store',
      }, 25_000)
      if (!res.ok) {
        const err = new ProviderRequestError('flights', 'flight_search', res.status, await extractDuffelErrorCode(res))
        logProviderError(err)
        throw err
      }
      const data = await res.json()
      const offers: any[] = Array.isArray(data?.data?.offers) ? data.data.offers : []
      for (const offer of offers) {
        const mapped = mapOffer(offer, originCode)
        if (mapped && (params.maxStops === null || mapped.maxStopCount <= params.maxStops)) results.push(mapped)
      }
    } catch (e) {
      if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
      const err = new ProviderRequestError('flights', 'flight_search', 0)
      logProviderError(err)
      throw err
    }
  }
  return results
}

async function duffelResolveAirportCode(query: string): Promise<{ code: string; name: string } | null> {
  const apiKey = requireApiKey('airport_lookup')
  assertLiveModeAllowed(apiKey, 'airport_lookup')
  try {
    const params = new URLSearchParams({ query })
    const res = await fetchWithTimeout(`${DUFFEL_BASE_URL}/places/suggestions?${params.toString()}`, {
      headers: duffelHeaders(apiKey, false),
      cache: 'no-store',
    }, 10_000)
    if (!res.ok) {
      const err = new ProviderRequestError('flights', 'airport_lookup', res.status, await extractDuffelErrorCode(res))
      logProviderError(err)
      throw err
    }
    const data = await res.json()
    const items: any[] = Array.isArray(data?.data) ? data.data : []
    const match = items.find((i) => typeof i?.iata_code === 'string' && i.iata_code.length === 3)
    if (!match) return null
    return { code: match.iata_code, name: match.name ?? match.iata_code }
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('flights', 'airport_lookup', 0)
    logProviderError(err)
    throw err
  }
}

class DuffelFlightSearchProvider implements FlightSearchProvider {
  isSandbox(): boolean {
    return duffelIsSandbox()
  }
  providerName(): string {
    return 'Duffel'
  }
  resolveAirportCode(query: string) {
    return duffelResolveAirportCode(query)
  }
  searchFlights(params: Parameters<FlightSearchProvider['searchFlights']>[0]) {
    return duffelSearchFlights(params)
  }
}

/** Einziger Zuweisungspunkt für den aktiven Flug-Anbieter — siehe FlightSearchProvider-Kommentar oben. */
const activeFlightSearchProvider: FlightSearchProvider = new DuffelFlightSearchProvider()

export function resolveAirportCode(query: string): Promise<{ code: string; name: string } | null> {
  return activeFlightSearchProvider.resolveAirportCode(query)
}

export function searchFlights(params: Parameters<FlightSearchProvider['searchFlights']>[0]): Promise<FlightSearchOption[]> {
  return activeFlightSearchProvider.searchFlights(params)
}

export function isFlightProviderSandbox(): boolean {
  return activeFlightSearchProvider.isSandbox()
}

export function getFlightProviderName(): string {
  return activeFlightSearchProvider.providerName()
}
