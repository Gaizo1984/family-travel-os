'use server'

import { redirect } from 'next/navigation'
import { searchPlaces, resolveReferencePoint, distanceKm, type PlacesCategory, type PlaceResult } from '@/lib/providers/places-provider'
import { computeRoute, computeRouteMatrix } from '@/lib/providers/routes-provider'
import { recordTestRun } from '@/lib/dev-test-runs'
import { MAX_LEG_MINUTES } from '@/lib/dev-test-config'

const CANDIDATE_CATEGORIES: PlacesCategory[] = ['attraction', 'nature', 'beach', 'restaurant']
const MIN_DISTINCT_STOPS = 2
const MAX_STOPS = 3
const NEAR_ORIGIN_METERS = 150

export type DaytripStop = { name: string; durationMinutes: number; distanceKm: number }
export type DaytripTestResult = {
  origin: string; originSource: 'hotel' | 'location'
  stops: DaytripStop[]
  durationMinutes: number; distanceKm: number
}

/**
 * §Gemeldeter Bug "Playa Conchal → Playa Conchal 0 Min / 0 km": Kandidaten
 * wurden bisher ungefiltert übernommen -- landet ein Places-Treffer
 * praktisch auf dem Ausgangspunkt (z. B. der gleichnamige Strand als
 * "Stopp"), entsteht eine degenerierte Route ohne echten Umweg. Neuer Ablauf:
 * Kandidaten aus 4 Kategorien sammeln, nach Place-ID deduplizieren, alles
 * nahe am Ausgangspunkt ausschließen, per Route Matrix vorauswählen
 * (nur erreichbare Kandidaten ≤ MAX_LEG_MINUTES), dann eine echte
 * optimierte Rundroute berechnen -- nie eine 0/0-Route.
 */
export async function runDaytripTest(formData: FormData) {
  const origin = String(formData.get('origin') ?? '').trim()
  if (!origin) redirect('/mehr/developer')

  const originGeo = await resolveReferencePoint({ hotel: origin, location: origin })
  if (!originGeo) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: `Ausgangsort "${origin}" konnte nicht aufgelöst werden.` })
    redirect('/mehr/developer')
  }

  const searchResults = await Promise.all(
    CANDIDATE_CATEGORIES.map((category) => searchPlaces({ locationName: origin, category, lat: originGeo.lat, lng: originGeo.lng })),
  )

  const seenIds = new Set<string>()
  const candidates: PlaceResult[] = []
  for (const results of searchResults) {
    for (const p of results ?? []) {
      if (seenIds.has(p.id)) continue
      seenIds.add(p.id)
      if (distanceKm(originGeo, { lat: p.lat, lng: p.lng }) * 1000 < NEAR_ORIGIN_METERS) continue
      candidates.push(p)
    }
  }

  if (candidates.length < MIN_DISTINCT_STOPS) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: 'Nicht genügend unterschiedliche Kandidaten-Stopps in der Nähe gefunden.' })
    redirect('/mehr/developer')
  }

  const matrix = await computeRouteMatrix({
    origins: [{ lat: originGeo.lat, lng: originGeo.lng }],
    destinations: candidates.map((c) => ({ lat: c.lat, lng: c.lng })),
  })

  if (!matrix) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: 'Routes API (Compute Route Matrix) lieferte kein Ergebnis für die Vorauswahl.' })
    redirect('/mehr/developer')
  }

  const reachable = candidates
    .map((place, i) => ({ place, matrixEl: matrix.find((m) => m.destinationIndex === i) ?? null }))
    .filter((c): c is { place: PlaceResult; matrixEl: NonNullable<typeof c.matrixEl> } =>
      Boolean(c.matrixEl?.reachable && c.matrixEl.durationSeconds != null && c.matrixEl.durationSeconds / 60 <= MAX_LEG_MINUTES))
    .sort((a, b) => (b.place.rating ?? 0) - (a.place.rating ?? 0))
    .slice(0, MAX_STOPS)

  if (reachable.length < MIN_DISTINCT_STOPS) {
    await recordTestRun('daytrip_multi_stop', {
      success: false,
      errorMessage: `Keine ausreichend nahen, unterschiedlichen Kandidaten innerhalb von ${MAX_LEG_MINUTES} Minuten gefunden.`,
    })
    redirect('/mehr/developer')
  }

  const route = await computeRoute({
    origin: originGeo, destination: originGeo,
    waypoints: reachable.map((r) => ({ lat: r.place.lat, lng: r.place.lng })),
    optimizeWaypointOrder: true,
  })

  if (!route) {
    await recordTestRun('daytrip_multi_stop', { success: false, errorMessage: 'Routes API (Compute Routes) lieferte kein Ergebnis für die kombinierte Route.' })
    redirect('/mehr/developer')
  }

  const order = route.optimizedWaypointOrder ?? reachable.map((_, i) => i)
  const stops: DaytripStop[] = order.map((i) => {
    const r = reachable[i]
    return {
      name: r.place.name,
      durationMinutes: Math.round((r.matrixEl.durationSeconds ?? 0) / 60),
      distanceKm: Math.round((r.matrixEl.distanceMeters ?? 0) / 100) / 10,
    }
  })

  const result: DaytripTestResult = {
    origin: originGeo.formattedAddress, originSource: originGeo.source,
    stops,
    durationMinutes: Math.round(route.durationSeconds / 60),
    distanceKm: Math.round(route.distanceMeters / 100) / 10,
  }

  await recordTestRun('daytrip_multi_stop', {
    success: true,
    summary: `${stops.length} Stopps ab ${originGeo.formattedAddress}: ${result.durationMinutes} Min, ${result.distanceKm} km`,
    result,
  })
  redirect('/mehr/developer')
}
