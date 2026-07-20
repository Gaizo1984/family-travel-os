import type { LucideIcon } from 'lucide-react'
import { Plane, BedDouble, Car, Compass, UtensilsCrossed, TrainFront, Ship, Shield, FileText } from 'lucide-react'
import type { BookingType, BookingStatus, PaymentStatus } from './supabase/types'
import { formatDateDE } from './demo-data'

/** Marker im `notes`-Feld automatisch erzeugter Zwischenstopp-Etappen -- Grundlage für `syncAccommodationIntoStage` (lib/actions/bookings.ts) und von `stages/confirm-stopover` gesetzt. Kein Export aus einer 'use server'-Datei, da nur eine Konstante (keine Server Action). */
export const AUTO_STAGE_NOTE_LAYOVER = 'Automatisch aus Zwischenstopp-Angabe im Flug erzeugt.'

export type DetailField = {
  key: string
  label: string
  placeholder?: string
  /** 'select' rendert ein Dropdown, 'date' ein einzelnes Datumsfeld (DateSelectFields, ohne Uhrzeit). */
  type?: 'text' | 'select' | 'date'
  options?: { value: string; label: string }[]
  /**
   * §Vereinfachte Masken (Flug/Hotel/Mietwagen): Felder, die nicht mehr in der
   * sichtbaren Maske stehen, aber aus bereits gespeicherten Buchungen nicht
   * stillschweigend verloren gehen dürfen, werden als verstecktes Feld statt
   * gar nicht gerendert (siehe BookingForm.tsx) -- `visible: false` markiert
   * genau diesen Fall.
   */
  visible?: boolean
  /** Gruppiert Felder für einen gemeinsamen Einklapp-Abschnitt, siehe `collapsibleGroups`. */
  group?: string
}

/** Steuert, ob die generischen Standardfelder (jenseits von Titel/Preis/Datum) sichtbar sind. */
export type BookingVisibleFields = {
  bookingReference: boolean
  status: boolean
  paymentStatus: boolean
  notes: boolean
}

const DEFAULT_VISIBLE_FIELDS: BookingVisibleFields = {
  bookingReference: true, status: true, paymentStatus: true, notes: true,
}

export type BookingTypeConfig = {
  value: BookingType
  label: string
  icon: LucideIcon
  providerLabel: string | null
  titleLabel: string
  titlePlaceholder: string
  /** false = kein Titel-Eingabefeld (Titel wird serverseitig abgeleitet, siehe lib/actions/bookings.ts). */
  showTitleField: boolean
  showEnd: boolean
  startLabel: string
  endLabel: string
  detailFields: DetailField[]
  visibleFields: BookingVisibleFields
  /** Bietet diese Maske den "Daten automatisch auslesen"-Button (OCR über booking-extraction.ts)? */
  supportsExtraction: boolean
  /** Gruppen-Schlüssel (siehe DetailField.group) -> Label des Einklapp-Buttons, z. B. { layover: '+ Zwischenstopp hinzufügen' }. */
  collapsibleGroups?: Record<string, string>
  /** §"Teilnehmerauswahl nur bei Aktivitätsbuchungen" (Nutzervorgabe, wörtlich): nur bei `activity` gesetzt -- steuert den Teilnehmer-Checkbox-Abschnitt in BookingForm.tsx. */
  showParticipants?: boolean
}

/**
 * §Phase B "Zur Reise übernehmen" (Nutzervorgabe): gleiche Form wie die
 * bereits bestehenden lokalen `BookingDraft`/`BookingValues`-Typen in
 * lib/actions/booking-extraction.ts, app/(app)/trips/[id]/bookings/new/page.tsx
 * und BookingForm.tsx (dort bewusst nicht angefasst, um deren bestehendes
 * Verhalten nicht zu riskieren) -- hier als EIN gemeinsamer Typ für die neuen
 * Draft-Erzeuger (buildFlightAdoptionDraft/buildHotelAdoptionDraft), damit
 * die nicht noch eine vierte, leicht abweichende Kopie hinzufügen. `title:
 * null` ist für Flüge unkritisch, da createBooking den Titel für type
 * 'flight' ohnehin serverseitig aus Richtung+Strecke ableitet (siehe
 * readCommonFields) und das Draft-Feld dafür ignoriert.
 */
export type BookingAdoptionDraft = {
  stage_id: string | null; title: string | null; provider: string | null; booking_reference: string | null
  status: string; payment_status: string; amount: number | null; currency: string
  start_datetime: string | null; end_datetime: string | null; notes: string | null
  details: Record<string, string> | null
}

export const BOOKING_TYPE_ORDER: BookingType[] = [
  'flight', 'accommodation', 'transfer', 'rental_car', 'activity',
  'restaurant', 'train', 'ferry', 'insurance', 'other',
]

export type BookingCategory = 'flight' | 'accommodation' | 'activity' | 'more'

