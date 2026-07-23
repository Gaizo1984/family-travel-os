import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, IdCard, FileCheck, Stamp, Globe2, Shield, Receipt, FileText, Ticket, Luggage } from 'lucide-react'
import { formatDateDE } from './demo-data'
import { addDaysIso, isoToday } from './date-utils'

export type DocumentType = 'passport' | 'id_card' | 'visa' | 'esta' | 'eta' | 'entry_permit' | 'insurance' | 'booking_document' | 'boarding_pass' | 'baggage_tag' | 'other'

export type DocumentTypeConfig = {
  value: DocumentType
  label: string
  icon: LucideIcon
  numberLabel: string
  /** Reisepass/Personalausweis-artige Felder (Vor-/Nachname, Geburtsdatum) anzeigen. */
  isIdentityType: boolean
  /** Land/Zielgebiet + Genehmigungsdatum + manueller Status (beantragt/genehmigt) anzeigen. */
  isEntryDocumentType: boolean
}

/** Alle bekannten Dokumenttypen — inkl. 'insurance', das nicht mehr in DOCUMENT_TYPE_ORDER wählbar ist. */
export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, DocumentTypeConfig> = {
  passport: {
    value: 'passport', label: 'Reisepass', icon: BadgeCheck, numberLabel: 'Passnummer',
    isIdentityType: true, isEntryDocumentType: false,
  },
  id_card: {
    value: 'id_card', label: 'Personalausweis', icon: IdCard, numberLabel: 'Ausweisnummer',
    isIdentityType: true, isEntryDocumentType: false,
  },
  visa: {
    value: 'visa', label: 'Visum', icon: FileCheck, numberLabel: 'Antrags-/Referenznummer',
    isIdentityType: false, isEntryDocumentType: true,
  },
  esta: {
    value: 'esta', label: 'ESTA', icon: Stamp, numberLabel: 'Antrags-/Referenznummer',
    isIdentityType: false, isEntryDocumentType: true,
  },
  eta: {
    value: 'eta', label: 'eTA', icon: Stamp, numberLabel: 'Antrags-/Referenznummer',
    isIdentityType: false, isEntryDocumentType: true,
  },
  entry_permit: {
    value: 'entry_permit', label: 'Sonstige Einreisegenehmigung', icon: Globe2, numberLabel: 'Antrags-/Referenznummer',
    isIdentityType: false, isEntryDocumentType: true,
  },
  insurance: {
    value: 'insurance', label: 'Versicherung', icon: Shield, numberLabel: 'Policennummer',
    isIdentityType: false, isEntryDocumentType: false,
  },
  booking_document: {
    value: 'booking_document', label: 'Buchungsunterlage', icon: Receipt, numberLabel: 'Referenznummer',
    isIdentityType: false, isEntryDocumentType: false,
  },
  boarding_pass: {
    value: 'boarding_pass', label: 'Boardingpass', icon: Ticket, numberLabel: 'Sitzplatznummer',
    isIdentityType: false, isEntryDocumentType: false,
  },
  baggage_tag: {
    value: 'baggage_tag', label: 'Gepäckbeleg', icon: Luggage, numberLabel: 'Gepäcknummer',
    isIdentityType: false, isEntryDocumentType: false,
  },
  other: {
    value: 'other', label: 'Sonstiges', icon: FileText, numberLabel: 'Nummer',
    isIdentityType: false, isEntryDocumentType: false,
  },
}

/**
 * Auswählbare Typen beim Anlegen eines neuen personenbezogenen Dokuments.
 * 'insurance' bleibt in DOCUMENT_TYPE_CONFIG (Altkompatibilität), ist hier
 * aber bewusst nicht mehr wählbar — zentrale Versicherungen laufen über den
 * eigenen Bereich unter /family/insurance.
 */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'passport', 'id_card', 'visa', 'esta', 'eta', 'entry_permit', 'other',
]

export type DocumentDetails = {
  first_name?: string
  last_name?: string
  birth_date?: string
  gender?: string
  nationality?: string
  birth_place?: string
  passport_number?: string
  issuing_country?: string
  issue_date?: string
  /** Einreisedokumente: "Gültig ab" — eigenständig von issue_date (Genehmigungsdatum). */
  valid_from?: string
  /** Einreisedokumente: im Dokument referenzierte Passnummer (nicht die eigene Antrags-/Referenznummer). */
  related_passport_number?: string
  /** Manueller Status für Einreisedokumente — lässt sich nicht aus Daten ableiten. */
  approval_status?: 'pending' | 'approved'
  source?: 'manual' | 'extracted'
}

