/** Statisches, kuratiertes Flug-Orientierungswissen fürs Buchungsportal — keine Live-Preise/Verfügbarkeit. */

import type { PriceIndicator } from './hotel-knowledge'

export type CuratedFlightRoute = {
  destinationId: string // Schlüssel aus lib/data/destination-knowledge.ts DESTINATIONS
  route: string
  airlines: string[]
  typicalStopovers: string[]
  priceIndicator: PriceIndicator
  flightTimeHint: string
}

export const FLIGHT_ROUTES: CuratedFlightRoute[] = [
  {
    destinationId: 'oman', route: 'Frankfurt / München → Muscat',
    airlines: ['Oman Air', 'Lufthansa'], typicalStopovers: [],
    priceIndicator: '€€', flightTimeHint: 'ca. 6-7 Std. Direktflug',
  },
  {
    destinationId: 'costa-rica', route: 'Frankfurt → San José',
    airlines: ['Edelweiss', 'Iberia', 'KLM'], typicalStopovers: ['Madrid', 'Amsterdam'],
    priceIndicator: '€€', flightTimeHint: 'ca. 13-15 Std. inkl. Umstieg',
  },
  {
    destinationId: 'seychellen', route: 'Frankfurt → Mahé',
    airlines: ['Qatar Airways', 'Emirates', 'Condor'], typicalStopovers: ['Doha', 'Dubai'],
    priceIndicator: '€€€', flightTimeHint: 'ca. 11-13 Std. inkl. Umstieg',
  },
  {
    destinationId: 'japan-okinawa', route: 'Frankfurt/München → Tokio → Okinawa',
    airlines: ['ANA', 'Lufthansa', 'JAL'], typicalStopovers: ['Tokio'],
    priceIndicator: '€€€', flightTimeHint: 'ca. 14-16 Std. inkl. Inlandsflug',
  },
  {
    destinationId: 'sri-lanka', route: 'Frankfurt/München → Colombo',
    airlines: ['SriLankan Airlines', 'Qatar Airways'], typicalStopovers: ['Doha'],
    priceIndicator: '€€', flightTimeHint: 'ca. 10-12 Std. inkl. Umstieg',
  },
  {
    destinationId: 'malediven', route: 'Frankfurt/München → Malé',
    airlines: ['Condor', 'Emirates', 'Qatar Airways'], typicalStopovers: ['Dubai', 'Doha'],
    priceIndicator: '€€', flightTimeHint: 'ca. 9-12 Std., teils Direktflug',
  },
  {
    destinationId: 'suedafrika', route: 'Frankfurt/München → Kapstadt',
    airlines: ['Lufthansa', 'Condor'], typicalStopovers: [],
    priceIndicator: '€€', flightTimeHint: 'ca. 11 Std. Direktflug',
  },
  {
    destinationId: 'mauritius', route: 'Frankfurt/München → Mauritius',
    airlines: ['Condor', 'Air Mauritius', 'Emirates'], typicalStopovers: ['Dubai'],
    priceIndicator: '€€', flightTimeHint: 'ca. 11-13 Std., teils Direktflug',
  },
]