export type BookingCategoryConfig = {
  value: BookingCategory
  label: string
  /** Typen, die in dieser Kategorie angezeigt/gefiltert werden (inkl. historischer Bestandsdaten). */
  types: BookingType[]
  /** Typen, die beim Neu-Anlegen aus dieser Kategorie heraus zur Auswahl stehen (kann enger als `types` sein). */
  pickerTypes: BookingType[]
  emptyDetail: string
  addLabel: string
}

export const BOOKING_CATEGORY_ORDER: BookingCategory[] = ['flight', 'accommodation', 'activity', 'more']

export const BOOKING_CATEGORIES: Record<BookingCategory, BookingCategoryConfig> = {
  flight: {
    value: 'flight', label: 'Flüge', types: ['flight'], pickerTypes: ['flight'],
    emptyDetail: 'Noch keine Flüge gebucht', addLabel: 'Flug hinzufügen',
  },
  accommodation: {
    value: 'accommodation', label: 'Hotels', types: ['accommodation'], pickerTypes: ['accommodation'],
    emptyDetail: 'Unterkünfte noch offen', addLabel: 'Unterkunft hinzufügen',
  },
  activity: {
    value: 'activity', label: 'Aktivitäten', types: ['activity', 'restaurant'], pickerTypes: ['activity', 'restaurant'],
    emptyDetail: 'Noch keine Aktivitäten geplant', addLabel: 'Aktivität hinzufügen',
  },
  more: {
    value: 'more', label: 'Mehr',
    // 'insurance' bleibt hier für Filterung/Anzeige, damit bestehende Versicherungsbuchungen
    // sichtbar/bearbeitbar bleiben — steht aber bewusst nicht mehr in pickerTypes (kein Neuanlegen
    // von Versicherungen über "Mehr"; Versicherung bleibt über den universellen Einstieg wählbar).
    types: ['rental_car', 'transfer', 'train', 'ferry', 'insurance', 'other'],
    pickerTypes: ['rental_car', 'transfer', 'train', 'ferry', 'other'],
    emptyDetail: 'Noch keine weiteren Buchungen', addLabel: 'Weitere Buchung hinzufügen',
  },
}

export const BOOKING_TYPE_CONFIG: Record<BookingType, BookingTypeConfig> = {
  flight: {
    value: 'flight', label: 'Flug', icon: Plane,
    providerLabel: 'Airline', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Hinflug Frankfurt – Muscat',
    showTitleField: false,
    showEnd: true, startLabel: 'Abflug', endLabel: 'Landung',
    detailFields: [
      {
        key: 'direction', label: 'Hinflug / Rückflug', type: 'select',
        options: [{ value: 'outbound', label: 'Hinflug' }, { value: 'return', label: 'Rückflug' }],
      },
      { key: 'flight_number', label: 'Flugnummer', placeholder: 'z. B. EK052' },
      { key: 'from', label: 'Abflughafen', placeholder: 'z. B. FRA' },
      { key: 'to', label: 'Zielflughafen', placeholder: 'z. B. DXB' },
      { key: 'terminal', label: 'Terminal', placeholder: 'optional' },
      { key: 'gate', label: 'Gate', placeholder: 'optional' },
      { key: 'layover_airport', label: 'Zwischenstopp-Flughafen', placeholder: 'z. B. IST', group: 'layover' },
      {
        key: 'layover_overnight', label: 'Übernachtung am Zwischenstopp', type: 'select', group: 'layover',
        options: [{ value: '', label: 'Nein' }, { value: 'ja', label: 'Ja' }],
      },
      { key: 'layover_nights', label: 'Nächte am Zwischenstopp', placeholder: 'z. B. 2', group: 'layover' },
    ],
    visibleFields: { bookingReference: false, status: false, paymentStatus: false, notes: false },
    supportsExtraction: true,
    collapsibleGroups: { layover: '+ Zwischenstopp hinzufügen' },
  },
  accommodation: {
    value: 'accommodation', label: 'Hotel / Unterkunft', icon: BedDouble,
    providerLabel: null, titleLabel: 'Hotelname', titlePlaceholder: 'z. B. Atlantis The Palm',
    showTitleField: true,
    showEnd: true, startLabel: 'Check-in', endLabel: 'Check-out',
    detailFields: [
      { key: 'location', label: 'Ort', placeholder: 'z. B. Dubai' },
      { key: 'room_info', label: 'Zimmer / Tarif', placeholder: 'optional', visible: false },
    ],
    visibleFields: { bookingReference: true, status: false, paymentStatus: false, notes: false },
    supportsExtraction: true,
  },
  transfer: {
    value: 'transfer', label: 'Transfer', icon: Car,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Flughafentransfer',
    showTitleField: true,
    showEnd: true, startLabel: 'Abholung', endLabel: 'Ankunft',
    detailFields: [
      { key: 'from', label: 'Abholort', placeholder: 'z. B. Flughafen Dubai' },
      { key: 'to', label: 'Zielort', placeholder: 'z. B. Hotel' },
    ],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
  },
  rental_car: {
    value: 'rental_car', label: 'Mietwagen', icon: Car,
    providerLabel: null, titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Mietwagen SUV',
    showTitleField: true,
    showEnd: true, startLabel: 'Abholung', endLabel: 'Rückgabe',
    detailFields: [
      { key: 'pickup_location', label: 'Abholort', placeholder: 'z. B. Flughafen Muscat', visible: false },
      { key: 'dropoff_location', label: 'Rückgabeort', placeholder: 'z. B. Flughafen Muscat', visible: false },
    ],
    visibleFields: { bookingReference: false, status: false, paymentStatus: false, notes: false },
    supportsExtraction: true,
  },
  activity: {
    value: 'activity', label: 'Aktivität / Ausflug', icon: Compass,
    providerLabel: 'Anbieter', titleLabel: 'Aktivität', titlePlaceholder: 'z. B. Wüstensafari',
    showTitleField: true,
    showEnd: false, startLabel: 'Datum / Uhrzeit', endLabel: '',
    detailFields: [
      { key: 'meeting_point', label: 'Treffpunkt', placeholder: 'optional' },
    ],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
    showParticipants: true,
  },
  restaurant: {
    value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed,
    providerLabel: null, titleLabel: 'Restaurantname', titlePlaceholder: 'z. B. Al Mahara',
    showTitleField: true,
    showEnd: false, startLabel: 'Datum / Uhrzeit', endLabel: '',
    detailFields: [],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
  },
  train: {
    value: 'train', label: 'Zug / Bahn', icon: TrainFront,
    providerLabel: 'Betreiber', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Zug nach Salzburg',
    showTitleField: true,
    showEnd: true, startLabel: 'Abfahrt', endLabel: 'Ankunft',
    detailFields: [
      { key: 'from', label: 'Start', placeholder: 'z. B. Wien Hbf' },
      { key: 'to', label: 'Ziel', placeholder: 'z. B. Salzburg Hbf' },
    ],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
  },
  ferry: {
    value: 'ferry', label: 'Fähre / Schiff', icon: Ship,
    providerLabel: 'Betreiber', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Fähre nach Sansibar',
    showTitleField: true,
    showEnd: true, startLabel: 'Abfahrt', endLabel: 'Ankunft',
    detailFields: [
      { key: 'from', label: 'Start', placeholder: 'z. B. Dar es Salaam' },
      { key: 'to', label: 'Ziel', placeholder: 'z. B. Stone Town' },
    ],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
  },
  insurance: {
    value: 'insurance', label: 'Versicherung', icon: Shield,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Reiseversicherung',
    showTitleField: true,
    showEnd: true, startLabel: 'Gültig ab', endLabel: 'Gültig bis',
    detailFields: [],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
  },
  other: {
    value: 'other', label: 'Sonstiges', icon: FileText,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Sonstige Buchung',
    showTitleField: true,
    showEnd: true, startLabel: 'Von', endLabel: 'Bis',
    detailFields: [],
    visibleFields: DEFAULT_VISIBLE_FIELDS,
    supportsExtraction: false,
  },
}

