'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation, searchPlaces } from '@/lib/providers/places-provider'
import { computeRoute } from '@/lib/providers/routes-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

export type DaytripTestResult = {
  origin: string; formattedAddress: string
  stops: string[]
  durationMinutes: number; distanceKm: number
}

/**
 * §"Tagestrip-Kandidaten mit mehreren Stopps": End-to-End-Machbarkeitstest
 * für Places + Routes API im Zusammenspiel (vgl. PLAUSIBILITY_HINT in
 * lib/actions/category-suggestions.ts, "mehrere Stopps sinnvoll zu einer
 * Route kombinieren") -- holt Kandidaten-Stopps über searchPlaces und
 * kombiniert sie über computeRoute zu einer Rundroute ab/bis Ausgangsort.
 * Rein lesend, speichert nichts in Produktionsdaten.
 */
export async function runDaytripTest(formData: FormData) {
  const origin = String(formData.get('origin') ?? '').trim()
  if (!origin) redirect('/mehr/developer')

  const originGeo = await geocodeLocation(origin)
  if (!originGeo) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: `Ausgangsort "${origin}" konnte nicht geokodiert werden.` })
    redirect('/mehr/developer')
  }

  const [attractions, beaches] = await Promise.all([
    searchPlaces({ locationName: origin, category: 'attraction', lat: originGeo.lat, lng: originGeo.lng }),
    searchPlaces({ locationName: origin, category: 'beach', lat: originGeo.lat, lng: originGeo.lng }),
  ])

  const candidates = [...(attractions ?? []).slice(0, 2), ...(beaches ?? []).slice(0, 2)]
  if (candidates.length === 0) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: 'Places API lieferte keine Kandidaten-Stopps in der Nähe.' })
    redirect('/mehr/developer')
  }

  const route = await computeRoute({
    origin: originGeo,
    destination: originGeo,
    waypoints: candidates.map((c) => ({ lat: c.lat, lng: c.lng })),
  })

  if (!route) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: 'Routes API (Compute Routes) lieferte kein Ergebnis für die kombinierte Route.' })
    redirect('/mehr/developer')
  }

  const result: DaytripTestResult = {
    origin, formattedAddress: originGeo.formattedAddress,
    stops: candidates.map((c) => c.name),
    durationMinutes: Math.round(route.durationSeconds / 60),
    distanceKm: Math.round(route.distanceMeters / 100) / 10,
  }

  await recordTestRun('daytrip_multi_stop', {
    success: true,
    summary: `${result.stops.length} Stopps ab ${originGeo.formattedAddress}: ${result.durationMinutes} Min, ${result.distanceKm} km`,
    result,
  })
  redirect('/mehr/developer')
}
