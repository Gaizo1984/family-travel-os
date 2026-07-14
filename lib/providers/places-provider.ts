import { ProviderConfigError, ProviderRequestError, extractGoogleErrorCode, logProviderError } from './provider-errors'

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
  types: string[]
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
 * Strände/Naturziele dürfen einen größeren Tagesausflugs-Radius nutzen --
 * die tatsächliche Erreichbarkeit prüft am Ende ohnehin die echte Fahrzeit
 * (Route Matrix), dieser Radius ist nur eine grobe Vorfilterung.
 *
 * §Bugfix "Strände/Natur liefern immer 'Suche fehlgeschlagen'": Google
 * Places API (New) erlaubt für `locationBias.circle.radius` laut Doku
 * ausschließlich Werte zwischen 0.0 und 50000.0 -- der vorherige Wert von
 * 70000 wurde von Google zuverlässig mit 400 INVALID_ARGUMENT abgelehnt.
 * 50000 ist der größtmögliche noch gültige Wert.
 */
const CATEGORY_RADIUS_METERS: Record<PlacesCategory, number> = {
  restaurant: 25000, attraction: 25000, beach: 50000, nature: 50000,
}

/** Google Places API (New) erlaubt maximal 20 Treffer pro Suchanfrage (maxResultCount/pageSize). */
const MAX_GOOGLE_RESULT_COUNT = 20

/**
 * §Bugfix "Aktivitäten enthalten zu viele Strände": eine reine
 * Sehenswürdigkeiten-Suche liefert von Google oft auch Strände als Treffer.
 * Um trotz des nachträglichen Herausfilterns (siehe `isPlainBeach` unten)
 * noch genug Aktivitäten-Treffer übrig zu behalten, wird für diese Kategorie
 * direkt das Google-Maximum abgefragt statt der sonst üblichen 8.
 */
const RESULT_COUNT_PER_CATEGORY: Record<PlacesCategory, number> = {
  restaurant: 8, attraction: MAX_GOOGLE_RESULT_COUNT, beach: 8, nature: 8,
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
  'places.types',
].join(',')

const BEACH_TYPE = 'beach'
/** Google-Place-Typen, die auf eine tatsächlich buchbare Aktivität am Strand hindeuten (nicht nur den Strand selbst). */
const BEACH_ACTIVITY_TYPES = new Set(['water_park', 'amusement_park', 'marina', 'fishing_charter', 'fishing_pier'])

/**
 * §Bugfix "Aktivitäten enthalten zu viele Strände": ein Treffer gilt als
 * "reiner Strand" (gehört ausschließlich unter "Strände", nicht unter
 * "Aktivitäten"), wenn er den Google-Typ `beach` trägt, aber keinen der
 * Typen, die auf eine eigenständig buchbare Aktivität dort hindeuten.
 */
