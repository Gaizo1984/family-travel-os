/** Statisches, kuratiertes Hotel-Wissen für Discover — keine Live-Preise/Verfügbarkeit. */

const P = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export type PriceIndicator = '€' | '€€' | '€€€'

export type CuratedHotel = {
  name: string
  destination: string
  mood: string
  photo: string
  hotelStyleTags: string[] // Schlüssel aus lib/family-dna.ts HOTEL_CRITERIA_OPTIONS
  priceIndicator: PriceIndicator
  highlights: string[]
}

/**
 * §"Keine doppelte Sortierlogik": von `/discover/hotels` UND der "Besondere
 * Hotels"-Sektion auf `/discover` genutzt -- Hotels, deren `hotelStyleTags`
 * am meisten mit den Familien-Kriterien übereinstimmen, zuerst.
 */
export function sortHotelsByFamilyCriteria(hotels: CuratedHotel[], criteria: Set<string>): CuratedHotel[] {
  return [...hotels].sort((a, b) => {
    const scoreA = a.hotelStyleTags.filter((t) => criteria.has(t)).length
    const scoreB = b.hotelStyleTags.filter((t) => criteria.has(t)).length
    return scoreB - scoreA
  })
}

export const HOTELS: CuratedHotel[] = [
  {
    name: 'Nihi Sumba', destination: 'Indonesien',
    mood: 'Wenn das Hotel selbst das Erlebnis ist.',
    photo: P('photo-1598959626848-a16d4d0b2564'),
    hotelStyleTags: ['naturintegration', 'privatsphaere', 'charakter_statt_kette'],
    priceIndicator: '€€€',
    highlights: ['Privater Strandabschnitt', 'Reitausflüge', 'Nur wenige Villen'],
  },
  {
    name: 'The Chedi Muscat', destination: 'Oman',
    mood: 'Ruhe, Architektur und Ankommen.',
    photo: P('photo-1778655504565-5d70f77212cd'),
    hotelStyleTags: ['architektur_design', 'service', 'lage'],
    priceIndicator: '€€',
    highlights: ['Größter Pool des Nahen Ostens', 'Ruhige Lage am Golf', 'Sehr kinderfreundlicher Service'],
  },
  {
    name: 'One&Only Mandarina', destination: 'Mexiko',
    mood: 'Dschungel, Meer und dieses Gefühl von Wegsein.',
    photo: P('photo-1611222566512-cb8dd8e689e5'),
    hotelStyleTags: ['naturintegration', 'lage', 'grosszuegige_zimmer'],
    priceIndicator: '€€€',
    highlights: ['Villen im Baumkronen-Niveau', 'Eigener Strandclub', 'Weitläufiges Gelände'],
  },
  {
    name: 'Six Senses Zighy Bay', destination: 'Oman',
    mood: 'Spektakulär – aber nicht für jede Route sinnvoll.',
    photo: P('photo-1707720733106-803bb0808363'),
    hotelStyleTags: ['lage', 'privatsphaere', 'naturintegration'],
    priceIndicator: '€€€',
    highlights: ['Zufahrt per Gleitschirm oder Serpentine', 'Eigene Bucht', 'Sehr abgeschieden'],
  },
]
