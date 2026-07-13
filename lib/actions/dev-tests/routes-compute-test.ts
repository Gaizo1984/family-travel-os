'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation } from '@/lib/providers/places-provider'
import { computeRoute } from '@/lib/providers/routes-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

export type ComputeRouteTestResult = {
  origin: string; destination: string; waypoints: string[]
  durationMinutes: number; distanceKm: number
  legs: Array<{ durationMinutes: number; distanceKm: number }>
}

export async function runComputeRouteTest(formData: FormData) {
  const origin = String(formData.get('origin') ?? '').trim()
  const destination = String(formData.get('destination') ?? '').trim()
  const waypointsRaw = String(formData.get('waypoints') ?? '')
  const waypoints = waypointsRaw.split('\n').map((s) => s.trim()).filter(Boolean)

  if (!origin || !destination) redirect('/mehr/developer')

  const [originGeo, destGeo, waypointGeos] = await Promise.all([
    geocodeLocation(origin),
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
  })

  if (!route) {
    await recordTestRun('routes_compute_route', { success: false, errorMessage: 'Routes API (Compute Routes) lieferte kein Ergebnis (Berechtigung/Aktivierung prüfen).' })
    redirect('/mehr/developer')
  }

  const result: ComputeRouteTestResult = {
    origin, destination, waypoints,
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
