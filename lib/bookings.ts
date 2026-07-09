import type { LucideIcon } from 'lucide-react'
import { Plane, BedDouble, Car, Compass, UtensilsCrossed, TrainFront, Ship, Shield, FileText } from 'lucide-react'
import type { BookingType, BookingStatus, PaymentStatus } from './supabase/types'
import { formatDateDE } from './demo-data'

export type DetailField = {
  key: string
  label: string
  placeholder?: string
}

export type BookingTypeConfig = {
  value: BookingType
  label: string
  icon: LucideIcon
  providerLabel: string | null
  titleLabel: string
  titlePlaceholder: string
  showEnd: boolean
  startLabel: string
  endLabel: string
  detailFields: DetailField[]
}

export const BOOKING_TYPE_ORDER: BookingType[] = [
  'flight', 'accommodation', 'transfer', 'rental_car', 'activity',
  'restaurant', 'train', 'ferry', 'insurance', 'other',
]

export type BookingCategory = 'flight' | 'accommodation' | 'activity' | 'more'

export type BookingCategoryConfig = {
  value: BookingCategory
  label: string
  types: BookingType[]
  emptyDetail: string
  addLabel: string
}

export const BOOKING_CATEGORY_ORDER: BookingCategory[] = ['flight', 'accommodation', 'activity', 'more']

export const BOOKING_CATEGORIES: Record<BookingCategory, BookingCategoryConfig> = {
  flight: {
    value: 'flight', label: 'Flüge', types: ['flight'],
    emptyDetail: 'Noch keine Flüge gebucht', addLabel: 'Flug hinzufügen',
  },
  accommodation: {
    value: 'accommodation', label: 'Hotels', types: ['accommodation'],
    emptyDetail: 'Unterkünfte noch offen', addLabel: 'Unterkunft hinzufügen',
  },
  activity: {
    value: 'activity', label: 'Aktivitäten', types: ['activity', 'restaurant'],
    emptyDetail: 'Noch keine Aktivitäten geplant', addLabel: 'Aktivität hinzufügen',
  },
  more: {
    value: 'more', label: 'Mehr', types: ['rental_car', 'transfer', 'train', 'ferry', 'insurance', 'other'],
    emptyDetail: 'Noch keine weiteren Buchungen', addLabel: 'Weitere Buchung hinzufügen',
  },
}

export const BOOKING_TYPE_CONFIG: Record<BookingType, BookingTypeConfig> = {
  flight: {
    value: 'flight', label: 'Flug', icon: Plane,
    providerLabel: 'Airline', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Hinflug Frankfurt – Muscat',
    showEnd: true, startLabel: 'Abflug', endLabel: 'Ankunft',
    detailFields: [
      { key: 'flight_number', label: 'Flugnummer', placeholder: 'z. B. EK052' },
      { key: 'from', label: 'Abflughafen', placeholder: 'z. B. FRA' },
      { key: 'to', label: 'Zielflughafen', placeholder: 'z. B. DXB' },
    ],
  },
  accommodation: {
    value: 'accommodation', label: 'Hotel / Unterkunft', icon: BedDouble,
    providerLabel: 'Anbieter', titleLabel: 'Unterkunftsname', titlePlaceholder: 'z. B. Atlantis The Palm',
    showEnd: true, startLabel: 'Check-in', endLabel: 'Check-out',
    detailFields: [
      { key: 'room_info', label: 'Zimmer / Tarif', placeholder: 'optional' },
    ],
  },
  transfer: {
    value: 'transfer', label: 'Transfer', icon: Car,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Flughafentransfer',
    showEnd: false, startLabel: 'Abholzeit', endLabel: '',
    detailFields: [
      { key: 'from', label: 'Abholort', placeholder: 'z. B. Flughafen Dubai' },
      { key: 'to', label: 'Zielort', placeholder: 'z. B. Hotel' },
    ],
  },
  rental_car: {
    value: 'rental_car', label: 'Mietwagen', icon: Car,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Mietwagen SUV',
    showEnd: true, startLabel: 'Abholung', endLabel: 'Rückgabe',
    detailFields: [
      { key: 'pickup_location', label: 'Abholort', placeholder: 'z. B. Flughafen Muscat' },
      { key: 'dropoff_location', label: 'Rückgabeort', placeholder: 'z. B. Flughafen Muscat' },
    ],
  },
  activity: {
    value: 'activity', label: 'Aktivität / Ausflug', icon: Compass,
    providerLabel: 'Anbieter', titleLabel: 'Aktivität', titlePlaceholder: 'z. B. Wüstensafari',
    showEnd: false, startLabel: 'Datum / Uhrzeit', endLabel: '',
    detailFields: [
      { key: 'meeting_point', label: 'Treffpunkt', placeholder: 'optional' },
    ],
  },
  restaurant: {
    value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed,
    providerLabel: null, titleLabel: 'Restaurantname', titlePlaceholder: 'z. B. Al Mahara',
    showEnd: false, startLabel: 'Datum / Uhrzeit', endLabel: '',
    detailFields: [],
  },
  train: {
    value: 'train', label: 'Zug / Bahn', icon: TrainFront,
    providerLabel: 'Betreiber', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Zug nach Salzburg',
    showEnd: true, startLabel: 'Abfahrt', endLabel: 'Ankunft',
    detailFields: [
      { key: 'from', label: 'Start', placeholder: 'z. B. Wien Hbf' },
      { key: 'to', label: 'Ziel', placeholder: 'z. B. Salzburg Hbf' },
    ],
  },
  ferry: {
    value: 'ferry', label: 'Fähre / Schiff', icon: Ship,
    providerLabel: 'Betreiber', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Fähre nach Sansibar',
    showEnd: true, startLabel: 'Abfahrt', endLabel: 'Ankunft',
    detailFields: [
      { key: 'from', label: 'Start', placeholder: 'z. B. Dar es Salaam' },
      { key: 'to', label: 'Ziel', placeholder: 'z. B. Stone Town' },
    ],
  },
  insurance: {
    value: 'insurance', label: 'Versicherung', icon: Shield,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Reiseversicherung',
    showEnd: true, startLabel: 'Gültig ab', endLabel: 'Gültig bis',
    detailFields: [],
  },
  other: {
    value: 'other', label: 'Sonstiges', icon: FileText,
    providerLabel: 'Anbieter', titleLabel: 'Titel / Bezeichnung', titlePlaceholder: 'z. B. Sonstige Buchung',
    showEnd: true, startLabel: 'Von', endLabel: 'Bis',
    detailFields: [],
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

export function formatDateTimeDE(iso: string | null): string {
  if (!iso) return '—'
  const { date, time } = splitDateTime(iso)
  if (!date) return '—'
  return time ? `${formatDateDE(date)} · ${time}` : formatDateDE(date)
}
