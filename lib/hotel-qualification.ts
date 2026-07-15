import type { LodgingResult } from '@/lib/providers/places-provider'
import { classifyHotelBrand, type LuxuryHotelTier } from '@/lib/data/luxury-hotel-brands'

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

export type HotelQualification = { qualifies: boolean; tier: LuxuryHotelTier; tierBasis: 'brand' | 'heuristic' }

export function classifyAndQualify(hotel: LodgingResult): HotelQualification {
  const brandTier = classifyHotelBrand(hotel.name)
  if (brandTier) return { qualifies: true, tier: brandTier, tierBasis: 'brand' }

  const highRating = hotel.rating !== null && hotel.rating >= QUALIFYING_MIN_RATING && (hotel.userRatingCount ?? 0) >= QUALIFYING_MIN_REVIEWS
  const highPrice = hotel.priceLevel !== null && QUALIFYING_PRICE_LEVELS.has(hotel.priceLevel)
  if (highRating && highPrice) return { qualifies: true, tier: 'standard', tierBasis: 'heuristic' }

  return { qualifies: false, tier: 'standard', tierBasis: 'heuristic' }
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
