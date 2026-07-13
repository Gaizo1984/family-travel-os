'use server'

import { redirect } from 'next/navigation'
import { searchPlaces, resolveReferencePoint, distanceKm, type PlacesCategory, type PlaceResult } from '@/lib/providers/places-provider'
import { computeRouteMatrix } from '@/lib/providers/routes-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

const CATEGORIES: PlacesCategory[] = ['restaurant', 'attraction', 'beach', 'nature']
const MAX_PER_CATEGORY = 5

export type CompactPlace = {
  id: string; name: string; category: PlacesCategory
  rating: number | null; userRatingCount: number | null; openNow: boolean | null; photoName: string | null
  distanceKm: number | null; durationMinutes: number | null; travelDistanceKm: number | null
}

export type PlacesTestResult = {
  origin: { name: string; formattedAddress: string; lat: number; lng: number; source: 'hotel' | 'location' }
  categories: Record<PlacesCategory, CompactPlace[]>
}

/**
 * §"Hotel als echter Referenzpunkt": das (optionale) Hotel wird über
 * `resolveReferencePoint` aufgelöst und -- sofern auffindbar -- zum
 * tatsächlichen Suchursprung für alle 4 Kategorien, nicht nur für eine
 * Luftlinien-Anzeige. Ohne Hotel fällt die Suche wie bisher auf den
 * Haupturlaubsort zurück.
 */
export async function runPlacesTest(formData: FormData) {
  const location = String(formData.get('location') ?? '').trim()
  const hotel = String(formData.get('hotel') ?? '').trim() || null

  if (!location) redirect('/mehr/developer')

  const origin = await resolveReferencePoint({ hotel, location })
  if (!origin) {
    await recordTestRun('places', { success: false, errorMessage: `Weder Hotel "${hotel ?? ''}" noch Ort "${location}" konnten aufgelöst werden.` })
    redirect('/mehr/developer')
  }

  const searchResults = await Promise.all(
    CATEGORIES.map((category) => searchPlaces({ locationName: location, category, lat: origin.lat, lng: origin.lng })),
  )

  const allNull = searchResults.every((r) => r === null)
  if (allNull) {
    await recordTestRun('places', { success: false, errorMessage: 'Places API lieferte für keine Kategorie Ergebnisse (Key/Berechtigung prüfen).' })
    redirect('/mehr/developer')
  }

  // §"Gleiche Places nicht mehrfach in unterschiedlichen Kategorien anzeigen":
  // global über alle Kategorien nach Place-ID deduplizieren, die erste
  // Kategorie in Durchlaufreihenfolge behält den Treffer.
  const seenIds = new Set<string>()
  const byCategory: Partial<Record<PlacesCategory, PlaceResult[]>> = {}
  CATEGORIES.forEach((category, i) => {
    const deduped = (searchResults[i] ?? []).filter((p) => {
      if (seenIds.has(p.id)) return false
      seenIds.add(p.id)
      return true
    })
    byCategory[category] = deduped.slice(0, MAX_PER_CATEGORY)
  })

  const allShown = CATEGORIES.flatMap((c) => byCategory[c] ?? [])

  // §"Für Empfehlungen möglichst zusätzlich echte Fahrtzeiten ergänzen": EIN
  // Route-Matrix-Aufruf für den gesamten (bereits gedeckelten) Treffersatz --
  // kein Aufruf pro Einzelort, vermeidet unnötige API-Last.
  const matrix = allShown.length > 0
    ? await computeRouteMatrix({ origins: [{ lat: origin.lat, lng: origin.lng }], destinations: allShown.map((p) => ({ lat: p.lat, lng: p.lng })) })
    : null

  const categories = {} as Record<PlacesCategory, CompactPlace[]>
  let totalCount = 0
  CATEGORIES.forEach((category) => {
    const results = byCategory[category] ?? []
    totalCount += results.length
    categories[category] = results.map((p) => {
      const idx = allShown.indexOf(p)
      const m = matrix?.find((el) => el.destinationIndex === idx)
      return {
        id: p.id, name: p.name, category,
        rating: p.rating, userRatingCount: p.userRatingCount, openNow: p.openNow, photoName: p.photoName,
        distanceKm: Math.round(distanceKm(origin, { lat: p.lat, lng: p.lng }) * 10) / 10,
        durationMinutes: m?.reachable && m.durationSeconds != null ? Math.round(m.durationSeconds / 60) : null,
        travelDistanceKm: m?.reachable && m.distanceMeters != null ? Math.round(m.distanceMeters / 100) / 10 : null,
      }
    })
  })

  const result: PlacesTestResult = {
    origin: { name: origin.name, formattedAddress: origin.formattedAddress, lat: origin.lat, lng: origin.lng, source: origin.source },
    categories,
  }

  await recordTestRun('places', {
    success: true,
    summary: `${totalCount} Treffer in ${CATEGORIES.length} Kategorien ab ${origin.source === 'hotel' ? 'Hotel' : 'Ort'} "${origin.formattedAddress}"`,
    result,
  })
  redirect('/mehr/developer')
}
