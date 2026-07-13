'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { searchPlaces, distanceKm, type PlaceResult } from '@/lib/providers/places-provider'
import { computeRouteMatrix } from '@/lib/providers/routes-provider'
import { generateFiveRecommendations } from '@/lib/concierge-ai'
import { buildLumiContext, type LumiContext } from '@/lib/lumi-context'
import { getTodayCategoryConfig, type TodayCategoryKey } from '@/lib/today-categories'

export type CategoryPlaceItem = {
  placeId: string; name: string; photoName: string | null
  rating: number | null; reviewCount: number | null; openNow: boolean | null
  durationMinutes: number | null; distanceKm: number | null
  why: string | null; tripLength: string | null
}

export type CategoryPlacesResult = {
  originLabel: string
  originSource: 'hotel' | 'location'
  items: CategoryPlaceItem[]
  updatedAt: string
  daysAgo: number
}

/** Places-ID (bevorzugt) oder auf ca. 100 m gerundete Koordinate -- siehe Migrationskommentar zu category_places_cache. */
function originKeyFor(origin: LumiContext['origin']): string {
  return origin.placeId ?? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`
}

export async function getCategoryPlaces(familyId: string, tripId: string, category: string, originKey: string): Promise<CategoryPlacesResult | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('category_places_cache')
    .select('origin_label, results, updated_at')
    .eq('family_id', familyId).eq('trip_id', tripId).eq('category', category).eq('origin_key', originKey)
    .maybeSingle()

  if (!data) return null
  const stored = data.results as unknown as { originSource: 'hotel' | 'location'; items: CategoryPlaceItem[] }
  const daysAgo = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / 86400000)
  return { originLabel: data.origin_label, originSource: stored.originSource, items: stored.items, updatedAt: data.updated_at, daysAgo }
}

/**
 * §"LUMI Intelligence v1", §2/§3: einziger Auslöser für Places-/Routes-/
 * OpenAI-Aufrufe einer Kategorie -- nie beim bloßen Öffnen der Seite. Folgt
 * exakt dem in `lib/actions/dev-tests/*` bewiesenen Muster: Kandidaten
 * suchen, innerhalb der Kategorie deduplizieren (NICHT kategorieübergreifend
 * -- das leerte Strände/Natur im letzten Sprint fälschlich), echte
 * Fahrzeiten per Route Matrix, dann `generateFiveRecommendations` für die
 * Begründungstexte -- die KI liefert nie die Fakten selbst.
 */
export async function loadCategoryPlaces(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const category = String(formData.get('category') ?? '') as TodayCategoryKey
  const returnTo = String(formData.get('return_to') ?? '/today')

  const config = getTodayCategoryConfig(category)
  if (!config?.placesCategory || !familyId || !tripId) redirect(returnTo)

  const context = await buildLumiContext(familyId, tripId, new Date().toISOString().slice(0, 10))
  if (!context) redirect(`${returnTo}?error=${encodeURIComponent('Reise konnte nicht geladen werden')}`)

  const origin = context.origin
  const originKey = originKeyFor(origin)

  const rawResults = await searchPlaces({
    locationName: origin.formattedAddress, category: config.placesCategory, lat: origin.lat, lng: origin.lng,
  })

  if (!rawResults || rawResults.length === 0) {
    redirect(`${returnTo}?error=${encodeURIComponent('Keine Treffer gefunden -- bitte später erneut versuchen.')}`)
  }

  const seenIds = new Set<string>()
  const deduped = rawResults.filter((p) => {
    if (seenIds.has(p.id)) return false
    seenIds.add(p.id)
    return true
  }).slice(0, 10)

  const matrix = await computeRouteMatrix({
    origins: [{ lat: origin.lat, lng: origin.lng }],
    destinations: deduped.map((p) => ({ lat: p.lat, lng: p.lng })),
  })

  const preferredMax = config.preferredMaxMinutes ?? 90
  const hardMax = config.hardMaxMinutes ?? 150

  const withFacts = deduped.map((p, i) => {
    const m = matrix?.find((el) => el.destinationIndex === i)
    const durationMinutes = m?.reachable && m.durationSeconds != null ? Math.round(m.durationSeconds / 60) : null
    return {
      place: p,
      durationMinutes,
      distanceKm: m?.reachable && m.distanceMeters != null ? Math.round(m.distanceMeters / 100) / 10 : Math.round(distanceKm(origin, p) * 10) / 10,
    }
  })
    // §"harte Obergrenze ausschließen, bevorzugte zuerst": kein Aufruf ohne
    // reale Fahrzeit wird verworfen (könnte noch am Zielort selbst liegen),
    // aber alles nachweislich über der harten Grenze fällt raus.
    .filter((r) => r.durationMinutes === null || r.durationMinutes <= hardMax)
    .sort((a, b) => {
      const aOver = (a.durationMinutes ?? 0) > preferredMax ? 1 : 0
      const bOver = (b.durationMinutes ?? 0) > preferredMax ? 1 : 0
      if (aOver !== bOver) return aOver - bOver
      return (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0)
    })
    .slice(0, 8)

  if (withFacts.length === 0) {
    redirect(`${returnTo}?error=${encodeURIComponent(`Keine ${config.label} in plausibler Fahrzeit gefunden.`)}`)
  }

  const picks = await generateFiveRecommendations({
    locationLabel: origin.formattedAddress,
    candidates: withFacts.map((r) => ({
      name: r.place.name, category: config.key,
      rating: r.place.rating, userRatingCount: r.place.userRatingCount, openNow: r.place.openNow,
      durationMinutes: r.durationMinutes, distanceKm: r.distanceKm,
    })),
    familyDnaText: context.dnaText,
    members: context.dna.persons.map((p) => ({ name: p.name, age: null, isMinor: p.is_minor })),
    weatherSummary: context.weather ? `${context.weather.currentTemp}°C, ${context.weather.daily[0]?.tempMin}-${context.weather.daily[0]?.tempMax}°C` : null,
  })

  const pickByName = new Map((picks ?? []).map((p) => [p.placeName, p]))

  const items: CategoryPlaceItem[] = withFacts.map((r) => {
    const pick = pickByName.get(r.place.name)
    return {
      placeId: r.place.id, name: r.place.name, photoName: r.place.photoName,
      rating: r.place.rating, reviewCount: r.place.userRatingCount, openNow: r.place.openNow,
      durationMinutes: r.durationMinutes, distanceKm: r.distanceKm,
      why: pick?.why ?? null, tripLength: pick?.tripLength ?? null,
    }
  })

  const result: Pick<CategoryPlacesResult, 'originSource' | 'items'> = { originSource: origin.source, items }

  const supabase = await createClient()
  await supabase.from('category_places_cache').upsert(
    { family_id: familyId, trip_id: tripId, category, origin_key: originKey, origin_label: origin.formattedAddress, results: result, updated_at: new Date().toISOString() },
    { onConflict: 'family_id,trip_id,category,origin_key' },
  )

  redirect(returnTo)
}