export function isPlainBeach(types: string[]): boolean {
  return types.includes(BEACH_TYPE) && !types.some((t) => BEACH_ACTIVITY_TYPES.has(t))
}

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
  if (!apiKey) {
    const err = new ProviderConfigError('places', 'geocode')
    logProviderError(err)
    throw err
  }
  try {
    const params = new URLSearchParams({ address: query, language: 'de', key: apiKey })
    const res = await fetch(`${GEOCODING_URL}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      const err = new ProviderRequestError('places', 'geocode', res.status, await extractGoogleErrorCode(res))
      logProviderError(err)
      throw err
    }
    const data = await res.json()
    const first = data?.results?.[0]
    if (!first) return null
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    }
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('places', 'geocode', 0)
    logProviderError(err)
    throw err
  }
}

async function googlePlacesSearch(params: PlacesSearchParams): Promise<PlaceResult[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    const err = new ProviderConfigError('places', 'places_search')
    logProviderError(err)
    throw err
  }

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
        maxResultCount: RESULT_COUNT_PER_CATEGORY[params.category],
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: CATEGORY_RADIUS_METERS[params.category] } },
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = new ProviderRequestError('places', 'places_search', res.status, await extractGoogleErrorCode(res))
      logProviderError(err)
      throw err
    }
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
      types: Array.isArray(p.types) ? p.types : [],
    }))
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('places', 'places_search', 0)
    logProviderError(err)
    throw err
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

const PLACE_LOOKUP_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.types'
/** Google-Places-Typ für Unterkünfte -- einziges verlässliches Signal, dass ein Text-Search-Treffer tatsächlich ein Hotel ist (nicht nur irgendein Ort/Adresse mit ähnlichem Namen). */
const LODGING_TYPE = 'lodging'

export type LodgingResult = PlaceResult & { priceLevel: string | null; websiteUri: string | null }

/**
 * §"Reiseideen 2.0, Hotel-Shortlist": eigene Suchfunktion statt Erweiterung
 * von `searchPlaces`/`PlacesCategory` -- Hotels brauchen einen größeren
 * Umkreis/Trefferzahl als die 4 bestehenden Kategorien und zwei zusätzliche
 * Felder (`priceLevel`, `websiteUri`), die für Restaurant/Attraktion/Strand/
 * Natur nicht angefragt werden sollen (zusätzliche Kosten pro Aufruf, siehe
 * Google-Places-SKU-Tiers). So bleibt das bestehende Today/Concierge-
 * Verhalten unverändert, kein Risiko einer Regression dort.
 *
 * §"Nur Treffer mit eindeutigem Hotel-/Lodging-Bezug verwenden": ein
 * Text-Search-Treffer ohne den Google-Typ `lodging` (z. B. eine bloße
 * Adresse, ein Ort, ein Restaurant im selben Resort) wird verworfen, bevor
 * er überhaupt als Kandidat zählt -- gleiches Prinzip wie `resolveReferencePoint`.
 */
const LODGING_FIELD_MASK = `${PLACES_FIELD_MASK},places.priceLevel,places.websiteUri`
const LODGING_RADIUS_METERS = 50000
const LODGING_MAX_RESULT_COUNT = MAX_GOOGLE_RESULT_COUNT

export async function searchLodging(params: { locationName: string; lat?: number; lng?: number }): Promise<LodgingResult[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    const err = new ProviderConfigError('places', 'lodging_search')
    logProviderError(err)
    throw err
  }

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
        'X-Goog-FieldMask': LODGING_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `Hotels und Resorts in ${params.locationName}`,
        languageCode: 'de',
        maxResultCount: LODGING_MAX_RESULT_COUNT,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: LODGING_RADIUS_METERS } },
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = new ProviderRequestError('places', 'lodging_search', res.status, await extractGoogleErrorCode(res))
      logProviderError(err)
      throw err
    }
    const data = await res.json()
    const places: any[] = data?.places ?? []
    return places
      .map((p) => ({
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
        types: Array.isArray(p.types) ? p.types : [],
        priceLevel: p.priceLevel ?? null,
        websiteUri: p.websiteUri ?? null,
      }))
      .filter((p) => p.types.includes(LODGING_TYPE))
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('places', 'lodging_search', 0)
    logProviderError(err)
    throw err
  }
}

type PlaceLookupResult = { placeId: string; name: string; formattedAddress: string; lat: number; lng: number; types: string[] }

/**
 * Ein präziser Treffer per Places Text Search (kein Kategorie-/Umkreis-Bias)
 * -- Hotels/POIs sind mit reinem Geocoding oft schlechter auflösbar als mit
 * einer Namenssuche. Gibt den erkannten Namen, Place ID und `types` zurück,
 * damit `resolveReferencePoint` echte Hoteltreffer von bloßen Orts-/Adress-
 * treffern unterscheiden kann. Genutzt von `resolveReferencePoint` unten.
 */
async function resolvePlaceByName(name: string): Promise<PlaceLookupResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    const err = new ProviderConfigError('places', 'place_lookup')
    logProviderError(err)
    throw err
  }
  try {
    const res = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACE_LOOKUP_FIELD_MASK },
      body: JSON.stringify({ textQuery: name, languageCode: 'de', maxResultCount: 1 }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = new ProviderRequestError('places', 'place_lookup', res.status, await extractGoogleErrorCode(res))
      logProviderError(err)
      throw err
    }
    const data = await res.json()
    const first = data?.places?.[0]
    if (!first?.location) return null
    return {
      placeId: first.id ?? '',
      name: first.displayName?.text ?? name,
      formattedAddress: first.formattedAddress ?? '',
      lat: first.location.latitude,
      lng: first.location.longitude,
      types: Array.isArray(first.types) ? first.types : [],
    }
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('places', 'place_lookup', 0)
    logProviderError(err)
    throw err
  }
}

export type ReferencePoint = {
  placeId: string | null
  name: string
  formattedAddress: string
  lat: number
  lng: number
  source: 'hotel' | 'location'
}

/**
 * §"Hotel als echter Referenzpunkt": einziger Auflösungsweg für alle
 * Developer-Testmodule, die einen Ausgangspunkt brauchen (Places, Compute
 * Routes, Route Matrix, Tagestrip) -- vermeidet vier unabhängige
 * Implementierungen derselben Hotel-zuerst-Logik.
 *
 * §Bugfix "Hotel-Referenzpunkt wird nicht eindeutig als Hotel aufgelöst":
 * vorher zählte JEDER Places-Text-Search-Treffer (auch ein reiner Orts-/
 * Adresstreffer wie "Playa Conchal" ohne echten Hotel-POI) als "Hotel" --
 * jetzt nur noch, wenn der Treffer tatsächlich vom Typ `lodging` ist. Ohne
 * einen solchen echten Hoteltreffer fällt die Funktion direkt auf den
 * Haupturlaubsort zurück (kein unsicherer Geocoding-Versuch des Hoteltexts
 * mehr, der fälschlich weiterhin als "Hotel" beschriftet würde).
 */
export async function resolveReferencePoint(params: { hotel?: string | null; location: string }): Promise<ReferencePoint | null> {
  const hotel = params.hotel?.trim()
  if (hotel) {
    const viaPlaces = await resolvePlaceByName(hotel)
    if (viaPlaces && viaPlaces.types.includes(LODGING_TYPE)) {
      return { placeId: viaPlaces.placeId, name: viaPlaces.name, formattedAddress: viaPlaces.formattedAddress, lat: viaPlaces.lat, lng: viaPlaces.lng, source: 'hotel' }
    }
  }
  const viaLocation = await geocodeLocation(params.location)
  if (!viaLocation) return null
  return { placeId: null, name: params.location, formattedAddress: viaLocation.formattedAddress, lat: viaLocation.lat, lng: viaLocation.lng, source: 'location' }
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
