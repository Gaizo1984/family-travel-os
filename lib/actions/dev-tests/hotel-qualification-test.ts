'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation, searchLodgingRaw } from '@/lib/providers/places-provider'
import { classifyAndQualify, selectBalancedQualified } from '@/lib/hotel-qualification'
import { ProviderConfigError, ProviderRequestError, describeProviderError } from '@/lib/providers/provider-errors'
import { recordTestRun } from '@/lib/dev-test-runs'

const LODGING_TYPE = 'lodging'

export type HotelQualificationTestResult = {
  destination: string
  candidateCount: number
  qualifiedCount: number
  belowStandardMode: boolean
  balancedPickNames: string[]
  candidates: Array<{
    name: string; rating: number | null; userRatingCount: number | null; priceLevel: string | null
    qualifies: boolean; tier: string; tierBasis: 'brand' | 'heuristic'; isIconic: boolean
    hasLodgingType: boolean; types: string[]
  }>
}

/**
 * §"Direkter Provider-Test, kein Business-Layer": ruft `geocodeLocation`/
 * `searchLodging`/`classifyAndQualify` direkt auf (nicht `getOrSearchHotelOptions`
 * oder die KI-Auswahl) -- zeigt für jeden real gefundenen Kandidaten Rating/
 * Rezensionen/Preisniveau UND ob/warum er qualifiziert, damit sich
 * "kein Hotel erfüllt den Standard" (Google liefert z. B. kein priceLevel für
 * Hotels) von "Places findet die falschen/keine Kandidaten" unterscheiden lässt.
 */
export async function runHotelQualificationTest(formData: FormData) {
  const destination = String(formData.get('destination') ?? '').trim()
  if (!destination) redirect('/mehr/developer')

  let destGeo: Awaited<ReturnType<typeof geocodeLocation>>
  try {
    destGeo = await geocodeLocation(destination)
  } catch (e) {
    if (!(e instanceof ProviderConfigError || e instanceof ProviderRequestError)) throw e
    await recordTestRun('hotel_qualification', { success: false, errorMessage: describeProviderError(e) })
    redirect('/mehr/developer')
  }
  if (!destGeo) {
    await recordTestRun('hotel_qualification', { success: false, errorMessage: 'Zielort konnte nicht gefunden werden.' })
    redirect('/mehr/developer')
  }

  // §"Diagnose statt Produktivfilter": nutzt bewusst `searchLodgingRaw` (kein
  // `lodging`-Typfilter) -- zeigt so auch Kandidaten, die Google zwar findet,
  // aber mit einem anderen Google-Typ (z. B. `tourist_attraction`)
  // kategorisiert und deshalb in der Produktivsuche stillschweigend verworfen
  // werden. `hasLodgingType` macht das pro Kandidat sichtbar.
  let candidates: Awaited<ReturnType<typeof searchLodgingRaw>>
  try {
    candidates = await searchLodgingRaw({ locationName: destination, lat: destGeo.lat, lng: destGeo.lng })
  } catch (e) {
    if (!(e instanceof ProviderConfigError || e instanceof ProviderRequestError)) throw e
    await recordTestRun('hotel_qualification', { success: false, errorMessage: describeProviderError(e) })
    redirect('/mehr/developer')
  }
  if (!candidates || candidates.length === 0) {
    await recordTestRun('hotel_qualification', { success: false, errorMessage: 'Keine Hotels gefunden.' })
    redirect('/mehr/developer')
  }

  const seenIds = new Set<string>()
  const deduped = candidates.filter((c) => {
    if (seenIds.has(c.id)) return false
    seenIds.add(c.id)
    return true
  })

  // §"Wie in der Produktivsuche qualifizieren": nur Kandidaten mit dem
  // `lodging`-Typ fließen in Qualifikation/ausgewogene Auswahl ein -- exakt
  // wie `searchLodging` es in der echten Suche handhabt.
  const lodgingOnly = deduped.filter((c) => c.types.includes(LODGING_TYPE))
  const classified = lodgingOnly.map((c) => ({ candidate: c, q: classifyAndQualify(c) }))
  const qualifiedCount = classified.filter((c) => c.q.qualifies).length
  const qualificationByPlaceId = new Map(classified.map(({ candidate, q }) => [candidate.id, q]))
  const balancedPick = selectBalancedQualified(lodgingOnly, qualificationByPlaceId)

  const result: HotelQualificationTestResult = {
    destination,
    candidateCount: lodgingOnly.length,
    qualifiedCount,
    belowStandardMode: qualifiedCount === 0,
    balancedPickNames: balancedPick.map((c) => c.name),
    candidates: [...deduped]
      .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
      .slice(0, 25)
      .map((candidate) => {
        const q = qualificationByPlaceId.get(candidate.id)
        return {
          name: candidate.name, rating: candidate.rating, userRatingCount: candidate.userRatingCount,
          priceLevel: candidate.priceLevel, qualifies: q?.qualifies ?? false, tier: q?.tier ?? '—', tierBasis: q?.tierBasis ?? 'heuristic',
          isIconic: q?.isIconic ?? false, hasLodgingType: candidate.types.includes(LODGING_TYPE), types: candidate.types,
        }
      }),
  }

  await recordTestRun('hotel_qualification', {
    success: true,
    summary: `${destination}: ${deduped.length} Kandidaten gesamt (${lodgingOnly.length} mit lodging-Typ), ${qualifiedCount} qualifiziert`,
    result,
  })
  redirect('/mehr/developer')
}
