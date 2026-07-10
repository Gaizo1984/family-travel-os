/**
 * Statisches, kuratiertes Wissen für Discover — bewusst KEIN Live-Wetter-
 * oder Flugpreis-Anschluss, keine externe API. Wird von lib/discover-scoring.ts
 * gegen die Familien-Travel-DNA gescored (rein deterministisch, kein KI-Aufruf).
 */

export type MoodKey =
  | 'ende_der_welt' | 'besonderes_hotel' | 'natur_kinder'
  | 'meer_pur' | 'kultur_ohne_pflicht' | 'grosse_reise'

export const MOOD_OPTIONS: Array<{ key: MoodKey; label: string; sub: string }> = [
  { key: 'ende_der_welt', label: 'Ans Ende der Welt', sub: 'Weit weg. Wirklich weg.' },
  { key: 'besonderes_hotel', label: 'Ein besonderes Hotel', sub: 'Das Hotel ist das Erlebnis.' },
  { key: 'natur_kinder', label: 'Natur, die Kinder nicht vergessen', sub: 'Tiere, Weite, echte Eindrücke.' },
  { key: 'meer_pur', label: 'Meer und sonst nichts', sub: 'Ankommen. Bleiben. Genießen.' },
  { key: 'kultur_ohne_pflicht', label: 'Kultur ohne Pflichtprogramm', sub: 'Verstehen statt abhaken.' },
  { key: 'grosse_reise', label: 'Große Reise mit mehreren Kapiteln', sub: 'Eine Route, die erzählt.' },
]

export type SeasonWindowKey = 'herbstferien_2028' | 'sommerferien_2029' | 'kurzfristig'

export const SEASON_WINDOW_OPTIONS: Array<{ key: SeasonWindowKey; label: string; sub: string; months: string[] | null }> = [
  { key: 'herbstferien_2028', label: 'Herbstferien 2028', sub: 'Warm, besonders, etwa zwei Wochen', months: ['Oktober', 'November'] },
  { key: 'sommerferien_2029', label: 'Sommerferien 2029', sub: 'Große Reise, wenn ihr mehr Zeit habt', months: ['Juli', 'August'] },
  { key: 'kurzfristig', label: 'Kurzfristig', sub: 'Eine Woche raus, ohne zu viel Planung', months: null },
]

export type Pace = 'entspannt' | 'gemischt' | 'aktiv'

export type Destination = {
  id: string
  name: string
  tags: string
  feel: string
  photo: string
  bestSeasonMonths: string[] | null // null = ganzjährig geeignet
  moods: MoodKey[]
  pace: Pace
  minAgeHint: number
  hotelStyleTags: string[] // Schlüssel aus lib/family-dna.ts HOTEL_CRITERIA_OPTIONS
  watchOut?: string
}

