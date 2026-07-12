import { DESTINATIONS } from '@/lib/data/destination-knowledge'
import type { Destination } from '@/lib/data/destination-knowledge'

export type DestinationSearchParams = { query?: string }

/**
 * Provider-Abstraktion nach dem `WeatherProvider`/`HotelProvider`-Muster
 * (lib/weather.ts, lib/providers/hotel-provider.ts) — Aufrufer (Discover, LUMI)
 * nutzen NUR `searchDestinations`, nie `lib/data/destination-knowledge.ts`
 * direkt. Season-/Mood-Filterung und DNA-Gewichtung bleiben bewusst in
 * lib/discover-scoring.ts (ein eigener Scoring-Schritt auf dem Ergebnis dieses
 * Providers) — hier nur die reine "welche Ziele gibt es"-Frage.
 */
interface DestinationProvider {
  search(params: DestinationSearchParams): Promise<Destination[] | null>
}

async function curatedDestinationSearch(params: DestinationSearchParams): Promise<Destination[] | null> {
  if (!params.query) return DESTINATIONS
  const needle = params.query.toLowerCase()
  return DESTINATIONS.filter((d) => d.name.toLowerCase().includes(needle))
}

const curatedDestinationProvider: DestinationProvider = { search: curatedDestinationSearch }

/** Einziger Zuweisungspunkt für den aktiven Destinations-Anbieter — siehe DestinationProvider-Kommentar oben. */
const activeDestinationProvider: DestinationProvider = curatedDestinationProvider

export async function searchDestinations(params: DestinationSearchParams = {}): Promise<Destination[] | null> {
  return activeDestinationProvider.search(params)
}
