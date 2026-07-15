/**
 * §"Hotel-Shortlist qualitativ neu kalibrieren": Google Places liefert KEINE
 * offizielle Sterne-Klassifizierung -- ein "5-Sterne"-Feld existiert in der
 * API schlicht nicht. Statt zu raten, klassifizieren wir über eine kuratierte
 * Liste bekannter internationaler Hotelmarken (verifizierbar über den
 * tatsächlichen Namen des Places-Treffers), analog zu `destination-
 * knowledge.ts`/`hotel-knowledge.ts`/`flight-knowledge.ts` -- reines
 * Textmatching, kein Raten, jederzeit erweiterbar ohne Migration.
 *
 * Drei Stufen, exakt nach Nutzervorgabe:
 * - standard: gehobenes 5-Sterne-Niveau (Westin/Le Méridien-Klasse) -- der
 *   MINDESTSTANDARD für die gesamte Shortlist.
 * - premium: deutlich über Westin/Le Méridien.
 * - ultra_luxury: darf vorkommen, soll aber laut Vorgabe nicht die gesamte
 *   Auswahl dominieren (siehe Prompt in lib/trip-idea-advisor-ai.ts).
 */
export type LuxuryHotelTier = 'standard' | 'premium' | 'ultra_luxury'

export const LUXURY_TIER_LABELS: Record<LuxuryHotelTier, string> = {
  standard: 'Gehobenes 5-Sterne-Hotel',
  premium: 'Premium — deutlich über Westin-/Le-Méridien-Niveau',
  ultra_luxury: 'Ultra-Luxus',
}

const LUXURY_HOTEL_BRANDS: Array<{ keywords: string[]; tier: LuxuryHotelTier }> = [
  // §Standard: gehobenes 5-Sterne-Niveau, Westin/Le Méridien-Klasse.
  {
    tier: 'standard',
    keywords: [
      'westin', 'le méridien', 'le meridien', 'sheraton', 'renaissance hotel',
      'hyatt regency', 'intercontinental', 'kempinski', 'hilton', 'doubletree',
      'radisson collection', 'marriott hotel', 'marriott resort', 'autograph collection',
    ],
  },
  // §Premium: deutlich über Westin/Le Méridien.
  {
    tier: 'premium',
    keywords: [
      'jw marriott', 'st. regis', 'st regis', 'waldorf astoria', 'park hyatt',
      'conrad', 'grand hyatt', 'the luxury collection', 'luxury collection',
      'anantara', 'banyan tree', 'shangri-la', 'shangri la', 'fairmont', 'raffles',
      'oberoi', 'taj hotel', 'taj resort',
    ],
  },
  // §Ultra-Luxus.
  {
    tier: 'ultra_luxury',
    keywords: [
      'four seasons', 'ritz-carlton', 'ritz carlton', 'aman', 'one&only', 'one & only',
      'six senses', 'rosewood', 'mandarin oriental', 'belmond', 'como hotel', 'como shambhala',
      'bulgari hotel', 'cheval blanc', 'nihi sumba', 'amanpuri', 'soneva',
    ],
  },
]

/** Reines Textmatching auf den echten Places-Namen -- kein Raten, keine externe Abhängigkeit. */
export function classifyHotelBrand(name: string): LuxuryHotelTier | null {
  const lower = name.toLowerCase()
  for (const entry of LUXURY_HOTEL_BRANDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.tier
  }
  return null
}
