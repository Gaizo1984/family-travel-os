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

/**
 * §"Strände nur im sinnvollen Umkreis, Naturziele nur wenn realistisch
 * erreichbar": Restaurants/Sehenswürdigkeiten bleiben lokal eng (25 km),
 * Strände/Naturziele dürfen den vollen Tagesausflugs-Radius nutzen (70 km) --
 * die tatsächliche Erreichbarkeit prüft am Ende ohnehin die echte Fahrzeit
 * (Route Matrix), dieser Radius ist nur eine grobe Vorfilterung.
 */
const CATEGORY_RADIUS_METERS: Record<PlacesCategory, number> = {
  restaurant: 25000, attraction: 25000, beach: 70000, nature: 70000,
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
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: CATEGORY_RADIUS_METERS[params.category] } },
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

const PLACE_LOOKUP_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location'

/**
 * Ein präziser Treffer per Places Text Search (kein Kategorie-/Umkreis-Bias)
 * -- Hotels/POIs sind mit reinem Geocoding oft schlechter auflösbar als mit
 * einer Namenssuche. Genutzt von `resolveReferencePoint` unten.
 */
async function resolvePlaceByName(name: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACE_LOOKUP_FIELD_MASK },
      body: JSON.stringify({ textQuery: name, languageCode: 'de', maxResultCount: 1 }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const first = data?.places?.[0]
    if (!first?.location) return null
    return { lat: first.location.latitude, lng: first.location.longitude, formattedAddress: first.formattedAddress ?? first.displayName?.text ?? name }
  } catch {
    return null
  }
}

export type ReferencePoint = GeocodeResult & { name: string; source: 'hotel' | 'location' }

/**
 * §"Hotel als echter Referenzpunkt": einziger Auflösungsweg für alle
 * Developer-Testmodule, die einen Ausgangspunkt brauchen (Places, Compute
 * Routes, Route Matrix, Tagestrip) -- vermeidet vier unabhängige
 * Implementierungen derselben Hotel-zuerst-Logik. Ist ein Hotel angegeben,
 * wird es per Places Text Search (präziser für POIs/Hotelnamen) und
 * hilfsweise per Geocoding aufgelöst; nur wenn kein Hotel vorhanden/
 * auffindbar ist, fällt die Funktion auf den Haupturlaubsort zurück.
 */
export async function resolveReferencePoint(params: { hotel?: string | null; location: string }): Promise<ReferencePoint | null> {
  const hotel = params.hotel?.trim()
  if (hotel) {
    const viaPlaces = await resolvePlaceByName(hotel)
    if (viaPlaces) return { ...viaPlaces, name: hotel, source: 'hotel' }
    const viaGeocode = await geocodeLocation(hotel)
    if (viaGeocode) return { ...viaGeocode, name: hotel, source: 'hotel' }
  }
  const viaLocation = await geocodeLocation(params.location)
  if (!viaLocation) return null
  return { ...viaLocation, name: params.location, source: 'location' }
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
