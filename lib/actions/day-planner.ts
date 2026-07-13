'use server'

import { redirect } from 'next/navigation'
import { searchPlaces, distanceKm, type PlacesCategory, type PlaceResult } from '@/lib/providers/places-provider'
import { computeRoute, computeRouteMatrix } from '@/lib/providers/routes-provider'
import { generateFiveRecommendations } from '@/lib/concierge-ai'
import { buildLumiContext } from '@/lib/lumi-context'
import { describeWeatherCode } from '@/lib/weather'
import { MAX_LEG_MINUTES } from '@/lib/dev-test-config'

export type DayPlanMode = 'today' | 'tomorrow' | 'bad_weather' | 'morning' | 'afternoon' | 'dinner' | 'custom'

const MODE_LABELS: Record<DayPlanMode, string> = {
  today: 'Heute', tomorrow: 'Morgen', bad_weather: 'Schlechtwetter-Tag',
  morning: 'Vormittag', afternoon: 'Mittag/Nachmittag', dinner: 'Restaurantabend', custom: 'Individueller Wunsch',
}
const MODE_CATEGORIES: Record<DayPlanMode, PlacesCategory[]> = {
  today: ['attraction', 'nature', 'beach', 'restaurant'],
  tomorrow: ['attraction', 'nature', 'beach', 'restaurant'],
  bad_weather: ['attraction', 'restaurant'],
  morning: ['attraction', 'nature', 'beach'],
  afternoon: ['attraction', 'nature', 'beach'],
  dinner: ['restaurant'],
  custom: ['attraction', 'nature', 'beach', 'restaurant'],
}
const MODE_MAX_STOPS: Record<DayPlanMode, number> = {
  today: 3, tomorrow: 3, bad_weather: 2, morning: 2, afternoon: 2, dinner: 1, custom: 3,
}
/** Grobe, deterministische Aufenthaltsdauer je Kategorie -- keine erfundene KI-Zahl, nur eine transparente Faustregel. */
const STOP_DURATION_MINUTES: Record<PlacesCategory, number> = {
  restaurant: 75, beach: 120, attraction: 90, nature: 100,
}
const NEAR_ORIGIN_METERS = 150

export type DayPlanStop = {
  placeId: string; name: string; category: PlacesCategory
  travelMinutes: number; travelDistanceKm: number; stopDurationMinutes: number
  why: string | null
}

export type DayPlan = {
  mode: DayPlanMode; title: string; originLabel: string
  stops: DayPlanStop[]
  totalTravelMinutes: number; totalTravelDistanceKm: number
  mealBreakNote: string | null; weatherNote: string | null; kidsNote: string | null
  returnNote: string; alternativeNote: string
}

/**
 * §"Tagesplanung" (LUMI Intelligence v1, §5): folgt exakt dem in
 * `lib/actions/dev-tests/daytrip-test.ts` bewiesenen Muster (Kandidaten
 * sammeln, deduplizieren, Nähe-Ausschluss, Route-Matrix-Vorauswahl,
 * optimierte Rundroute) statt einer neuen Logik -- nur die Kategorie-Auswahl
 * ist jetzt vom gewählten Modus abhängig. `generateFiveRecommendations`
 * (bestehend) liefert die Begründungstexte je Stopp; alle übrigen Hinweise
 * (Wetter, Kinder, Pause) werden aus bereits bekannten Fakten abgeleitet,
 * nicht von der KI erfunden. Nur auf ausdrücklichen Klick, kein Caching --
 * ein Tagesplan ist ein Werkzeug, kein täglich einmaliger Vorschlag wie
 * "Heute empfiehlt LUMI".
 */
