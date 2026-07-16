'use server'

import { redirect } from 'next/navigation'
import { resolveAirportCode, searchFlights, isFlightProviderSandbox, getFlightProviderName } from '@/lib/providers/flights-provider'
import { ProviderConfigError, ProviderRequestError, describeProviderError } from '@/lib/providers/provider-errors'
import { recordTestRun } from '@/lib/dev-test-runs'

export type FlightSearchTestResult = {
  providerName: string; isSandbox: boolean
  originQuery: string; destinationQuery: string
  originCode: string | null; destinationCode: string | null
  departureDate: string; returnDate: string | null
  offerCount: number
  cheapestPrice: number | null; cheapestCurrency: string | null
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * §"Direkter Provider-Test, kein Business-Layer": ruft `resolveAirportCode`/
 * `searchFlights` bewusst DIREKT auf (nicht die gecachte/quota-geschützte
 * `getOrSearchFlightOptions`-Engine) -- reiner Konnektivitätstest, der nie
 * den Cache oder das monatliche Limit der echten Flugsuche berührt. Zeigt
 * die rohe Duffel-Antwort (Angebotsanzahl, Sandbox/Live, aufgelöste
 * IATA-Codes), damit sich "keine Flüge gefunden" von "Provider-Fehler"
 * unterscheiden lässt.
 */
export async function runFlightSearchTest(formData: FormData) {
  const originQuery = String(formData.get('origin') ?? '').trim()
  const destinationQuery = String(formData.get('destination') ?? '').trim()
  const departureDate = String(formData.get('departure_date') ?? '').trim() || isoDaysFromNow(30)
  const returnDate = String(formData.get('return_date') ?? '').trim() || null

  if (!originQuery || !destinationQuery) redirect('/mehr/developer')

  const providerName = getFlightProviderName()
  const isSandbox = isFlightProviderSandbox()

  let originResolved: { code: string; name: string } | null = null
  let destResolved: { code: string; name: string } | null = null
  try {
    ;[originResolved, destResolved] = await Promise.all([
      resolveAirportCode(originQuery),
      resolveAirportCode(destinationQuery),
    ])
  } catch (e) {
    if (!(e instanceof ProviderConfigError || e instanceof ProviderRequestError)) throw e
    await recordTestRun('flight_search', { success: false, errorMessage: describeProviderError(e) })
    redirect('/mehr/developer')
  }

  if (!originResolved || !destResolved) {
    const missing = [!originResolved ? originQuery : null, !destResolved ? destinationQuery : null].filter(Boolean).join(' / ')
    await recordTestRun('flight_search', { success: false, errorMessage: `Flughafen nicht gefunden: ${missing}` })
    redirect('/mehr/developer')
  }

  let offers: Awaited<ReturnType<typeof searchFlights>> = []
  try {
    offers = await searchFlights({
      originCodes: [originResolved.code], destinationCode: destResolved.code,
      departureDate, returnDate, passengerAges: [null], maxStops: null,
    })
  } catch (e) {
    if (!(e instanceof ProviderConfigError || e instanceof ProviderRequestError)) throw e
    await recordTestRun('flight_search', { success: false, errorMessage: describeProviderError(e) })
    redirect('/mehr/developer')
  }

  const cheapest = offers.length > 0 ? offers.reduce((a, b) => (a.price < b.price ? a : b)) : null

  const result: FlightSearchTestResult = {
    providerName, isSandbox, originQuery, destinationQuery,
    originCode: originResolved.code, destinationCode: destResolved.code,
    departureDate, returnDate, offerCount: offers.length,
    cheapestPrice: cheapest?.price ?? null, cheapestCurrency: cheapest?.currency ?? null,
  }

  await recordTestRun('flight_search', {
    success: true,
    summary: `${originResolved.code} → ${destResolved.code} am ${departureDate}: ${offers.length} Angebote${cheapest ? `, ab ${cheapest.price} ${cheapest.currency}` : ''}`,
    result,
  })
  redirect('/mehr/developer')
}