const P = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const DESTINATIONS: Destination[] = [
  {
    id: 'oman', name: 'Oman', tags: 'Wüste · Berge · Meer',
    feel: 'Wüste, Berge und Meer – mit wenig Zeitverschiebung.',
    photo: P('photo-1707720733106-803bb0808363'),
    bestSeasonMonths: ['Oktober', 'November', 'Dezember', 'Januar', 'Februar', 'März'],
    moods: ['ende_der_welt', 'besonderes_hotel'], pace: 'entspannt', minAgeHint: 0,
    hotelStyleTags: ['naturintegration', 'architektur_design', 'lage'],
    watchOut: 'Hitze im Sommer – Oktober bis März ideal.',
  },
  {
    id: 'costa-rica', name: 'Costa Rica', tags: 'Natur · Tiere · Familienrhythmus',
    feel: 'Natur, Tiere und ein Familienrhythmus, der funktioniert.',
    photo: P('photo-1611222566512-cb8dd8e689e5'),
    bestSeasonMonths: ['Dezember', 'Januar', 'Februar', 'März', 'April'],
    moods: ['natur_kinder', 'grosse_reise'], pace: 'gemischt', minAgeHint: 0,
    hotelStyleTags: ['naturintegration', 'pool_strand'],
    watchOut: 'Regenzeit bis November – Timing wichtig.',
  },
  {
    id: 'seychellen', name: 'Seychellen', tags: 'Inseln · Natur · Meer',
    feel: 'Wenig Programm. Viel gemeinsames Erleben.',
    photo: P('photo-1742664142349-cff27bcdbcfd'),
    bestSeasonMonths: null,
    moods: ['meer_pur', 'besonderes_hotel'], pace: 'entspannt', minAgeHint: 0,
    hotelStyleTags: ['privatsphaere', 'pool_strand', 'naturintegration'],
    watchOut: 'Sehr begrenzte Direktflüge aus Deutschland.',
  },
  {
    id: 'japan-okinawa', name: 'Japan & Okinawa', tags: 'Kultur · Küste · Komfort',
    feel: 'Eine andere Welt mit Komfort und Strandabschluss.',
    photo: P('photo-1558870832-c8db4b5b47d1'),
    bestSeasonMonths: ['März', 'April', 'Oktober', 'November'],
    moods: ['kultur_ohne_pflicht', 'meer_pur'], pace: 'aktiv', minAgeHint: 4,
    hotelStyleTags: ['architektur_design', 'service'],
    watchOut: 'Lange Flugzeit — für sehr junge Kinder anstrengend.',
  },
  {
    id: 'sri-lanka', name: 'Sri Lanka', tags: 'Natur · Tiere · Kultur · Strand',
    feel: 'Mehr Abwechslung und Abenteuer – mit bewusst ruhiger Route.',
    photo: P('photo-1519566335946-e6f65f0f4fdf'),
    bestSeasonMonths: ['Januar', 'Februar', 'März', 'Oktober'],
    moods: ['natur_kinder', 'kultur_ohne_pflicht'], pace: 'gemischt', minAgeHint: 2,
    hotelStyleTags: ['naturintegration', 'charakter_statt_kette'],
  },
  {
    id: 'malediven', name: 'Malediven', tags: 'Inseln · Wasser · Ruhe',
    feel: 'Ein Wasserbungalow, ein Riff, sonst nichts.',
    photo: P('photo-1590523277543-a94d2e4eb00b'),
    bestSeasonMonths: ['Dezember', 'Januar', 'Februar', 'März', 'April'],
    moods: ['meer_pur', 'besonderes_hotel'], pace: 'entspannt', minAgeHint: 0,
    hotelStyleTags: ['privatsphaere', 'pool_strand', 'lage'],
  },
  {
    id: 'suedafrika', name: 'Südafrika', tags: 'Kap · Safari · Weite',
    feel: 'Eine andere Welt mit Komfort und Strandabschluss.',
    photo: P('photo-1580060839134-75a5edca2e99'),
    bestSeasonMonths: ['Oktober', 'November', 'Dezember', 'Januar', 'Februar', 'März', 'April'],
    moods: ['ende_der_welt', 'grosse_reise', 'natur_kinder'], pace: 'aktiv', minAgeHint: 5,
    hotelStyleTags: ['naturintegration', 'charakter_statt_kette'],
    watchOut: 'Malariagebiete beachten — malariaarme Region wählen.',
  },
  {
    id: 'mauritius', name: 'Mauritius', tags: 'Strand · Inselerlebnis',
    feel: 'Badeurlaub mit dosierten Erlebnissen und kurzen Ausflügen.',
    photo: P('photo-1581129724980-2ab2153c3d8d'),
    bestSeasonMonths: ['Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November'],
    moods: ['meer_pur', 'natur_kinder'], pace: 'entspannt', minAgeHint: 0,
    hotelStyleTags: ['pool_strand', 'service'],
    watchOut: 'Zyklonrisiko Januar–März.',
  },
]
