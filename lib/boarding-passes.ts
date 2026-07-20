/**
 * Feste Anzeige-Reihenfolge für den Boardingpass-Vollbild-Viewer (§7.1): Marcel,
 * Sarah, Elias, Lia, Lumi — explizite Vorgabe, nicht aus Datenbank-IDs ableitbar
 * (Personen-IDs sind chronologisch nach Anlage vergeben, nicht nach Alter/Rolle).
 * Unbekannte Namen fallen ans Ende, alphabetisch, statt zu verschwinden.
 */
export const FAMILY_BOARDING_PASS_ORDER = ['Marcel', 'Sarah', 'Elias', 'Lia', 'Lumi']

export function sortForBoardingPassViewer<T extends { name: string }>(persons: T[]): T[] {
  return [...persons].sort((a, b) => {
    const ai = FAMILY_BOARDING_PASS_ORDER.indexOf(a.name)
    const bi = FAMILY_BOARDING_PASS_ORDER.indexOf(b.name)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.name.localeCompare(b.name)
  })
}

export type FlightLegOption = { value: string; label: string }

/**
 * §"Bei Flügen mit Zwischenstopp gibt es pro Person 2 Boardingpässe... klar
 * erkenntlich nach Flug trennen" (Nutzervorgabe, wörtlich): erkennt einen
 * Zwischenstopp ausschließlich anhand bereits vorhandener Buchungsdaten
 * (`bookings.details.layover_airport`, siehe lib/saved-flights-shared.ts
 * computeLayoverDetails/lib/bookings.ts) -- kein neues Segment-Datenmodell,
 * keine erfundenen Flughafencodes, falls `from`/`to` nicht vorliegen.
 */
export function detectFlightLegOptions(bookingDetails: Record<string, string> | null | undefined): FlightLegOption[] {
  const layoverAirport = bookingDetails?.layover_airport
  if (!layoverAirport) return []

  const from = bookingDetails?.from
  const to = bookingDetails?.to
  if (from && to) {
    return [
      { value: '1', label: `1. Flug: ${from} → ${layoverAirport}` },
      { value: '2', label: `2. Flug: ${layoverAirport} → ${to}` },
    ]
  }
  return [
    { value: '1', label: '1. Flug' },
    { value: '2', label: '2. Flug' },
  ]
}

/** Kurzbeschriftung für einen bereits hochgeladenen Pass -- `null`, wenn kein Leg gespeichert ist (Altdaten oder Buchung ohne Zwischenstopp). */
export function legLabelFor(leg: string | undefined | null, options: FlightLegOption[]): string | null {
  if (!leg) return null
  return options.find((o) => o.value === leg)?.label ?? `Flugabschnitt ${leg}`
}
