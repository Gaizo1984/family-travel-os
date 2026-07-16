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

/**
 * §"priceLevel = null ist eine Datenlücke und darf nicht als negatives
 * Preissignal gelten" (Nutzervorgabe, wörtlich): Google liefert für viele
 * echte Hotels/Resorts schlicht kein priceLevel -- das ist etwas anderes als
 * ein bekannt niedriges/mittleres priceLevel. Der Bewertungs-Bar für diesen
 * Fall liegt bewusst UNTER `QUALIFYING_MIN_RATING`, weil er zusätzlich durch
 * `isPlausibleHotelCategory` (siehe unten) abgesichert ist -- verhindert,
 * dass beliebige Unterkünfte allein wegen guter Bewertungen qualifizieren.
 */
export const QUALIFYING_MIN_RATING_PRICE_UNKNOWN = 4.4

/**
 * §"Plausible Hotel-/Resort-Kategorie" (Nutzervorgabe): Google-Places-Typen,
 * die KEIN gehobenes Hotel/Resort im gewünschten Sinn sind -- schließen den
 * "priceLevel unbekannt"-Heuristik-Zweig aus, unabhängig von der Bewertung.
 * Als Ausschlussliste (statt Positivliste) geführt, damit ein echtes Resort
 * mit einem von Google unüblich benannten Typ nicht versehentlich durchfällt.
 */
const NON_HOTEL_LODGING_TYPES = new Set([
  'guest_house', 'hostel', 'campground', 'rv_park', 'farmstay',
  'bed_and_breakfast', 'cottage', 'japanese_inn', 'budget_japanese_inn',
  'capsule_hotel', 'private_guest_room', 'camping_cabin',
])

function isPlausibleHotelCategory(types: string[]): boolean {
  return !types.some((t) => NON_HOTEL_LODGING_TYPES.has(t))
}

export type HotelQualification = {
  qualifies: boolean; tier: LuxuryHotelTier; tierBasis: 'brand' | 'heuristic'
  isIconic: boolean; iconicReason: string | null
}

/**
 * §"Hausbezogene Overrides ermöglichen": ein per Name gefundener Override
 * (siehe `getHotelOverride`) geht der reinen Markenzuordnung vor -- ein
 * einzelnes Hotel kann so höher/niedriger als seine Marke im Schnitt
 * eingestuft werden. `isIconic` ist davon unabhängig und ersetzt nie die
 * Hauptstufe -- wird NIE pauschal aus der Marke abgeleitet, nur aus einem
 * konkret begründeten Override (`iconicReason`).
 */
export function classifyAndQualify(hotel: LodgingResult): HotelQualification {
  const override = getHotelOverride(hotel.name)
  const brandTier = override.tier ?? classifyHotelBrand(hotel.name)
  const iconic = { isIconic: override.iconic, iconicReason: override.reason }
  if (brandTier) return { qualifies: true, tier: brandTier, tierBasis: 'brand', ...iconic }

  const highRating = hotel.rating !== null && hotel.rating >= QUALIFYING_MIN_RATING && (hotel.userRatingCount ?? 0) >= QUALIFYING_MIN_REVIEWS
  const highPrice = hotel.priceLevel !== null && QUALIFYING_PRICE_LEVELS.has(hotel.priceLevel)
  if (highRating && highPrice) return { qualifies: true, tier: 'upper_upscale', tierBasis: 'heuristic', ...iconic }

  // §"Fehlendes priceLevel darf nicht automatisch zur Disqualifikation
  // führen, aber keine pauschale Qualifizierung beliebiger Unterkünfte"
  // (Nutzervorgabe): nur bei echter Datenlücke (nicht: bekannt günstig/
  // mittel), ausreichend Rezensionen UND plausibler Hotel-/Resort-Kategorie.
  // Landet wie der reguläre Heuristik-Zweig auf `upper_upscale` -- die
  // Einordnung bleibt an der bestehenden Hauslogik, wird nicht automatisch
  // höher eingestuft.
  const priceUnknown = hotel.priceLevel === null
  const strongRatingWithoutPrice = hotel.rating !== null
    && hotel.rating >= QUALIFYING_MIN_RATING_PRICE_UNKNOWN
    && (hotel.userRatingCount ?? 0) >= QUALIFYING_MIN_REVIEWS
  if (priceUnknown && strongRatingWithoutPrice && isPlausibleHotelCategory(hotel.types)) {
    return { qualifies: true, tier: 'upper_upscale', tierBasis: 'heuristic', ...iconic }
  }

  return { qualifies: false, tier: 'upper_upscale', tierBasis: 'heuristic', ...iconic }
}

export type TierComposition = { upperUpscale: number; premiumLuxury: number; ultraLuxury: number; iconic: number }

/**
 * §"Gehobene 5 Sterne auf bis zu 5, Premium auf 4, Ultra auf 3, Iconic auf 2"
 * (Nutzervorgabe, 2026-07-17 nachjustiert nach Mauritius-Livetest -- die
 * meisten echten Treffer liegen typischerweise im Einstiegssegment).
 */
export const DEFAULT_TIER_COMPOSITION: TierComposition = { upperUpscale: 5, premiumLuxury: 4, ultraLuxury: 3, iconic: 2 }