export type DocumentValidity = 'valid' | 'expiring_soon' | 'expired' | 'pending' | 'incomplete'
/** @deprecated Nutze DocumentValidity — Alias für bestehende Importe. */
export type PassportValidity = DocumentValidity

export const DOCUMENT_VALIDITY_LABELS: Record<DocumentValidity, string> = {
  valid: 'Gültig',
  expiring_soon: 'Läuft bald ab',
  expired: 'Abgelaufen',
  pending: 'Beantragt / ausstehend',
  incomplete: 'Unvollständig',
}
export const PASSPORT_VALIDITY_LABELS = DOCUMENT_VALIDITY_LABELS

export const DOCUMENT_VALIDITY_COLORS: Record<DocumentValidity, string> = {
  valid: '#4C7A5D',
  expiring_soon: '#B89A5E',
  expired: '#B5624A',
  pending: '#B89A5E',
  incomplete: '#7C7063',
}
export const PASSPORT_VALIDITY_COLORS = DOCUMENT_VALIDITY_COLORS

/** Zentraler Schwellwert für „läuft bald ab" — nicht mehrfach hardcoden. */
export const EXPIRY_WARNING_DAYS = 180

export function getPassportValidity(doc: {
  expires_at: string | null
  details: DocumentDetails | null
}): DocumentValidity {
  if (!doc.details?.passport_number || !doc.expires_at) return 'incomplete'
  const expiresAt = new Date(doc.expires_at)
  const today = new Date()
  const warningDate = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86400000)
  if (expiresAt < today) return 'expired'
  if (expiresAt < warningDate) return 'expiring_soon'
  return 'valid'
}

/** Statuslogik für Visa/ESTA/eTA/Sonstige Einreisegenehmigung. */
export function getEntryDocumentStatus(doc: {
  expires_at: string | null
  details: DocumentDetails | null
}): DocumentValidity {
  if (doc.details?.approval_status === 'pending') return 'pending'
  if (!doc.details?.passport_number || !doc.expires_at) return 'incomplete'
  const expiresAt = new Date(doc.expires_at)
  const today = new Date()
  const warningDate = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86400000)
  if (expiresAt < today) return 'expired'
  if (expiresAt < warningDate) return 'expiring_soon'
  return 'valid'
}

/** Statuslogik speziell für ESTA — kein manueller Status, kein "Gültig ab": wir speichern nur genehmigte ESTAs. */
export function getEstaStatus(doc: {
  expires_at: string | null
  details: DocumentDetails | null
}): DocumentValidity {
  if (!doc.details?.passport_number || !doc.expires_at) return 'incomplete'
  const expiresAt = new Date(doc.expires_at)
  const today = new Date()
  const warningDate = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86400000)
  if (expiresAt < today) return 'expired'
  if (expiresAt < warningDate) return 'expiring_soon'
  return 'valid'
}

export function getDocumentValidity(doc: {
  doc_type: DocumentType
  expires_at: string | null
  details: DocumentDetails | null
}): DocumentValidity | null {
  if (doc.doc_type === 'esta') return getEstaStatus(doc)
  const config = DOCUMENT_TYPE_CONFIG[doc.doc_type]
  if (config.isIdentityType) return getPassportValidity(doc)
  if (config.isEntryDocumentType) return getEntryDocumentStatus(doc)
  return null
}

export function formatExpiresAt(expiresAt: string | null): string {
  return expiresAt ? formatDateDE(expiresAt) : '—'
}

export const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export type DateFieldRange = { minYear: number; maxYear: number }

export function getDateFieldRange(kind: 'birth' | 'issue' | 'expiry' | 'travel'): DateFieldRange {
  const currentYear = new Date().getFullYear()
  if (kind === 'birth') return { minYear: currentYear - 110, maxYear: currentYear }
  if (kind === 'issue') return { minYear: currentYear - 15, maxYear: currentYear }
  if (kind === 'travel') return { minYear: currentYear - 6, maxYear: currentYear + 5 }
  return { minYear: currentYear, maxYear: currentYear + 15 }
}

/**
 * Für Datumsfelder, die an eine konkrete Reise gebunden sind (z. B.
 * Journey-Event-Datum): der Bereich muss den tatsächlichen Reisezeitraum
 * abdecken, auch wenn dieser in der Vergangenheit liegt — anders als
 * `getDateFieldRange('expiry')`, das nur zukünftige Jahre listet und bei
 * vergangenen/laufenden Reisen das gespeicherte Jahr aus der Auswahl fallen
 * lässt (Jahr/Monat erscheinen dann fälschlich leer).
 */
