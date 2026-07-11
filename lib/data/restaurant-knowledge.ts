/** Statisches, kuratiertes Restaurant-Wissen fürs Buchungsportal — keine Live-Verfügbarkeit/Reservierung. */

import type { PriceIndicator } from './hotel-knowledge'

const P = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export type CuratedRestaurant = {
  name: string
  destination: string
  cuisine: string
  priceIndicator: PriceIndicator
  mood: string
  photo: string
}

export const RESTAURANTS: CuratedRestaurant[] = [
  {
    name: 'Bait Al Luban', destination: 'Oman', cuisine: 'Omanische Küche',
    priceIndicator: '€€', mood: 'Traditionell, entspannt, sehr familienfreundlich.',
    photo: P('photo-1544025162-d76694265947'),
  },
  {
    name: 'Kalu\'s at Playa Tamarindo', destination: 'Costa Rica', cuisine: 'Frischer Fisch, Ceviche',
    priceIndicator: '€€', mood: 'Direkt am Strand, barfuß-tauglich.',
    photo: P('photo-1544025162-d76694265947'),
  },
  {
    name: 'Marlin Restaurant', destination: 'Seychellen', cuisine: 'Kreolisch, Meeresfrüchte',
    priceIndicator: '€€€', mood: 'Ruhige Bucht, kein Trubel.',
    photo: P('photo-1544025162-d76694265947'),
  },
  {
    name: 'Umikaji Terrace', destination: 'Japan & Okinawa', cuisine: 'Okinawanische Küche',
    priceIndicator: '€€', mood: 'Lässig, Meerblick, viele kleine Stände für Kinder.',
    photo: P('photo-1544025162-d76694265947'),
  },
]
