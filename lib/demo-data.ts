export type TripStatus = 'planned' | 'active' | 'completed';

export interface FamilyMember {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Stage {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  nights: number;
  accommodation?: string;
  notes?: string;
}

export interface Flight {
  id: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  airline: string;
  flightNumber: string;
  bookingRef: string;
}

export interface PackingItem {
  id: string;
  label: string;
  category: string;
  isPacked: boolean;
}

export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  location: string;
}

export interface Trip {
  id: string;
  title: string;
  subtitle: string;
  status: TripStatus;
  startDate: string;
  endDate: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  coverEmoji: string;
  members: FamilyMember[];
  stages: Stage[];
  flights: Flight[];
  packingItems: PackingItem[];
  diaryEntries: DiaryEntry[];
}

export const FAMILY_MEMBERS: FamilyMember[] = [
  { id: 'm1', name: 'Marcel',  initials: 'MA', color: '#3B82F6' },
  { id: 'm2', name: 'Sarah',   initials: 'SA', color: '#EC4899' },
  { id: 'm3', name: 'Lia',     initials: 'LI', color: '#F59E0B' },
  { id: 'm4', name: 'Elias',   initials: 'EL', color: '#10B981' },
  { id: 'm5', name: 'Lumi',    initials: 'LU', color: '#8B5CF6' },
];

