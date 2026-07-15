/**
 * Gemeinsame Typen für die Flug-Engine -- von Provider-Schicht
 * (`lib/providers/flights-provider.ts`), Scoring-Service
 * (`lib/flight-scoring-service.ts`), KI-Schicht (`lib/flight-advisor-ai.ts`),
 * Server Action (`lib/actions/flight-search.ts`) und UI (Ideen-Detailseite,
 * später weitere Konsumenten) genutzt -- keine doppelte Typdefinition.
 */

/** Ein Eintrag pro Reisendem (gleiche Reihenfolge wie `passengerAges`) -- NIE nur ein Passagier/Segment als repräsentativ angenommen. `unknown` = Daten fehlen/uneindeutig, wird NIE stillschweigend als "kein Gepäck" gewertet. */
export type BaggageEntryStatus = 'included' | 'excluded' | 'unknown'

export type FlightSegment = {
  /** §"Tatsächlicher Operating Carrier": bewusst der Operating Carrier je Segment (kann bei Codeshares vom Marketing Carrier abweichen), nie der Marketing Carrier. */
  carrierCode: string
  carrierName: string | null
  flightNumber: string
  departureAirport: string
  departureTime: string
  arrivalAirport: string
  arrivalTime: string
  durationMinutes: number
  checkedBaggageByPassenger: BaggageEntryStatus[]
}

export type FlightItinerary = {
  segments: FlightSegment[]
  durationMinutes: number
  stopCount: number
}

/** Deterministisch aus ALLEN `checkedBaggageByPassenger`-Einträgen aller Segmente/Slices berechnet (siehe FlightScoringService.deriveBaggageStatus) -- nie geraten, nie nur aus einem Passagier/Segment abgeleitet. */
export type CheckedBaggageStatus = 'included' | 'partial' | 'none' | 'not_verified'

export type FlightBadge = 'lumi_empfehlung' | 'preis_leistung' | 'schnellste' | 'direktflug' | 'gepaeck_inklusive'

export type FlightSearchOption = {
  /** Provider-Angebots-ID -- einziger Rückabgleichs-Schlüssel für die KI-Begründung, nie selbst erfunden. */
  id: string
  /** §"Mehrere Abflughäfen vorbereiten": welcher der (aktuell einen) Abflughäfen dieses Angebot nutzt. */
  originCode: string
  outbound: FlightItinerary
  inbound: FlightItinerary | null
  totalDurationMinutes: number
  maxStopCount: number
  price: number
  currency: string
  /** §"Angebotsgültigkeit": ISO-8601, direkt von Duffel (`offer.expires_at`, typischerweise 15-30 Min. gültig) -- nie selbst berechnet/geschätzt. */
  expiresAt: string
  checkedBaggageStatus: CheckedBaggageStatus
  /** Ausschließlich vom FlightScoringService gesetzt -- nie vom Provider, nie in der UI berechnet. */
  badges: FlightBadge[]
  /** Ausschließlich vom FlightScoringService gesetzt (z. B. "+180 € gegenüber günstigster Verbindung") -- nie in der UI berechnet. Nur bei "lumi_empfehlung" befüllt. */
  comparisonHints: string[]
  /** Ausschließlich von der KI-Schicht gesetzt (Begründung, keine Zahlen) -- `null`, solange keine KI-Begründung vorliegt/verfügbar war. */
  aiReasoning: string | null
}

export type FlightSearchResult = {
  options: FlightSearchOption[]
  isSandboxData: boolean
  searchedAt: string
}
