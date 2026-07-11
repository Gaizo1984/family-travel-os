import { RESTAURANTS } from '@/lib/data/restaurant-knowledge'
import type { PriceIndicator } from '@/lib/data/hotel-knowledge'

export type RestaurantResult = {
  id: string
  name: string
  destination: string
  cuisine: string
  priceIndicator: PriceIndicator
  mood: string
  photo: string
}

export type RestaurantSearchParams = { destinationName?: string }

/** Provider-Abstraktion, exakt analog zu `lib/providers/hotel-provider.ts`/`lib/weather.ts`. */
interface RestaurantProvider {
  search(params: RestaurantSearchParams): Promise<RestaurantResult[] | null>
}

async function curatedRestaurantSearch(params: RestaurantSearchParams): Promise<RestaurantResult[] | null> {
  let results = RESTAURANTS.map((r, i) => ({
    id: `curated-restaurant-${i}`,
    name: r.name,
    destination: r.destination,
    cuisine: r.cuisine,
    priceIndicator: r.priceIndicator,
    mood: r.mood,
    photo: r.photo,
  }))

  if (params.destinationName) {
    const needle = params.destinationName.toLowerCase()
    const filtered = results.filter((r) => r.destination.toLowerCase().includes(needle) || needle.includes(r.destination.toLowerCase()))
    if (filtered.length > 0) results = filtered
  }

  return results
}

const curatedRestaurantProvider: RestaurantProvider = { search: curatedRestaurantSearch }

/** Einziger Zuweisungspunkt für den aktiven Restaurant-Anbieter. */
const activeRestaurantProvider: RestaurantProvider = curatedRestaurantProvider

export async function searchRestaurants(params: RestaurantSearchParams = {}): Promise<RestaurantResult[] | null> {
  return activeRestaurantProvider.search(params)
}
