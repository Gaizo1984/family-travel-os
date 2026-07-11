import { FLIGHT_ROUTES } from '@/lib/data/flight-knowledge'
import type { PriceIndicator } from '@/lib/data/hotel-knowledge'

export type FlightResult = {
  id: string
  route: string
  airlines: string[]
  typicalStopovers: string[]
  priceIndicator: PriceIndicator
  availability: 'unknown'
  flightTimeHint: string
}

export type FlightSearchParams = { destinationId?: string }

/** Provider-Abstraktion, exakt analog zu `lib/providers/hotel-provider.ts`/`lib/weather.ts`. */
interface FlightProvider {
  search(params: FlightSearchParams): Promise<FlightResult[] | null>
}

async function curatedFlightSearch(params: FlightSearchParams): Promise<FlightResult[] | null> {
  const routes = params.destinationId
    ? FLIGHT_ROUTES.filter((r) => r.destinationId === params.destinationId)
    : FLIGHT_ROUTES

  return routes.map((r, i) => ({
    id: `curated-flight-${i}`,
    route: r.route,
    airlines: r.airlines,
    typicalStopovers: r.typicalStopovers,
    priceIndicator: r.priceIndicator,
    availability: 'unknown' as const,
    flightTimeHint: r.flightTimeHint,
  }))
}

const curatedFlightProvider: FlightProvider = { search: curatedFlightSearch }

/** Einziger Zuweisungspunkt für den aktiven Flug-Anbieter. */
const activeFlightProvider: FlightProvider = curatedFlightProvider

export async function searchFlights(params: FlightSearchParams = {}): Promise<FlightResult[] | null> {
  return activeFlightProvider.search(params)
}