/**
 * §"Nicht nur nach einer einzelnen höchsten Stufe sortieren, sondern
 * ausgewogen zusammengesetzt, Iconic exklusiv" (Nutzervorgabe): wählt je
 * Kategorie die bestbewerteten ECHTEN, bereits qualifizierten Kandidaten
 * (kein Auffüllen mit unqualifizierten Treffern) -- fehlt eine Kategorie
 * komplett, bleibt der Slot einfach leer, nie künstlich aufgefüllt. Ein
 * als `isIconic` markiertes Hotel erscheint AUSSCHLIESSLICH im Iconic-Bereich,
 * nie zusätzlich in seiner Hauptstufe -- jedes Hotel erscheint nur einmal.
 * Rückgabe bereits in Anzeigereihenfolge (Iconic → Ultra Luxury → Premium
 * Luxury → Gehobene 5 Sterne), damit die UI direkt danach gruppieren kann.
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
    // §"Iconic ausschließlich im Iconic-Bereich, nicht zusätzlich in der Hauptstufe": exklusive Zuordnung.
    if (q.isIconic) iconicPool.push(c)
    else byTier[q.tier].push(c)
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

  // §"Aufstellung beginnt beim höchsten Standard: Iconic oder Ultra Luxury".
  takeFrom(iconicPool, composition.iconic)
  takeFrom(byTier.ultra_luxury, composition.ultraLuxury)
  takeFrom(byTier.premium_luxury, composition.premiumLuxury)
  takeFrom(byTier.upper_upscale, composition.upperUpscale)

  // §"Kapazitätsweitergabe nur zwischen bereits qualifizierten Hotels,
  // Priorität Iconic -> Ultra Luxury -> Premium Luxury -> Gehobene 5 Sterne,
  // Gesamtausgabe weiterhin maximal 11, keine Duplikate, keine künstliche
  // Auffüllung" (Nutzervorgabe, wörtlich): bleibt eine Stufe unter ihrem
  // Ziel-Slot (z. B. Premium Luxury hat keinen einzigen echten Kandidaten),
  // wird die dadurch ungenutzte Gesamtkapazität an ECHTE, bereits
  // qualifizierte, noch nicht ausgewählte Kandidaten aus den anderen Stufen
  // weitergereicht -- in derselben Prioritätsreihenfolge. `takeFrom`
  // überspringt bereits ausgewählte IDs, füllt also nie künstlich auf.
  const totalCap = composition.iconic + composition.ultraLuxury + composition.premiumLuxury + composition.upperUpscale
  for (const pool of [iconicPool, byTier.ultra_luxury, byTier.premium_luxury, byTier.upper_upscale]) {
    if (selected.length >= totalCap) break
    takeFrom(pool, totalCap - selected.length)
  }

  return selected
}

/** §"Bei kleinen Zielen (wenige Inseln, Safari-Regionen) kann ruhig jedes Hotel bedacht werden" (Nutzervorgabe): unterhalb dieser Gesamtkandidatenzahl wird der Mindeststandard-Filter bewusst gelockert. */
export const SMALL_DESTINATION_THRESHOLD = 10
const MAX_FALLBACK_CANDIDATES = 10

export type HotelSelectionResult = {
  items: LodgingResult[]
  /** true, wenn KEIN einziger Kandidat qualifiziert -- Hinweis "unterhalb des Mindeststandards" in der UI. */
  belowStandard: boolean
  /** true, wenn insgesamt nur wenige echte Kandidaten gefunden wurden (z. B. kleine Insel/abgelegene Region) -- Mindeststandard-Filter/Komposition wird dann bewusst gelockert, damit nicht fast nichts übrig bleibt. */
  limitedInventory: boolean
}

/**
 * §"Gibt es die eine Lösung?" -- nein, aber diese eine Funktion bündelt die
 * Entscheidung zentral (Nutzervorgabe: "keine parallele Logik"): bei wenigen
 * echten Gesamttreffern (kleine Insel, abgelegene Safari-Region) wird JEDES
 * real gefundene Hotel gezeigt und trotzdem einzeln klassifiziert (kein
 * Auffüllen, keine Erfindung) -- sonst greift wie gehabt entweder die
 * ausgewogene Komposition (`selectBalancedQualified`) oder, wenn wirklich
 * kein einziger Kandidat qualifiziert, der Bewertungs-Fallback. Zentral
 * genutzt von der idee-gekoppelten Hotel-Shortlist UND der eigenständigen
 * Hotelsuche, keine parallele Auswahllogik.
 */
export function selectHotelDisplayList(
  candidates: LodgingResult[],
  qualificationByPlaceId: Map<string, HotelQualification>,
): HotelSelectionResult {
  const anyQualified = candidates.some((c) => qualificationByPlaceId.get(c.id)?.qualifies)
  const limitedInventory = candidates.length <= SMALL_DESTINATION_THRESHOLD
  const belowStandard = !anyQualified
  const byRatingDesc = (a: LodgingResult, b: LodgingResult) => (b.rating ?? -1) - (a.rating ?? -1)

  if (limitedInventory) {
    return { items: [...candidates].sort(byRatingDesc), belowStandard, limitedInventory }
  }
  if (belowStandard) {
    return { items: [...candidates].sort(byRatingDesc).slice(0, MAX_FALLBACK_CANDIDATES), belowStandard, limitedInventory }
  }
  return { items: selectBalancedQualified(candidates, qualificationByPlaceId), belowStandard, limitedInventory }
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
