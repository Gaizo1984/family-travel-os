'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation, searchPlaces, distanceKm, type PlacesCategory, type PlaceResult } from '@/lib/providers/places-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

const CATEGORIES: PlacesCategory[] = ['restaurant', 'attraction', 'beach', 'nature']

type CompactPlace = {
  id: string; name: string; rating: number | null; userRatingCount: number | null
  openNow: boolean | null; photoName: string | null; distanceKm: number | null
}

export type PlacesTestResult = {
  location: string; formattedAddress: string; lat: number; lng: number
  referencePoint: string | null
  categories: Record<PlacesCategory, CompactPlace[]>
}

export async function runPlacesTest(formData: FormData) {
  const location = String(formData.get('location') ?? '').trim()
  const referencePoint = String(formData.get('reference_point') ?? '').trim() || null

  if (!location) redirect('/mehr/developer')

  const geo = await geocodeLocation(location)
  if (!geo) {
    await recordTestRun('places', { success: false, errorMessage: `Ort "${location}" konnte nicht geokodiert werden.` })
    redirect('/mehr/developer')
  }

  const refGeo = referencePoint ? await geocodeLocation(referencePoint) : null

  const searchResults = await Promise.all(
    CATEGORIES.map((category) => searchPlaces({ locationName: location, category, lat: geo.lat, lng: geo.lng })),
  )

  const categories = {} as Record<PlacesCategory, CompactPlace[]>
  let totalCount = 0
  CATEGORIES.forEach((category, i) => {
    const results = searchResults[i] ?? []
    totalCount += results.length
    categories[category] = results.slice(0, 5).map((p: PlaceResult) => ({
      id: p.id, name: p.name, rating: p.rating, userRatingCount: p.userRatingCount,
      openNow: p.openNow, photoName: p.photoName,
      distanceKm: refGeo ? Math.round(distanceKm(refGeo, { lat: p.lat, lng: p.lng }) * 10) / 10 : null,
    }))
  })

  const allNull = CATEGORIES.every((c) => searchResults[CATEGORIES.indexOf(c)] === null)
  if (allNull) {
    await recordTestRun('places', {
      success: false,
      errorMessage: 'Places API lieferte für keine Kategorie Ergebnisse (Key/Berechtigung prüfen).',
    })
    redirect('/mehr/developer')
  }

  const result: PlacesTestResult = { location, formattedAddress: geo.formattedAddress, lat: geo.lat, lng: geo.lng, referencePoint, categories }

  await recordTestRun('places', {
    success: true,
    summary: `${totalCount} Treffer in ${CATEGORIES.length} Kategorien für "${geo.formattedAddress}"`,
    result,
  })
  redirect('/mehr/developer')
}
