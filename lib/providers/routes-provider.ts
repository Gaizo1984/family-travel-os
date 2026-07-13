import { ProviderConfigError, ProviderRequestError, extractGoogleErrorCode, logProviderError } from './provider-errors'

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const COMPUTE_ROUTE_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix'

export type LatLng = { lat: number; lng: number }

export type RouteLeg = { durationSeconds: number; distanceMeters: number }
export type ComputeRouteResult = {
  durationSeconds: number; distanceMeters: number; legs: RouteLeg[]
  /** Nur gesetzt, wenn `optimizeWaypointOrder` angefragt wurde -- Reihenfolge der `waypoints`-Indizes, wie sie die Routes API tatsächlich befährt (verhindert Zickzackrouten). */
  optimizedWaypointOrder: number[] | null
}

export type RouteMatrixElement = {
  originIndex: number
  destinationIndex: number
  durationSeconds: number | null
  distanceMeters: number | null
  reachable: boolean
}

function toWaypoint(point: LatLng) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lng } } }
}

function parseDurationSeconds(duration: unknown): number | null {
  // Google Routes API gibt Dauer als String "1234s" zurück.
  if (typeof duration !== 'string') return null
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/)
  return match ? Math.round(Number(match[1])) : null
}

/**
 * Provider-Abstraktion nach dem `WeatherProvider`-Muster (lib/weather.ts).
 * Nutzt ausschließlich die Routes API (New) -- keine Directions/Distance
 * Matrix API (Legacy), siehe Architekturvorgabe.
 */
interface RoutesProvider {
  computeRoute(params: { origin: LatLng; destination: LatLng; waypoints?: LatLng[]; optimizeWaypointOrder?: boolean }): Promise<ComputeRouteResult | null>
  computeRouteMatrix(params: { origins: LatLng[]; destinations: LatLng[] }): Promise<RouteMatrixElement[] | null>
}

async function googleComputeRoute(params: {
  origin: LatLng
  destination: LatLng
  waypoints?: LatLng[]
  optimizeWaypointOrder?: boolean
}): Promise<ComputeRouteResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    const err = new ProviderConfigError('routes', 'compute_route')
    logProviderError(err)
    throw err
  }

  const fieldMask = [
    'routes.duration', 'routes.distanceMeters', 'routes.legs.duration', 'routes.legs.distanceMeters',
    ...(params.optimizeWaypointOrder ? ['routes.optimizedIntermediateWaypointIndex'] : []),
  ].join(',')

  try {
    const res = await fetch(COMPUTE_ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        origin: toWaypoint(params.origin),
        destination: toWaypoint(params.destination),
        intermediates: params.waypoints?.map(toWaypoint) ?? undefined,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        languageCode: 'de',
        optimizeWaypointOrder: params.optimizeWaypointOrder ?? false,
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = new ProviderRequestError('routes', 'compute_route', res.status, await extractGoogleErrorCode(res))
      logProviderError(err)
      throw err
    }
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route) return null

    const legs: RouteLeg[] = (route.legs ?? []).map((leg: any) => ({
      durationSeconds: parseDurationSeconds(leg.duration) ?? 0,
      distanceMeters: leg.distanceMeters ?? 0,
    }))

    return {
      durationSeconds: parseDurationSeconds(route.duration) ?? 0,
      distanceMeters: route.distanceMeters ?? 0,
      legs,
      optimizedWaypointOrder: Array.isArray(route.optimizedIntermediateWaypointIndex) ? route.optimizedIntermediateWaypointIndex : null,
    }
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('routes', 'compute_route', 0)
    logProviderError(err)
    throw err
  }
}

async function googleComputeRouteMatrix(params: { origins: LatLng[]; destinations: LatLng[] }): Promise<RouteMatrixElement[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    const err = new ProviderConfigError('routes', 'compute_route_matrix')
    logProviderError(err)
    throw err
  }

  try {
    const res = await fetch(COMPUTE_ROUTE_MATRIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
      },
      body: JSON.stringify({
        origins: params.origins.map((o) => ({ waypoint: toWaypoint(o) })),
        destinations: params.destinations.map((d) => ({ waypoint: toWaypoint(d) })),
        travelMode: 'DRIVE',
        languageCode: 'de',
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const err = new ProviderRequestError('routes', 'compute_route_matrix', res.status, await extractGoogleErrorCode(res))
      logProviderError(err)
      throw err
    }
    const data = await res.json()
    if (!Array.isArray(data)) return null
    return data.map((el: any) => ({
      originIndex: el.originIndex ?? 0,
      destinationIndex: el.destinationIndex ?? 0,
      durationSeconds: parseDurationSeconds(el.duration),
      distanceMeters: el.distanceMeters ?? null,
      reachable: el.condition === 'ROUTE_EXISTS',
    }))
  } catch (e) {
    if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) throw e
    const err = new ProviderRequestError('routes', 'compute_route_matrix', 0)
    logProviderError(err)
    throw err
  }
}

const googleRoutesProvider: RoutesProvider = { computeRoute: googleComputeRoute, computeRouteMatrix: googleComputeRouteMatrix }

/** Einziger Zuweisungspunkt für den aktiven Routen-Anbieter — siehe RoutesProvider-Kommentar oben. */
const activeRoutesProvider: RoutesProvider = googleRoutesProvider

export async function computeRoute(params: { origin: LatLng; destination: LatLng; waypoints?: LatLng[]; optimizeWaypointOrder?: boolean }): Promise<ComputeRouteResult | null> {
  return activeRoutesProvider.computeRoute(params)
}

export async function computeRouteMatrix(params: { origins: LatLng[]; destinations: LatLng[] }): Promise<RouteMatrixElement[] | null> {
  return activeRoutesProvider.computeRouteMatrix(params)
}
