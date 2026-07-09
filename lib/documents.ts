import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, IdCard, FileCheck, Stamp, Globe2, Shield, Receipt, FileText } from 'lucide-react'
import { formatDateDE } from './demo-data'

export type DocumentType = 'passport' | 'id_card' | 'visa' | 'esta' | 'eta' | 'entry_permit' | 'insurance' | 'booking_document' | 'other'

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
  passport_number?: string
  issuing_country?: string
  issue_date?: string
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

export function getDocumentValidity(doc: {
  doc_type: DocumentType
  expires_at: string | null
  details: DocumentDetails | null
}): DocumentValidity | null {
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

export function getDateFieldRange(kind: 'birth' | 'issue' | 'expiry'): DateFieldRange {
  const currentYear = new Date().getFullYear()
  if (kind === 'birth') return { minYear: currentYear - 110, maxYear: currentYear }
  if (kind === 'issue') return { minYear: currentYear - 15, maxYear: currentYear }
  return { minYear: currentYear, maxYear: currentYear + 15 }
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

export const ALLOWED_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function buildStoragePath(personId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'bin'
  return `${personId}/${crypto.randomUUID()}.${ext}`
}
