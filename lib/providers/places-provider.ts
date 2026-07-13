const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

export type PlacesCategory = 'restaurant' | 'attraction' | 'beach' | 'nature'

export type GeocodeResult = { lat: number; lng: number; formattedAddress: string }

export type PlaceResult = {
  id: string
  name: string
  formattedAddress: string
  lat: number
  lng: number
  rating: number | null
  userRatingCount: number | null
  openNow: boolean | null
  weekdayDescriptions: string[] | null
  photoName: string | null
}

export type PlacesSearchParams = { locationName: string; category: PlacesCategory; lat?: number; lng?: number }

const CATEGORY_QUERY: Record<PlacesCategory, (location: string) => string> = {
  restaurant: (location) => `Restaurants in der Nähe von ${location}`,
  attraction: (location) => `Sehenswürdigkeiten in der Nähe von ${location}`,
  beach: (location) => `Strände in der Nähe von ${location}`,
  nature: (location) => `Naturziele in der Nähe von ${location}`,
}

const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours',
  'places.photos',
].join(',')

/**
 * Provider-Abstraktion nach dem `WeatherProvider`-Muster (lib/weather.ts):
 * Aufrufer kennen nur `geocodeLocation`/`searchPlaces` -- ein Wechsel des
 * Anbieters bräuchte nur eine neue Implementierung dieses Interfaces.
 */
interface PlacesProvider {
  geocode(query: string): Promise<GeocodeResult | null>
  search(params: PlacesSearchParams): Promise<PlaceResult[] | null>
}

async function googleGeocode(query: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null
  try {
    const params = new URLSearchParams({ address: query, language: 'de', key: apiKey })
    const res = await fetch(`${GEOCODING_URL}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const first = data?.results?.[0]
    if (!first) return null
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    }
  } catch {
    return null
  }
}

async function googlePlacesSearch(params: PlacesSearchParams): Promise<PlaceResult[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  let lat = params.lat
  let lng = params.lng
  if (lat === undefined || lng === undefined) {
    const geo = await googleGeocode(params.locationName)
    if (!geo) return null
    lat = geo.lat
    lng = geo.lng
  }

  try {
    const res = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: CATEGORY_QUERY[params.category](params.locationName),
        languageCode: 'de',
        maxResultCount: 8,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 40000 } },
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const places: any[] = data?.places ?? []
    return places.map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? '',
      formattedAddress: p.formattedAddress ?? '',
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      openNow: p.currentOpeningHours?.openNow ?? null,
      weekdayDescriptions: p.currentOpeningHours?.weekdayDescriptions ?? null,
      photoName: p.photos?.[0]?.name ?? null,
    }))
  } catch {
    return null
  }
}

const googlePlacesProvider: PlacesProvider = { geocode: googleGeocode, search: googlePlacesSearch }

/** Einziger Zuweisungspunkt für den aktiven Places-Anbieter — siehe PlacesProvider-Kommentar oben. */
const activePlacesProvider: PlacesProvider = googlePlacesProvider

export async function geocodeLocation(name: string): Promise<GeocodeResult | null> {
  return activePlacesProvider.geocode(name)
}

export async function searchPlaces(params: PlacesSearchParams): Promise<PlaceResult[] | null> {
  return activePlacesProvider.search(params)
}

const EARTH_RADIUS_KM = 6371

/** Luftlinien-Entfernung (keine weitere API) — reale Fahrzeit/-strecke liefert lib/providers/routes-provider.ts. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
