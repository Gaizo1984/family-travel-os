import type { FlightSearchOption, FlightBadge, CheckedBaggageStatus, BaggageEntryStatus } from '@/lib/flight-types'

/**
 * §"LUMI Flight Score zentral berechnen, nicht in der UI verteilen": einziger
 * Ort für Badges/Rangfolge/Gepäckauswertung -- kein KI-Aufruf, keine
 * subjektive Bewertung, ausschließlich Preis/Gesamtreisezeit/Umstiege/Gepäck
 * (Docx-Vorgabe). Wird ausschließlich aus `lib/actions/flight-search.ts`
 * aufgerufen; UI-Komponenten (`FlightCard`, `FlightFilterBar`) berechnen
 * selbst nichts, sie rendern nur die hier bereits gesetzten
 * `badges`/`checkedBaggageStatus`/`comparisonHints` und die von
 * `sortByDefault` bereits sortierte Liste.
 */

/** Dichte Rangfolge (1 = bester Wert), Gleichstände teilen sich denselben Rang -- keine komplexe Punktelogik, nur einfache, nachvollziehbare Ränge. */
function denseRank(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  return values.map((v) => sorted.indexOf(v) + 1)
}

/**
 * §"Gepäcklogik, nicht repräsentativ" (Nutzervorgabe, wörtlich umgesetzt):
 * NIE der erste Passagier/das erste Segment als repräsentativ angenommen --
 * aggregiert ALLE `checkedBaggageByPassenger`-Einträge aus ALLEN Segmenten
 * (Hin- und Rückflug, alle ausgewählten Reisenden) zu genau einem von vier
 * Zuständen:
 *   - ein `unknown`-Eintrag irgendwo (fehlend/uneindeutig) -> 'not_verified' ("Gepäck nicht verifiziert") -- höchste Priorität, nie geraten
 *   - sonst: ALLE Einträge `included`                      -> 'included'     ("Aufgabegepäck inklusive")
 *   - sonst: ALLE Einträge `excluded`                       -> 'none'         ("Kein Aufgabegepäck enthalten")
 *   - sonst (vollständig bekannt, aber gemischt)            -> 'partial'      ("Gepäck teilweise inklusive")
 */
function deriveBaggageStatus(option: FlightSearchOption): CheckedBaggageStatus {
  const entries: BaggageEntryStatus[] = []
  for (const itinerary of [option.outbound, option.inbound]) {
    if (!itinerary) continue
    for (const segment of itinerary.segments) entries.push(...segment.checkedBaggageByPassenger)
  }
  if (entries.length === 0) return 'not_verified'
  if (entries.some((e) => e === 'unknown')) return 'not_verified'
  if (entries.every((e) => e === 'included')) return 'included'
  if (entries.every((e) => e === 'excluded')) return 'none'
  return 'partial'
}

export const FlightScoringService = {
  deriveBaggageStatus,

  /**
   * Badges: `schnellste` (kürzeste Gesamtreisezeit), `direktflug` (keine
   * Umstiege), `gepaeck_inklusive` (NUR bei checkedBaggageStatus==='included',
   * nie bei 'partial'/'none'/'not_verified'), `preis_leistung` (günstigster
   * Preis), `lumi_empfehlung` (bester unweighted Rang-Summen-Ausgleich aus
   * Preis+Reisezeit+Umstiegen). `comparisonHints` (nur bei `lumi_empfehlung`,
   * falls nicht zugleich auch der günstigste): kurze Vergleichssätze
   * gegenüber der günstigsten Verbindung, exakt wie im Docx-Vorbild
   * ("+180 € gegenüber günstigster Verbindung", "4 Stunden kürzere
   * Gesamtreisezeit", ...).
   */
  computeBadges(options: FlightSearchOption[]): FlightSearchOption[] {
    if (options.length === 0) return options

    const withBaggage = options.map((o) => ({ ...o, checkedBaggageStatus: deriveBaggageStatus(o) }))

    const prices = withBaggage.map((o) => o.price)
    const durations = withBaggage.map((o) => o.totalDurationMinutes)
    const stops = withBaggage.map((o) => o.maxStopCount)
    const priceRanks = denseRank(prices)
    const durationRanks = denseRank(durations)
    const stopRanks = denseRank(stops)
    const rankSums = withBaggage.map((_, i) => priceRanks[i] + durationRanks[i] + stopRanks[i])
    const minRankSum = Math.min(...rankSums)
    const minPrice = Math.min(...prices)
    const cheapestIndex = prices.indexOf(minPrice)

    return withBaggage.map((o, i) => {
      const badges: FlightBadge[] = []
      if (durationRanks[i] === 1) badges.push('schnellste')
      if (o.maxStopCount === 0) badges.push('direktflug')
      if (o.checkedBaggageStatus === 'included') badges.push('gepaeck_inklusive')
      if (priceRanks[i] === 1) badges.push('preis_leistung')
      if (rankSums[i] === minRankSum) badges.push('lumi_empfehlung')

      const comparisonHints: string[] = []
      if (badges.includes('lumi_empfehlung') && i !== cheapestIndex) {
        const cheapest = withBaggage[cheapestIndex]
        const priceDelta = Math.round(o.price - cheapest.price)
        const durationDeltaMinutes = cheapest.totalDurationMinutes - o.totalDurationMinutes
        const stopDelta = cheapest.maxStopCount - o.maxStopCount
        if (priceDelta > 0) comparisonHints.push(`+${priceDelta} ${o.currency} gegenüber günstigster Verbindung`)
        if (durationDeltaMinutes >= 60) comparisonHints.push(`${Math.round(durationDeltaMinutes / 60)} Stunden kürzere Gesamtreisezeit`)
        if (stopDelta > 0) comparisonHints.push(`${stopDelta} Umstieg${stopDelta > 1 ? 'e' : ''} weniger`)
        if (o.checkedBaggageStatus === 'included' && cheapest.checkedBaggageStatus !== 'included') comparisonHints.push('Aufgabegepäck inklusive')
      }

      return { ...o, badges, comparisonHints }
    })
  },

  /** UI übernimmt diese Reihenfolge unverändert -- LUMI-Empfehlung(en) zuerst, sonst nach Preis. */
  sortByDefault(options: FlightSearchOption[]): FlightSearchOption[] {
    return [...options].sort((a, b) => {
      const aRec = a.badges.includes('lumi_empfehlung') ? 0 : 1
      const bRec = b.badges.includes('lumi_empfehlung') ? 0 : 1
      if (aRec !== bRec) return aRec - bRec
      return a.price - b.price
    })
  },

  /** §"Angebotsgültigkeit": reiner Zeitvergleich, keine Netzwerkabfrage -- UI nutzt dies, um abgelaufene Angebote sichtbar zu entwerten, statt einen veralteten Cache-Preis stillschweigend als aktuell zu zeigen. */
  isExpired(option: FlightSearchOption, now: Date = new Date()): boolean {
    return new Date(option.expiresAt) < now
  },
}
