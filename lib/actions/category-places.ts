'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { searchPlaces, distanceKm, isPlainBeach, type PlaceResult } from '@/lib/providers/places-provider'
import { computeRouteMatrix, type RouteMatrixElement } from '@/lib/providers/routes-provider'
import { ProviderConfigError } from '@/lib/providers/provider-errors'
import { generateFiveRecommendations } from '@/lib/concierge-ai'
import { buildLumiContext, lumiContextErrorMessage, type LumiContext } from '@/lib/lumi-context'
import { ageAtDate } from '@/lib/family-dna'
import { getTodayCategoryConfig, type TodayCategoryKey, type TodayCategoryConfig } from '@/lib/today-categories'
import {
  originKeyFor, buildCategoryPlaceItems,
  type CategoryPlaceItem, type CategoryPlacesResult, type CategoryCandidateFact,
} from '@/lib/category-places-shared'

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

export type CategoryCandidatesResult =
  | { ok: true; facts: CategoryCandidateFact[] }
  | { ok: false; message: string }

/**
 * §"Tagesplaner 2.0, keine parallele Places-/Routes-Logik aufbauen"
 * (Nutzervorgabe): reine Kandidaten-Ermittlung (Suche, Dedupe, echte
 * Fahrzeit-Fakten über die Route Matrix) -- OHNE KI-Bewertung und OHNE
 * Cache-Schreibzugriff. Extrahiert aus dem bisherigen `loadCategoryPlaces`
 * (das jetzt selbst nur noch diese Funktion aufruft, unverändertes
 * Verhalten für "Heute") -- vom Tagesplaner zusätzlich direkt genutzt, um
 * für mehrere Kategorien Kandidaten zu sammeln, BEVOR eine einzige
 * gemeinsame KI-Bewertungsrunde läuft (siehe day-planner.ts).
 */
export async function searchCategoryCandidates(origin: LumiContext['origin'], config: TodayCategoryConfig): Promise<CategoryCandidatesResult> {
  if (!config.placesCategory) return { ok: false, message: 'Keine Places-Anbindung für diese Kategorie.' }

  let rawResults: PlaceResult[] | null
  try {
    rawResults = await searchPlaces({ locationName: origin.formattedAddress, category: config.placesCategory, lat: origin.lat, lng: origin.lng })
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'LUMI ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Suche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    return { ok: false, message }
  }

  if (!rawResults || rawResults.length === 0) return { ok: false, message: 'Keine Treffer gefunden -- bitte später erneut versuchen.' }

  // §Bugfix "Aktivitäten enthalten zu viele Strände": siehe places-provider.ts::isPlainBeach.
  const filteredResults = config.placesCategory === 'attraction' ? rawResults.filter((p) => !isPlainBeach(p.types)) : rawResults
  if (filteredResults.length === 0) return { ok: false, message: 'Keine Treffer gefunden -- bitte später erneut versuchen.' }

  const seenIds = new Set<string>()
  const deduped = filteredResults.filter((p) => {
    if (seenIds.has(p.id)) return false
    seenIds.add(p.id)
    return true
  }).slice(0, 10)

  let matrix: RouteMatrixElement[] | null = null
  try {
    matrix = await computeRouteMatrix({
      origins: [{ lat: origin.lat, lng: origin.lng }],
      destinations: deduped.map((p) => ({ lat: p.lat, lng: p.lng })),
    })
  } catch {
    // Bereits über logProviderError() geloggt -- gefundene Places-Treffer bleiben ohne Fahrzeit-Anreicherung erhalten (Haversine-Fallback unten).
  }

  const preferredMax = config.preferredMaxMinutes ?? 90
  const hardMax = config.hardMaxMinutes ?? 150

  const withFacts: CategoryCandidateFact[] = deduped.map((p, i) => {
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

  if (withFacts.length === 0) return { ok: false, message: `Keine ${config.label} in plausibler Fahrzeit gefunden.` }

  return { ok: true, facts: withFacts }
}

/** Schreibt ein fertiges Kategorie-Ergebnis in den gemeinsamen Cache -- identisches Upsert-Muster wie zuvor inline in loadCategoryPlaces. */
export async function writeCategoryPlacesCache(
  familyId: string, tripId: string, category: string, originKey: string, originLabel: string, originSource: 'hotel' | 'location', items: CategoryPlaceItem[],
): Promise<void> {
  const supabase = await createClient()
  const result: Pick<CategoryPlacesResult, 'originSource' | 'items'> = { originSource, items }
  const { error } = await supabase.from('category_places_cache').upsert(
    { family_id: familyId, trip_id: tripId, category, origin_key: originKey, origin_label: originLabel, results: result, updated_at: new Date().toISOString() },
    { onConflict: 'family_id,trip_id,category,origin_key' },
  )
  if (error) console.error('[category-places] cache upsert failed', { category, error: error.message })
}

/**
 * §"LUMI Intelligence v1", §2/§3: einziger Auslöser für Places-/Routes-/
 * OpenAI-Aufrufe einer Kategorie -- nie beim bloßen Öffnen der Seite.
 * §"Tagesplaner 2.0"-Refactor: ruft jetzt `searchCategoryCandidates` /
 * `buildCategoryPlaceItems` / `writeCategoryPlacesCache` auf, statt die
 * Logik inline zu duplizieren -- Verhalten für "Heute" unverändert.
 */
export async function loadCategoryPlaces(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const category = String(formData.get('category') ?? '') as TodayCategoryKey
  const returnTo = String(formData.get('return_to') ?? '/today')

  const config = getTodayCategoryConfig(category)
  if (!config?.placesCategory || !familyId || !tripId) redirect(returnTo)

  const contextResult = await buildLumiContext(familyId, tripId, new Date().toISOString().slice(0, 10))
  if (!contextResult.ok) redirect(`${returnTo}?error=${encodeURIComponent(lumiContextErrorMessage(contextResult.reason))}`)
  const context = contextResult.context

  const origin = context.origin
  const originKey = originKeyFor(origin)

  const candidates = await searchCategoryCandidates(origin, config)
  if (!candidates.ok) redirect(`${returnTo}?error=${encodeURIComponent(candidates.message)}`)

  const picks = await generateFiveRecommendations({
    locationLabel: origin.formattedAddress,
    candidates: candidates.facts.map((r) => ({
      name: r.place.name, category: config.key,
      rating: r.place.rating, userRatingCount: r.place.userRatingCount, openNow: r.place.openNow,
      durationMinutes: r.durationMinutes, distanceKm: r.distanceKm,
    })),
    familyDnaText: context.dnaText,
    // §Bugfix "Alter fälschlich hart auf null gesetzt" (Nutzervorgabe, Familienprofil):
    // Kategorien-Empfehlungen gelten für HEUTE -- Alter zum heutigen Datum berechnen,
    // nicht erfinden/weglassen, wo birth_date längst geladen ist.
    members: context.dna.persons.map((p) => ({ name: p.name, age: ageAtDate(p.birth_date, context.todayIso), isMinor: p.is_minor })),
    weatherSummary: context.weather ? `${context.weather.currentTemp}°C, ${context.weather.daily[0]?.tempMin}-${context.weather.daily[0]?.tempMax}°C` : null,
  })

  const items = buildCategoryPlaceItems(candidates.facts, picks)
  await writeCategoryPlacesCache(familyId, tripId, category, originKey, origin.formattedAddress, origin.source, items)

  redirect(returnTo)
}
