import { HOTELS } from '@/lib/data/hotel-knowledge'
import type { PriceIndicator } from '@/lib/data/hotel-knowledge'

export type HotelResult = {
  id: string
  name: string
  destination: string
  priceIndicator: PriceIndicator
  availability: 'unknown'
  photo: string
  styleTags: string[]
  highlights: string[]
}

export type HotelSearchParams = { destinationName?: string; styleTags?: string[] }

/**
 * Provider-Abstraktion nach dem `WeatherProvider`-Muster (lib/weather.ts):
 * `availability` bleibt bewusst auf `'unknown'` fixiert, `priceIndicator`
 * bewusst auf €/€€/€€€ statt echtem Preis — die Shape ist so gebaut, dass
 * eine echte Live-API später `priceIndicator`/`availability` durch reale
 * Werte ersetzen kann, ohne die Shape selbst zu brechen. Aufrufer nutzen
 * NUR `searchHotels`, nie `lib/data/hotel-knowledge.ts` direkt.
 */
interface HotelProvider {
  search(params: HotelSearchParams): Promise<HotelResult[] | null>
}

async function curatedHotelSearch(params: HotelSearchParams): Promise<HotelResult[] | null> {
  const results = HOTELS.map((h, i) => ({
    id: `curated-hotel-${i}`,
    name: h.name,
    destination: h.destination,
    priceIndicator: h.priceIndicator,
    availability: 'unknown' as const,
    photo: h.photo,
    styleTags: h.hotelStyleTags,
    highlights: h.highlights,
  }))

  if (!params.destinationName) return results

  // §"Keine weltweiten Platzhaltervorschläge mehr": kein Treffer für das
  // gesuchte Ziel bedeutet "keine kuratierten Daten dafür" (null), nicht die
  // volle, unpassende Weltliste.
  const needle = params.destinationName.toLowerCase()
  const filtered = results.filter((r) => r.destination.toLowerCase().includes(needle) || needle.includes(r.destination.toLowerCase()))
  return filtered.length > 0 ? filtered : null
}

const curatedHotelProvider: HotelProvider = { search: curatedHotelSearch }

/** Einziger Zuweisungspunkt für den aktiven Hotel-Anbieter — siehe HotelProvider-Kommentar oben. */
const activeHotelProvider: HotelProvider = curatedHotelProvider

export async function searchHotels(params: HotelSearchParams = {}): Promise<HotelResult[] | null> {
  return activeHotelProvider.search(params)
}