export function getTripDateFieldRange(startDate: string | null, endDate: string | null): DateFieldRange {
  const currentYear = new Date().getFullYear()
  const startYear = startDate ? new Date(startDate).getFullYear() : currentYear
  const endYear = endDate ? new Date(endDate).getFullYear() : currentYear
  return {
    minYear: Math.min(startYear, currentYear) - 1,
    maxYear: Math.max(endYear, currentYear) + 1,
  }
}

const JOURNEY_EVENT_DATE_MARGIN_DAYS = 2

/**
 * §"Maximal 2 Tage vor/nach der Reise, sonst verliert man bei der
 * Aktivitäten-Anlage schnell den Überblick" (Nutzervorgabe, wörtlich):
 * Aktivitäten/Restaurants/etc. lassen sich nur innerhalb eines engen
 * Fensters um die Reise anlegen, statt (wie zuvor über
 * `getTripDateFieldRange`) irgendein Jahr/Monat/Tag im gesamten
 * Kalenderjahr-Bereich zuzulassen. `keepIso` hält beim Bearbeiten eines
 * bestehenden Eintrags dessen Datum immer auswählbar, auch falls es
 * (z. B. nach nachträglicher Änderung der Reisedaten) außerhalb des
 * eigentlichen ±2-Tage-Fensters liegen sollte.
 */
export function getJourneyEventDateRange(startDate: string | null, endDate: string | null, keepIso?: string | null): { minIso: string; maxIso: string } {
  const today = isoToday()
  const start = startDate ?? today
  const end = endDate ?? start
  let minIso = addDaysIso(start, -JOURNEY_EVENT_DATE_MARGIN_DAYS)
  let maxIso = addDaysIso(end, JOURNEY_EVENT_DATE_MARGIN_DAYS)
  if (keepIso && keepIso < minIso) minIso = keepIso
  if (keepIso && keepIso > maxIso) maxIso = keepIso
  return { minIso, maxIso }
}

export function splitIsoDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: '', month: '', year: '' }
  const [year, month, day] = iso.split('-')
  return { day: day ?? '', month: month ?? '', year: year ?? '' }
}

/**
 * Kombiniert Tag/Monat/Jahr-Selects zu einem ISO-Datum. Gibt `null` zurück,
 * wenn alle drei Teile leer sind (Feld bleibt optional). Wirft einen Fehler
 * mit verständlicher Meldung bei unvollständiger oder ungültiger Eingabe
 * (z. B. 31. Februar), statt eine falsche Rollover-Zeit stillschweigend zu
 * akzeptieren.
 */
export function combineIsoDate(day: string, month: string, year: string, fieldLabel: string): string | null {
  if (!day && !month && !year) return null
  if (!day || !month || !year)
    throw new Error(`${fieldLabel}: bitte Tag, Monat und Jahr vollständig auswählen oder freilassen`)

  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
    throw new Error(`${fieldLabel}: ungültiges Datum`)

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Liest ein Jahr/Monat/Tag-Feldtrio (Namenskonvention der gemeinsamen
 * DateSelectFields-Komponente: `${prefix}_year`/`_month`/`_day`) direkt aus
 * FormData und kombiniert es zu einem ISO-Datum — gemeinsame Hilfsfunktion
 * für alle Server-Actions, die Datumsfelder dieser Komponente entgegennehmen
 * (Dokumente, Reisen, Etappen, Buchungen), statt dieselbe Logik in jeder
 * Action erneut zu schreiben.
 */
export function readDateGroupFromFormData(formData: FormData, prefix: string, fieldLabel: string): string | null {
  const day = String(formData.get(`${prefix}_day`) ?? '').trim()
  const month = String(formData.get(`${prefix}_month`) ?? '').trim()
  const year = String(formData.get(`${prefix}_year`) ?? '').trim()
  return combineIsoDate(day, month, year, fieldLabel)
}

export const ALLOWED_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function buildStoragePath(personId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'bin'
  return `${personId}/${crypto.randomUUID()}.${ext}`
}

/** Ablagepfad für Dokumente ohne Personenbezug (z. B. Buchungsunterlagen, Boardingpässe ohne Zuordnung). */
export function buildBookingStoragePath(bookingId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'bin'
  return `bookings/${bookingId}/${crypto.randomUUID()}.${ext}`
}