export async function generateDayPlan(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const mode = (String(formData.get('mode') ?? 'today') as DayPlanMode)
  const returnTo = String(formData.get('return_to') ?? '/today/plan')

  if (!familyId || !tripId) redirect('/today')

  const context = await buildLumiContext(familyId, tripId, new Date().toISOString().slice(0, 10))
  if (!context) redirect(`${returnTo}?error=${encodeURIComponent('Reise konnte nicht geladen werden')}`)

  const origin = context.origin
  const categories = MODE_CATEGORIES[mode] ?? MODE_CATEGORIES.today
  const maxStops = MODE_MAX_STOPS[mode] ?? 2

  const searchResults = await Promise.all(
    categories.map((category) => searchPlaces({ locationName: origin.formattedAddress, category, lat: origin.lat, lng: origin.lng })),
  )

  const seenIds = new Set<string>()
  const candidates: Array<{ place: PlaceResult; category: PlacesCategory }> = []
  categories.forEach((category, i) => {
    for (const p of searchResults[i] ?? []) {
      if (seenIds.has(p.id)) continue
      seenIds.add(p.id)
      if (distanceKm(origin, { lat: p.lat, lng: p.lng }) * 1000 < NEAR_ORIGIN_METERS) continue
      candidates.push({ place: p, category })
    }
  })

  if (candidates.length === 0) {
    redirect(`${returnTo}?error=${encodeURIComponent('Keine Kandidaten-Stopps in der Nähe gefunden.')}`)
  }

  const matrix = await computeRouteMatrix({
    origins: [{ lat: origin.lat, lng: origin.lng }],
    destinations: candidates.map((c) => ({ lat: c.place.lat, lng: c.place.lng })),
  })

  const reachable = candidates
    .map((c, i) => ({ ...c, matrixEl: matrix?.find((m) => m.destinationIndex === i) ?? null }))
    .filter((c): c is typeof c & { matrixEl: NonNullable<typeof c.matrixEl> } =>
      Boolean(c.matrixEl?.reachable && c.matrixEl.durationSeconds != null && c.matrixEl.durationSeconds / 60 <= MAX_LEG_MINUTES))
    .sort((a, b) => (b.place.rating ?? 0) - (a.place.rating ?? 0))
    .slice(0, Math.max(maxStops, 5))

  if (reachable.length === 0) {
    redirect(`${returnTo}?error=${encodeURIComponent('Keine ausreichend nahen Stopps gefunden.')}`)
  }

  const picks = await generateFiveRecommendations({
    locationLabel: origin.formattedAddress,
    candidates: reachable.map((r) => ({
      name: r.place.name, category: r.category,
      rating: r.place.rating, userRatingCount: r.place.userRatingCount, openNow: r.place.openNow,
      durationMinutes: Math.round((r.matrixEl.durationSeconds ?? 0) / 60),
      distanceKm: Math.round((r.matrixEl.distanceMeters ?? 0) / 100) / 10,
    })),
    familyDnaText: context.dnaText,
    members: context.dna.persons.map((p) => ({ name: p.name, age: null, isMinor: p.is_minor })),
    weatherSummary: context.weather ? `${context.weather.currentTemp}°C, ${describeWeatherCode(context.weather.currentCode).label}` : null,
  })

  const pickedNames = picks ? picks.map((p) => p.placeName) : reachable.slice(0, maxStops).map((r) => r.place.name)
  const selected = reachable.filter((r) => pickedNames.includes(r.place.name)).slice(0, maxStops)
  const finalSelection = selected.length >= 1 ? selected : reachable.slice(0, maxStops)

  const route = await computeRoute({
    origin: { lat: origin.lat, lng: origin.lng }, destination: { lat: origin.lat, lng: origin.lng },
    waypoints: finalSelection.map((r) => ({ lat: r.place.lat, lng: r.place.lng })),
    optimizeWaypointOrder: finalSelection.length > 1,
  })

  if (!route) {
    redirect(`${returnTo}?error=${encodeURIComponent('Route konnte nicht berechnet werden.')}`)
  }

  const order = route.optimizedWaypointOrder ?? finalSelection.map((_, i) => i)
  const pickByName = new Map((picks ?? []).map((p) => [p.placeName, p]))

  const stops: DayPlanStop[] = order.map((i) => {
    const r = finalSelection[i]
    const pick = pickByName.get(r.place.name)
    return {
      placeId: r.place.id, name: r.place.name, category: r.category,
      travelMinutes: Math.round((r.matrixEl.durationSeconds ?? 0) / 60),
      travelDistanceKm: Math.round((r.matrixEl.distanceMeters ?? 0) / 100) / 10,
      stopDurationMinutes: STOP_DURATION_MINUTES[r.category],
      why: pick?.why ?? null,
    }
  })

  const minorNames = context.dna.persons.filter((p) => p.is_minor).map((p) => p.name)

  const plan: DayPlan = {
    mode, title: `${MODE_LABELS[mode] ?? 'Tagesplan'} ab ${origin.formattedAddress}`, originLabel: origin.formattedAddress,
    stops,
    totalTravelMinutes: Math.round(route.durationSeconds / 60),
    totalTravelDistanceKm: Math.round(route.distanceMeters / 100) / 10,
    mealBreakNote: mode !== 'dinner' && stops.length >= 2 ? 'Pause/Mittagessen nach dem ersten Stopp einplanen.' : null,
    weatherNote: context.weather ? `Aktuell ${context.weather.currentTemp}°C, ${describeWeatherCode(context.weather.currentCode).label}.` : null,
    kidsNote: minorNames.length > 0 ? `Mit dabei: ${minorNames.join(', ')}.` : null,
    returnNote: `Gesamtfahrzeit ca. ${Math.round(route.durationSeconds / 60)} Min -- Rückkehr zum Ausgangspunkt eingerechnet.`,
    alternativeNote: 'Bei Wetterumschwung: „Schlechtwetter-Alternativen" bei Frag LUMI nutzen.',
  }

  redirect(`${returnTo}?plan=${encodeURIComponent(JSON.stringify(plan))}`)
}
