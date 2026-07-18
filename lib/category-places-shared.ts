import type { PlaceResult } from '@/lib/providers/places-provider'
import type { FiveRecommendationsResult } from '@/lib/concierge-ai'
import type { LumiContext } from '@/lib/lumi-context'

/**
 * §"Tagesplaner 2.0, keine parallele Places-Logik aufbauen" (Nutzervorgabe):
 * reine, synchrone Hilfsfunktionen/Typen rund um `category_places_cache` --
 * ausgelagert aus `lib/actions/category-places.ts`, weil eine Datei mit
 * `'use server'` am Kopf laut Next.js-Konvention ausschließlich async
 * Funktionen exportieren darf (jeder Export wird als Server Function
 * behandelt). `originKeyFor`/`buildCategoryPlaceItems` sind aber reine,
 * synchrone Zuordnungsfunktionen ohne eigenen Netzwerk-/DB-Zugriff -- werden
 * von `lib/actions/category-places.ts` (Heute) UND `lib/actions/day-planner.ts`
 * (Tagesplaner) gemeinsam genutzt, keine zweite Definition.
 */

export type CategoryPlaceItem = {
  placeId: string; name: string; photoName: string | null
  rating: number | null; reviewCount: number | null; openNow: boolean | null
  durationMinutes: number | null; distanceKm: number | null
  /**
   * §"Tagesplaner 2.0": bisher wurden hier nur Distanz/Fahrzeit AB DEM
   * AUSGANGSPUNKT gespeichert -- für eine Mehr-Stopp-Route zwischen mehreren
   * Kandidaten braucht es zusätzlich die echten Koordinaten jedes Ortes.
   * Cache-Einträge von vor dieser Änderung haben hier `null` -- Aufrufer,
   * die Koordinaten für eine Route brauchen (lib/actions/day-planner.ts),
   * behandeln das wie "für eine Route ungeeignet", NIE wie eine erfundene
   * Koordinate (kein Fallback-Rateversuch).
   */
  lat: number | null; lng: number | null
  why: string | null; tripLength: string | null
}

export type CategoryPlacesResult = {
  originLabel: string
  originSource: 'hotel' | 'location'
  items: CategoryPlaceItem[]
  updatedAt: string
  daysAgo: number
}

export type CategoryCandidateFact = { place: PlaceResult; durationMinutes: number | null; distanceKm: number }

/** Places-ID (bevorzugt) oder auf ca. 100 m gerundete Koordinate -- siehe Migrationskommentar zu category_places_cache. */
export function originKeyFor(origin: LumiContext['origin']): string {
  return origin.placeId ?? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`
}

/** Reine Zuordnungsfunktion (kein Netzwerkzugriff): baut die cachefähigen Items aus Fakten + optionalen KI-Begründungen derselben Kategorie. */
export function buildCategoryPlaceItems(facts: CategoryCandidateFact[], picks: FiveRecommendationsResult | null): CategoryPlaceItem[] {
  const pickByName = new Map((picks ?? []).map((p) => [p.placeName, p]))
  return facts.map((r) => {
    const pick = pickByName.get(r.place.name)
    return {
      placeId: r.place.id, name: r.place.name, photoName: r.place.photoName,
      rating: r.place.rating, reviewCount: r.place.userRatingCount, openNow: r.place.openNow,
      durationMinutes: r.durationMinutes, distanceKm: r.distanceKm,
      lat: r.place.lat, lng: r.place.lng,
      why: pick?.why ?? null, tripLength: pick?.tripLength ?? null,
    }
  })
}
