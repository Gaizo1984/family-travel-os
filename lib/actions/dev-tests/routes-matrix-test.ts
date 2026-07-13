'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation, resolveReferencePoint } from '@/lib/providers/places-provider'
import { computeRouteMatrix } from '@/lib/providers/routes-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

export type ComputeRouteMatrixTestResult = {
  origin: string
  originSource: 'hotel' | 'location'
  destinations: Array<{ name: string; durationMinutes: number | null; distanceKm: number | null; reachable: boolean }>
}

export async function runComputeRouteMatrixTest(formData: FormData) {
  const origin = String(formData.get('origin') ?? '').trim()
  const destinationsRaw = String(formData.get('destinations') ?? '')
  const destinationNames = destinationsRaw.split('\n').map((s) => s.trim()).filter(Boolean)

  if (!origin || destinationNames.length === 0) redirect('/mehr/developer')

  // §"Ursprung" fungiert als Hotel/Referenzpunkt -- Places-Text-Search zuerst.
  const originGeo = await resolveReferencePoint({ hotel: origin, location: origin })
  const destGeos = await Promise.all(destinationNames.map((d) => geocodeLocation(d)))

  if (!originGeo) {
    await recordTestRun('routes_compute_route_matrix', { success: false, errorMessage: `Ursprung "${origin}" konnte nicht geokodiert werden.` })
    redirect('/mehr/developer')
  }
  const validDestinations = destinationNames.filter((_, i) => destGeos[i])
  const validDestGeos = destGeos.filter((g) => g !== null) as NonNullable<(typeof destGeos)[number]>[]

  if (validDestGeos.length === 0) {
    await recordTestRun('routes_compute_route_matrix', { success: false, errorMessage: 'Keiner der Zielorte konnte geokodiert werden.' })
    redirect('/mehr/developer')
  }

  const matrix = await computeRouteMatrix({
    origins: [{ lat: originGeo.lat, lng: originGeo.lng }],
    destinations: validDestGeos.map((g) => ({ lat: g.lat, lng: g.lng })),
  })

  if (!matrix) {
    await recordTestRun('routes_compute_route_matrix', { success: false, errorMessage: 'Routes API (Compute Route Matrix) lieferte kein Ergebnis (Berechtigung/Aktivierung prüfen).' })
    redirect('/mehr/developer')
  }

  const destinations = validDestinations.map((name, i) => {
    const el = matrix.find((m) => m.destinationIndex === i)
    return {
      name,
      durationMinutes: el?.durationSeconds != null ? Math.round(el.durationSeconds / 60) : null,
      distanceKm: el?.distanceMeters != null ? Math.round(el.distanceMeters / 100) / 10 : null,
      reachable: el?.reachable ?? false,
    }
  })

  const result: ComputeRouteMatrixTestResult = { origin: originGeo.formattedAddress, originSource: originGeo.source, destinations }
  await recordTestRun('routes_compute_route_matrix', {
    success: true,
    summary: `${origin} → ${destinations.length} Ziele`,
    result,
  })
  redirect('/mehr/developer')
}
