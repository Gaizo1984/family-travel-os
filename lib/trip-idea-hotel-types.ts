import type { LuxuryHotelTier } from '@/lib/data/luxury-hotel-brands'

/** Gespeicherte Form von `trip_ideas.hotel_shortlist` -- gemeinsam genutzt von der Server Action (lib/actions/trip-idea-advisor.ts) und der Ideen-Detailseite (app/(app)/plan/ideas/[sessionId]/[ideaId]/page.tsx), keine doppelte Typdefinition. */
export type HotelShortlistItem = {
  placeId: string; name: string; address: string
  rating: number | null; reviewCount: number | null; priceLevel: string | null
  photoName: string | null; websiteUri: string | null; transferMinutes: number | null
  familyFitReasoning: string; styleImpression: string; bestFor: string; caveats: string
  /** null = Fallback-Kandidat unterhalb des Mindeststandards (siehe HotelShortlist.belowStandard). */
  tier: LuxuryHotelTier | null; tierBasis: 'brand' | 'heuristic'
  /** Zusatzkennzeichnung für außergewöhnliche Einzelhotels -- kein Ersatz für `tier`. */
  isIconic: boolean
  /** Konkrete, hausbezogene Begründung für `isIconic` -- nie pauschal aus der Marke abgeleitet. */
  iconicReason: string | null
  unverifiedFields: string[]
  livePricing: null
}

export type HotelShortlist = { items: HotelShortlistItem[]; belowStandard: boolean }