export const BOOKING_STATUS_ORDER: BookingStatus[] = ['pending', 'reserved', 'confirmed', 'cancelled']

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Angefragt',
  reserved: 'Reserviert',
  confirmed: 'Bestätigt',
  cancelled: 'Storniert',
}

export const PAYMENT_STATUS_ORDER: PaymentStatus[] = ['unpaid', 'partial', 'paid', 'refunded']

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Offen',
  partial: 'Teilweise bezahlt',
  paid: 'Bezahlt',
  refunded: 'Erstattet',
}

export function sortBookingsChronologically<T extends { start_datetime: string | null; created_at: string }>(
  bookings: T[],
): T[] {
  return [...bookings].sort((a, b) => {
    if (a.start_datetime && b.start_datetime) return a.start_datetime.localeCompare(b.start_datetime);
    if (a.start_datetime && !b.start_datetime) return -1;
    if (!a.start_datetime && b.start_datetime) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function combineDateTime(date: string, time: string): string | null {
  if (!date) return null
  return `${date}T${time || '00:00'}:00`
}

export function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const [date, timePart] = iso.split('T')
  const time = timePart ? timePart.slice(0, 5) : ''
  return { date, time: time === '00:00' ? '' : time }
}

/**
 * §"00:00 nur ausblenden, wenn technisch keine echte Uhrzeit gespeichert
 * wurde" (Nutzervorgabe, wörtlich): `combineDateTime`/`splitDateTime` oben
 * etablieren bereits die Konvention, dass eine gespeicherte Uhrzeit von
 * genau "00:00" technisch "keine Uhrzeit eingegeben" bedeutet, nie echte
 * Mitternacht. Einzige Stelle, die das prüft -- von der Journey-Anzeige
 * (JourneyDayCard/journey-events-model) UND vom Tagesplaner (Zeitfenster-
 * Berechnung) geteilt, keine zweite Definition derselben Regel.
 */
export function hasRealTime(time: string | null | undefined): boolean {
  if (!time) return false
  return time.slice(0, 5) !== '00:00'
}

export function formatDateTimeDE(iso: string | null): string {
  if (!iso) return '—'
  const { date, time } = splitDateTime(iso)
  if (!date) return '—'
  return time ? `${formatDateDE(date)} · ${time}` : formatDateDE(date)
}