export const TRIPS: Trip[] = [
  {
    id: 'costa-rica-2026',
    title: 'Costa Rica 2026',
    subtitle: 'Guanacaste · La Fortuna · Osa Peninsula',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    gradientFrom: '#064e3b',
    gradientVia: '#065f46',
    gradientTo: '#047857',
    coverEmoji: '🌿',
    members: FAMILY_MEMBERS,
    stages: [
      {
        id: 'cr-s1',
        title: 'Guanacaste',
        location: 'Guanacaste, Costa Rica',
        startDate: '2026-07-01',
        endDate: '2026-07-06',
        nights: 5,
        accommodation: 'Westin Reserva Conchal',
        notes: 'Strand, Natur, Entspannung',
      },
      {
        id: 'cr-s2',
        title: 'La Fortuna',
        location: 'La Fortuna, Costa Rica',
        startDate: '2026-07-06',
        endDate: '2026-07-10',
        nights: 4,
        accommodation: 'Nayara Springs',
        notes: 'Arenal Vulkan, Wasserfall, Hängebrücken',
      },
      {
        id: 'cr-s3',
        title: 'Osa Peninsula',
        location: 'Osa Peninsula, Costa Rica',
        startDate: '2026-07-10',
        endDate: '2026-07-15',
        nights: 5,
        accommodation: 'Lapa Rios Lodge',
        notes: 'Regenwald, Tiere, Strand',
      },
    ],
    flights: [
      {
        id: 'cr-f1',
        from: 'FRA',
        to: 'SJO',
        departure: '2026-06-30T22:00',
        arrival: '2026-07-01T06:30',
        airline: 'Condor',
        flightNumber: 'DE2011',
        bookingRef: 'CRFAM26',
      },
    ],
    packingItems: [
      { id: 'cr-p1', label: 'Reisepass (gültig bis 2030)', category: 'Dokumente', isPacked: true },
      { id: 'cr-p2', label: 'Impfnachweis', category: 'Dokumente', isPacked: true },
      { id: 'cr-p3', label: 'Sonnencreme SPF 50+', category: 'Pflege', isPacked: true },
      { id: 'cr-p4', label: 'Moskito-Repellent', category: 'Pflege', isPacked: true },
      { id: 'cr-p5', label: 'Fernglas für Tierbeoachtung', category: 'Ausrüstung', isPacked: false },
    ],
    diaryEntries: [],
  },
  {
    id: 'indonesien-2028',
    title: 'Indonesien 2028',
    subtitle: 'Dubai · Bali · Sumba · Ubud',
    status: 'planned',
    startDate: '2028-07-15',
    endDate: '2028-07-30',
    gradientFrom: '#064e3b',
    gradientVia: '#0f766e',
    gradientTo: '#0891b2',
    coverEmoji: '🌴',
    members: FAMILY_MEMBERS,
    stages: [
      { id: 's1', title: 'Dubai',  location: 'Dubai, UAE',           startDate: '2028-07-15', endDate: '2028-07-17', nights: 2, accommodation: 'Atlantis The Palm',   notes: 'Stopover — Burj Khalifa & Dubai Mall' },
      { id: 's2', title: 'Bali',   location: 'Bali, Indonesien',     startDate: '2028-07-17', endDate: '2028-07-22', nights: 5, accommodation: 'Alaya Resort Ubud',    notes: 'Strand, Reisterrassen, Tanah Lot Tempel' },
      { id: 's3', title: 'Sumba',  location: 'Sumba, Indonesien',    startDate: '2028-07-22', endDate: '2028-07-25', nights: 3, accommodation: 'Nihi Sumba',           notes: 'Surfen, Waingarpu Wasserfall, Pferde' },
      { id: 's4', title: 'Ubud',   location: 'Ubud, Bali',           startDate: '2028-07-25', endDate: '2028-07-29', nights: 4, accommodation: 'Four Seasons Sayan',   notes: 'Reisfelder, Kochen, Yoga, Affenwald' },
      { id: 's5', title: 'Dubai',  location: 'Dubai, UAE',           startDate: '2028-07-29', endDate: '2028-07-30', nights: 1, accommodation: 'Marriott Downtown',     notes: 'Rückreise-Stopp' },
    ],
    flights: [
      { id: 'f1', from: 'FRA', to: 'DXB', departure: '2028-07-15T06:30', arrival: '2028-07-15T14:45', airline: 'Emirates', flightNumber: 'EK052', bookingRef: 'EMI7G3' },
      { id: 'f2', from: 'DXB', to: 'DPS', departure: '2028-07-17T02:00', arrival: '2028-07-17T14:30', airline: 'Emirates', flightNumber: 'EK368', bookingRef: 'EMI7G3' },
      { id: 'f3', from: 'DPS', to: 'FRA', departure: '2028-07-30T01:15', arrival: '2028-07-30T08:45', airline: 'Emirates', flightNumber: 'EK369', bookingRef: 'EMI7G3' },
    ],
    packingItems: [
      { id: 'p1',  label: 'Reisepass (gültig bis 2030)',    category: 'Dokumente',  isPacked: true  },
      { id: 'p2',  label: 'Krankenversicherungskarte',      category: 'Dokumente',  isPacked: true  },
      { id: 'p3',  label: 'Visabestätigung Indonesien',     category: 'Dokumente',  isPacked: false },
      { id: 'p4',  label: 'Sonnencreme SPF 50+ (2x)',       category: 'Pflege',     isPacked: true  },
      { id: 'p5',  label: 'Moskito-Repellent',              category: 'Pflege',     isPacked: false },
      { id: 'p6',  label: 'Schnorchel-Set',                 category: 'Sport',      isPacked: false },
      { id: 'p7',  label: 'Wasserresistente Kamera',        category: 'Elektronik', isPacked: false },
      { id: 'p8',  label: 'Universal-Adapter',              category: 'Elektronik', isPacked: true  },
      { id: 'p9',  label: 'Leichte Leinenhemden (3x)',      category: 'Kleidung',   isPacked: false },
      { id: 'p10', label: 'Badeanzüge (2x)',                category: 'Kleidung',   isPacked: false },
    ],
    diaryEntries: [],
  },
  {
    id: 'japan-2025',
    title: 'Japan 2025',
    subtitle: 'Tokyo · Kyoto · Osaka',
    status: 'completed',
    startDate: '2025-03-20',
    endDate: '2025-04-05',
    gradientFrom: '#4c0519',
    gradientVia: '#9f1239',
    gradientTo: '#be185d',
    coverEmoji: '🌸',
    members: FAMILY_MEMBERS,
    stages: [
      { id: 's1', title: 'Tokyo', location: 'Tokyo, Japan',  startDate: '2025-03-20', endDate: '2025-03-27', nights: 7, accommodation: 'Park Hyatt Tokyo',              notes: 'Shibuya, Shinjuku, Akihabara, Teamlab Planets' },
      { id: 's2', title: 'Kyoto', location: 'Kyoto, Japan',  startDate: '2025-03-27', endDate: '2025-04-01', nights: 5, accommodation: 'Nishiyama Onsen Keiunkan',      notes: 'Kirschblüten, Fushimi Inari, Gion' },
      { id: 's3', title: 'Osaka', location: 'Osaka, Japan',  startDate: '2025-04-01', endDate: '2025-04-05', nights: 4, accommodation: 'The St. Regis Osaka',           notes: 'Dotonbori, Street Food, Universal Studios Japan' },
    ],
    flights: [],
    packingItems: [],
    diaryEntries: [
      { id: 'd1', date: '2025-03-21', title: 'Ankunft in Shinjuku',           content: 'Nach 11 Stunden Flug endlich angekommen. Die Stadt ist überwältigend — Lichter, Lärm, Energie. Elias wollte sofort zu Don Quijote. Ramen um Mitternacht war die beste Entscheidung.', location: 'Tokyo' },
      { id: 'd2', date: '2025-03-28', title: 'Kirschblüten im Maruyama Park', content: 'Der Park war ein Traum. Hunderte Familien feierten Hanami unter den Bäumen. Lia hat geweint als die ersten Blütenblätter fielen — ich fast auch. Eines der schönsten Dinge, die wir je gesehen haben.', location: 'Kyoto' },
      { id: 'd3', date: '2025-04-02', title: 'Dotonbori Street Food Marathon', content: 'Takoyaki, Okonomiyaki, Kushikatsu, Matcha-Eis. Elias hat 7 verschiedene Gerichte in 2 Stunden probiert. Osaka ist lauter als Times Square aber irgendwie cooler. Absolutes Highlight der Reise.', location: 'Osaka' },
    ],
  },
  {
    id: 'sardinien-2024',
    title: 'Sardinien 2024',
    subtitle: 'Cagliari · Costa Smeralda · Alghero',
    status: 'completed',
    startDate: '2024-08-01',
    endDate: '2024-08-15',
    gradientFrom: '#1e3a5f',
    gradientVia: '#0369a1',
    gradientTo: '#0e7490',
    coverEmoji: '🏖️',
    members: FAMILY_MEMBERS,
    stages: [
      { id: 's1', title: 'Cagliari',       location: 'Cagliari, Sardinien',     startDate: '2024-08-01', endDate: '2024-08-04', nights: 3, accommodation: 'T Hotel Cagliari',      notes: 'Altstadt, Poetto-Strand, Salzteich' },
      { id: 's2', title: 'Costa Smeralda', location: 'Porto Cervo, Sardinien',  startDate: '2024-08-04', endDate: '2024-08-10', nights: 6, accommodation: 'Villa Olga (privat)',    notes: 'Cala di Volpe, Capriccioli, Liscia Ruja' },
      { id: 's3', title: 'Alghero',        location: 'Alghero, Sardinien',      startDate: '2024-08-10', endDate: '2024-08-15', nights: 5, accommodation: 'Hotel El Balear',        notes: 'Altstadt, Capo Caccia, Grotta di Nettuno' },
    ],
    flights: [],
    packingItems: [],
    diaryEntries: [
      { id: 'd1', date: '2024-08-05', title: 'Cala di Volpe — Das türkiseste Wasser der Welt', content: 'Das Wasser ist so türkis, dass wir dachten es wäre ein Filter. Drei Stunden nicht aus dem Meer raus. Bestes Mittagessen ever: Pasta mit frischem Bottarga direkt am Strand.', location: 'Costa Smeralda' },
      { id: 'd2', date: '2024-08-12', title: 'Grotta di Nettuno',                              content: 'Bootfahrt zu den Neptungrotten — unglaublich. Stalaktiten und Stalagmiten in einem riesigen Höhlensystem direkt am Meer. Lia und Elias waren sprachlos.', location: 'Alghero' },
    ],
  },
];

export function getTripById(id: string): Trip | undefined {
  return TRIPS.find(t => t.id === id);
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDateDE(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getTripDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
