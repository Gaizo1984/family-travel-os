/**
 * §"Hotel-Shortlist qualitativ neu kalibrieren": Google Places liefert KEINE
 * offizielle Sterne-Klassifizierung -- ein "5-Sterne"-Feld existiert in der
 * API schlicht nicht. Statt zu raten, klassifizieren wir über eine kuratierte
 * Liste bekannter internationaler Hotelmarken (verifizierbar über den
 * tatsächlichen Namen des Places-Treffers), analog zu `destination-
 * knowledge.ts`/`hotel-knowledge.ts`/`flight-knowledge.ts` -- reines
 * Textmatching, kein Raten, jederzeit erweiterbar ohne Migration.
 *
 * Vier Stufen, exakt nach Nutzervorgabe (2026-07-16 überarbeitet):
 * - upper_upscale: gehobenes 5-Sterne-Niveau -- der MINDESTSTANDARD für die
 *   gesamte Shortlist.
 * - premium_luxury: deutlich oberhalb des Mindeststandards, aber nicht
 *   automatisch Ultra-Luxus.
 * - ultra_luxury: sehr exklusives Luxussegment.
 * - iconic: KEINE eigene Stufe, sondern eine Zusatzkennzeichnung für
 *   außergewöhnliche Einzelhotels (siehe `HOTEL_OVERRIDES`/`getHotelOverride`
 *   unten) -- ersetzt nie die Hauptstufe, ein Hotel bleibt z. B.
 *   `ultra_luxury` UND zusätzlich `isIconic: true`.
 */
export type LuxuryHotelTier = 'upper_upscale' | 'premium_luxury' | 'ultra_luxury'

export const LUXURY_TIER_LABELS: Record<LuxuryHotelTier, string> = {
  upper_upscale: 'Gehobenes 5-Sterne-Hotel',
  premium_luxury: 'Premium Luxury — deutlich über dem Mindeststandard',
  ultra_luxury: 'Ultra Luxury',
}

/** Rangfolge der Stufen (höher = exklusiver) -- zentral statt in jeder Vergleichs-/Sortierlogik erneut dupliziert. */
export const TIER_RANK: Record<LuxuryHotelTier, number> = { upper_upscale: 1, premium_luxury: 2, ultra_luxury: 3 }

const LUXURY_HOTEL_BRANDS: Array<{ keywords: string[]; tier: LuxuryHotelTier }> = [
  {
    tier: 'upper_upscale',
    keywords: [
      'westin', 'le méridien', 'le meridien', 'grand hyatt', 'intercontinental',
      'conrad', 'fairmont', 'kempinski', 'anantara', 'shangri-la', 'shangri la',
      'constance',
    ],
  },
  {
    tier: 'premium_luxury',
    keywords: [
      'ritz-carlton', 'ritz carlton', 'waldorf astoria', 'park hyatt', 'jw marriott',
      'rosewood', 'raffles', 'capella', 'como hotel', 'como shambhala', 'como uma',
      'auberge resort', 'oetker collection', 'fasano',
    ],
  },
  {
    tier: 'ultra_luxury',
    keywords: [
      'one&only', 'one & only', 'four seasons', 'mandarin oriental', 'aman',
      'cheval blanc', 'six senses', 'belmond', 'nihi',
    ],
  },
]

/**
 * §"Iconic darf nicht ausschließlich über die Marke vergeben werden --
 * es muss für das konkrete Hotel begründet werden" (Nutzervorgabe, wörtlich):
 * einzelne Hotels können innerhalb derselben Marke höher/niedriger einzustufen
 * sein als der Markendurchschnitt, oder zusätzlich als "iconic"
 * (außergewöhnliches Einzelhotel) markiert werden -- unabhängig von der
 * Hauptstufe. `reason` ist PFLICHT bei `iconic: true` (dokumentiert die
 * konkrete Begründung, z. B. historische Bedeutung, Landmark-Status,
 * unverwechselbare Architektur/Lage, eigenständiges Resortkonzept, kulturelle
 * Verankerung, außergewöhnliche Exklusivität, langfristig prägender Ruf) --
 * nie pauschal für eine ganze Marke. Overrides werden per Teilstring auf den
 * echten Places-Namen geprüft und haben Vorrang vor der reinen
 * Markenzuordnung. Zentral gepflegt, hier erweiterbar ohne Migration.
 */
const HOTEL_OVERRIDES: Array<{ match: string; tier?: LuxuryHotelTier; iconic?: boolean; reason?: string }> = [
  {
    match: 'belmond copacabana palace', iconic: true,
    reason: 'Außergewöhnliche historische Bedeutung und internationaler Landmark-Status in Rio de Janeiro.',
  },
  {
    match: 'one&only le saint géran', iconic: true,
    reason: 'Historie, hoher Wiedererkennungswert und prägende Bedeutung für Mauritius.',
  },
  {
    match: 'one&only le saint geran', iconic: true,
    reason: 'Historie, hoher Wiedererkennungswert und prägende Bedeutung für Mauritius.',
  },
  {
    match: 'one&only mandarina', iconic: true,
    reason: 'Außergewöhnliche Lage, Architektur, Privatsphäre und eigenständiges Resorterlebnis.',
  },
]

function findOverride(name: string): { tier?: LuxuryHotelTier; iconic?: boolean; reason?: string } | undefined {
  const lower = name.toLowerCase()
  return HOTEL_OVERRIDES.find((o) => lower.includes(o.match))
}

/** Reines Textmatching auf den echten Places-Namen -- kein Raten, keine externe Abhängigkeit. */
export function classifyHotelBrand(name: string): LuxuryHotelTier | null {
  const lower = name.toLowerCase()
  for (const entry of LUXURY_HOTEL_BRANDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.tier
  }
  return null
}

/**
 * Kombiniert hausbezogenen Tier-Override (falls vorhanden) mit der reinen
 * Markenzuordnung, plus die unabhängige, IMMER hausbezogen begründete
 * "iconic"-Zusatzkennzeichnung. `tier: undefined` bedeutet "kein Override,
 * normale Markenzuordnung nutzen".
 */
export function getHotelOverride(name: string): { tier?: LuxuryHotelTier; iconic: boolean; reason: string | null } {
  const override = findOverride(name)
  return { tier: override?.tier, iconic: override?.iconic ?? false, reason: override?.reason ?? null }
}
