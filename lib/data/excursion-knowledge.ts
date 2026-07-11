/** Statisches, kuratiertes Ausflugs-/Aktivitäten-Wissen fürs Buchungsportal — keine Live-Verfügbarkeit/Preise. */

import type { PriceIndicator } from './hotel-knowledge'

const P = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export type CuratedExcursion = {
  name: string
  destination: string
  description: string
  priceIndicator: PriceIndicator
  mood: string
  photo: string
}

export const EXCURSIONS: CuratedExcursion[] = [
  {
    name: 'Wüstensafari & Übernachtung im Camp', destination: 'Oman',
    description: 'Dünenfahrt, Sonnenuntergang über der Wahiba-Wüste, Nacht im Beduinencamp mit Sternenhimmel.',
    priceIndicator: '€€', mood: 'Abenteuer mit Komfort — für die ganze Familie geeignet.',
    photo: P('photo-1707720733106-803bb0808363'),
  },
  {
    name: 'Regenwald-Zipline & Vulkanwanderung', destination: 'Costa Rica',
    description: 'Baumkronen-Zipline durch den Nebelwald, anschließend leichte Wanderung zu einem aktiven Vulkan.',
    priceIndicator: '€€', mood: 'Aktiv und naturnah — auch mit älteren Kindern gut machbar.',
    photo: P('photo-1611222566512-cb8dd8e689e5'),
  },
  {
    name: 'Inselhopping mit Schnorcheltour', destination: 'Seychellen',
    description: 'Bootstour zu mehreren Inseln, Schnorcheln über Korallenriffen, Picknick am menschenleeren Strand.',
    priceIndicator: '€€€', mood: 'Ruhig und maritim — wenig Programm, viel Wasser.',
    photo: P('photo-1742664142349-cff27bcdbcfd'),
  },
  {
    name: 'Kochkurs mit lokaler Familie', destination: 'Japan & Okinawa',
    description: 'Gemeinsames Einkaufen auf dem Markt, anschließend Kochkurs zu Hause bei einer Gastfamilie.',
    priceIndicator: '€', mood: 'Kulturell und persönlich — ideal für neugierige Kinder.',
    photo: P('photo-1558870832-c8db4b5b47d1'),
  },
  {
    name: 'Elefanten-Beobachtung & Teeplantage', destination: 'Sri Lanka',
    description: 'Vormittags Elefanten aus sicherer Distanz im Nationalpark beobachten, nachmittags Teeplantage besuchen.',
    priceIndicator: '€€', mood: 'Entspannt und lehrreich — gutes Tempo für gemischte Altersgruppen.',
    photo: P('photo-1519566335946-e6f65f0f4fdf'),
  },
  {
    name: 'Sonnenuntergangs-Fahrt mit dem Dhoni-Boot', destination: 'Malediven',
    description: 'Traditionelles Boot bei Sonnenuntergang, oft mit Delfinsichtung, direkt vom Hotelsteg.',
    priceIndicator: '€€', mood: 'Ruhig und romantisch — auch mit kleinen Kindern gut möglich.',
    photo: P('photo-1590523277543-a94d2e4eb00b'),
  },
  {
    name: 'Halbtagssafari im Krüger-Umland', destination: 'Südafrika',
    description: 'Früher Start, Pirschfahrt im offenen Geländewagen mit erfahrenem Ranger, Frühstück im Busch.',
    priceIndicator: '€€€', mood: 'Aufregend und authentisch — Highlight der Reise für die meisten Familien.',
    photo: P('photo-1580060839134-75a5edca2e99'),
  },
  {
    name: 'Katamaran-Ausflug zur Île aux Cerfs', destination: 'Mauritius',
    description: 'Katamaranfahrt mit Wasserfall-Zwischenstopp, Mittagessen an Bord, Baden an der Trauminsel.',
    priceIndicator: '€€', mood: 'Fröhlich und unkompliziert — beliebt bei Familien mit Kindern jeden Alters.',
    photo: P('photo-1581129724980-2ab2153c3d8d'),
  },
]
