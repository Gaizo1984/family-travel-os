'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation, resolveReferencePoint } from '@/lib/providers/places-provider'
import { computeRoute } from '@/lib/providers/routes-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

export type ComputeRouteTestResult = {
  origin: string; destination: string; waypoints: string[]
  originSource: 'hotel' | 'location'
  isRoundTrip: boolean
  durationMinutes: number; distanceKm: number
  legs: Array<{ durationMinutes: number; distanceKm: number }>
}

const sameCoords = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001

export async function runComputeRouteTest(formData: FormData) {
  const origin = String(formData.get('origin') ?? '').trim()
  const destination = String(formData.get('destination') ?? '').trim()
  const waypointsRaw = String(formData.get('waypoints') ?? '')
  const waypoints = waypointsRaw.split('\n').map((s) => s.trim()).filter(Boolean)

  if (!origin || !destination) redirect('/mehr/developer')

  // §"Start" fungiert als Hotel/Referenzpunkt -- Places-Text-Search zuerst
  // (bessere Trefferquote für Hotelnamen als reines Geocoding).
  const [originGeo, destGeo, waypointGeos] = await Promise.all([
    resolveReferencePoint({ hotel: origin, location: origin }),
    geocodeLocation(destination),
    Promise.all(waypoints.map((w) => geocodeLocation(w))),
  ])

  if (!originGeo || !destGeo) {
    await recordTestRun('routes_compute_route', { success: false, errorMessage: 'Start oder Ziel konnte nicht geokodiert werden.' })
    redirect('/mehr/developer')
  }
  if (waypointGeos.some((g) => !g)) {
    await recordTestRun('routes_compute_route', { success: false, errorMessage: 'Mindestens ein Zwischenstopp konnte nicht geokodiert werden.' })
    redirect('/mehr/developer')
  }

  const route = await computeRoute({
    origin: originGeo, destination: destGeo,
    waypoints: waypointGeos.map((g) => ({ lat: g!.lat, lng: g!.lng })),
    optimizeWaypointOrder: waypointGeos.length > 1,
  })

  if (!route) {
    await recordTestRun('routes_compute_route', { success: false, errorMessage: 'Routes API (Compute Routes) lieferte kein Ergebnis (Berechtigung/Aktivierung prüfen).' })
    redirect('/mehr/developer')
  }

  const orderedWaypoints = route.optimizedWaypointOrder
    ? route.optimizedWaypointOrder.map((i) => waypoints[i])
    : waypoints

  const result: ComputeRouteTestResult = {
    origin: originGeo.formattedAddress, destination, waypoints: orderedWaypoints,
    originSource: originGeo.source,
    isRoundTrip: sameCoords(originGeo, destGeo),
    durationMinutes: Math.round(route.durationSeconds / 60),
    distanceKm: Math.round(route.distanceMeters / 100) / 10,
    legs: route.legs.map((leg) => ({ durationMinutes: Math.round(leg.durationSeconds / 60), distanceKm: Math.round(leg.distanceMeters / 100) / 10 })),
  }

  await recordTestRun('routes_compute_route', {
    success: true,
    summary: `${origin} → ${destination}: ${result.durationMinutes} Min, ${result.distanceKm} km`,
    result,
  })
  redirect('/mehr/developer')
}
