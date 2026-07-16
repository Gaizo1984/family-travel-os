import type { LodgingResult } from '@/lib/providers/places-provider'
import { classifyHotelBrand, getHotelOverride, type LuxuryHotelTier } from '@/lib/data/luxury-hotel-brands'

/**
 * §"Hotel-Shortlist qualitativ neu kalibrieren": Google Places liefert keine
 * offizielle Sterne-Klassifizierung -- Mindeststandard ist daher entweder
 * eine verifizierte internationale Marke (siehe luxury-hotel-brands.ts) ODER,
 * für unabhängige Resorts ohne Markenzugehörigkeit, eine belastbare
 * Fakten-Kombination aus hoher Bewertung + ausreichend Rezensionen + hohem
 * Preisniveau. Rating oder Preis ALLEIN reichen bewusst nicht (ein günstiges,
 * gut bewertetes Gästehaus soll nicht durchrutschen) -- beides zusammen muss
 * stimmen. Erfüllt ein Kandidat keines von beidem, wird er VOR der KI-Auswahl
 * konsequent ausgeschlossen, nicht erst danach schöngeredet.
 *
 * Extrahiert aus `lib/actions/trip-idea-advisor.ts` -- von der idee-
 * gekoppelten Hotel-Shortlist UND der eigenständigen Hotelsuche (`/hotels`)
 * gemeinsam genutzt, keine doppelte Qualifikationslogik.
 */
export const QUALIFYING_MIN_RATING = 4.5
export const QUALIFYING_MIN_REVIEWS = 100
export const QUALIFYING_PRICE_LEVELS = new Set(['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'])

export type HotelQualification = { qualifies: boolean; tier: LuxuryHotelTier; tierBasis: 'brand' | 'heuristic'; isIconic: boolean }

/**
 * §"Hausbezogene Overrides ermöglichen": ein per Name gefundener Override
 * (siehe `getHotelOverride`) geht der reinen Markenzuordnung vor -- ein
 * einzelnes Hotel kann so höher/niedriger als seine Marke im Schnitt
 * eingestuft werden. `isIconic` ist davon unabhängig und ersetzt nie die
 * Hauptstufe.
 */
export function classifyAndQualify(hotel: LodgingResult): HotelQualification {
  const override = getHotelOverride(hotel.name)
  const brandTier = override.tier ?? classifyHotelBrand(hotel.name)
  if (brandTier) return { qualifies: true, tier: brandTier, tierBasis: 'brand', isIconic: override.iconic }

  const highRating = hotel.rating !== null && hotel.rating >= QUALIFYING_MIN_RATING && (hotel.userRatingCount ?? 0) >= QUALIFYING_MIN_REVIEWS
  const highPrice = hotel.priceLevel !== null && QUALIFYING_PRICE_LEVELS.has(hotel.priceLevel)
  if (highRating && highPrice) return { qualifies: true, tier: 'upper_upscale', tierBasis: 'heuristic', isIconic: override.iconic }

  return { qualifies: false, tier: 'upper_upscale', tierBasis: 'heuristic', isIconic: override.iconic }
}

export type TierComposition = { upperUpscale: number; premiumLuxury: number; ultraLuxury: number; iconicBonus: number }

/** §"2 upper_upscale / 2 premium_luxury / 1 ultra_luxury / optional 1 iconic Pick" (Nutzervorgabe, wörtlich). */
export const DEFAULT_TIER_COMPOSITION: TierComposition = { upperUpscale: 2, premiumLuxury: 2, ultraLuxury: 1, iconicBonus: 1 }

/**
 * §"Nicht nur nach einer einzelnen höchsten Stufe sortieren, sondern
 * ausgewogen zusammengesetzt": wählt je Stufe die bestbewerteten ECHTEN,
 * bereits qualifizierten Kandidaten (kein Auffüllen mit unqualifizierten
 * Treffern) -- fehlt eine Stufe komplett, bleibt der Slot einfach leer,
 * nie mit einem erfundenen oder unqualifizierten Hotel aufgefüllt. Der
 * optionale iconic-Slot kommt obendrauf, wenn ein noch nicht anderweitig
 * gewähltes, als `isIconic` markiertes Hotel existiert.
 * Zentral genutzt von der idee-gekoppelten Hotel-Shortlist UND der
 * eigenständigen Hotelsuche, keine parallele Auswahllogik.
 */
export function selectBalancedQualified(
  candidates: LodgingResult[],
  qualificationByPlaceId: Map<string, HotelQualification>,
  composition: TierComposition = DEFAULT_TIER_COMPOSITION,
): LodgingResult[] {
  const byTier: Record<LuxuryHotelTier, LodgingResult[]> = { upper_upscale: [], premium_luxury: [], ultra_luxury: [] }
  const iconicPool: LodgingResult[] = []
  for (const c of candidates) {
    const q = qualificationByPlaceId.get(c.id)
    if (!q?.qualifies) continue
    byTier[q.tier].push(c)
    if (q.isIconic) iconicPool.push(c)
  }
  const byRatingDesc = (a: LodgingResult, b: LodgingResult) => (b.rating ?? -1) - (a.rating ?? -1)
  byTier.upper_upscale.sort(byRatingDesc)
  byTier.premium_luxury.sort(byRatingDesc)
  byTier.ultra_luxury.sort(byRatingDesc)
  iconicPool.sort(byRatingDesc)

  const selected: LodgingResult[] = []
  const selectedIds = new Set<string>()
  function takeFrom(pool: LodgingResult[], count: number) {
    let taken = 0
    for (const c of pool) {
      if (taken >= count) break
      if (selectedIds.has(c.id)) continue
      selected.push(c)
      selectedIds.add(c.id)
      taken++
    }
  }

  takeFrom(byTier.upper_upscale, composition.upperUpscale)
  takeFrom(byTier.premium_luxury, composition.premiumLuxury)
  takeFrom(byTier.ultra_luxury, composition.ultraLuxury)
  takeFrom(iconicPool, composition.iconicBonus)

  return selected
}

/**
 * §"Kein unbestätigtes HolidayCheck-Deep-Link-Format erfinden" (Nutzervorgabe):
 * öffnet stattdessen eine Google-Suche mit `site:holidaycheck.de` -- keine
 * Reisedaten/Reisende in der URL, solange kein verifiziertes HolidayCheck-
 * Suchschema vorliegt. Einzige Stelle, die später durch einen echten
 * HolidayCheck-Deep-Link oder Affiliate-Link ersetzt wird, ohne Aufrufer
 * anzufassen.
 */
export function buildHolidayCheckSearchUrl(hotelName: string, destination: string): string {
  const query = `${hotelName} ${destination} site:holidaycheck.de`
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}
