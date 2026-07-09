import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, IdCard, FileCheck, Shield, Receipt, FileText } from 'lucide-react'
import { formatDateDE } from './demo-data'

export type DocumentType = 'passport' | 'id_card' | 'visa' | 'insurance' | 'booking_document' | 'other'

export type DocumentTypeConfig = {
  value: DocumentType
  label: string
  icon: LucideIcon
  numberLabel: string
}

export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'passport', 'id_card', 'visa', 'insurance', 'booking_document', 'other',
]

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, DocumentTypeConfig> = {
  passport: { value: 'passport', label: 'Reisepass', icon: BadgeCheck, numberLabel: 'Passnummer' },
  id_card: { value: 'id_card', label: 'Personalausweis', icon: IdCard, numberLabel: 'Ausweisnummer' },
  visa: { value: 'visa', label: 'Visum / ESTA / eTA', icon: FileCheck, numberLabel: 'Antrags-/Referenznummer' },
  insurance: { value: 'insurance', label: 'Versicherung', icon: Shield, numberLabel: 'Policennummer' },
  booking_document: { value: 'booking_document', label: 'Buchungsunterlage', icon: Receipt, numberLabel: 'Referenznummer' },
  other: { value: 'other', label: 'Sonstiges', icon: FileText, numberLabel: 'Nummer' },
}

export type DocumentDetails = {
  first_name?: string
  last_name?: string
  birth_date?: string
  passport_number?: string
  issuing_country?: string
  issue_date?: string
  source?: 'manual' | 'extracted'
}

export type PassportValidity = 'valid' | 'expiring_soon' | 'expired' | 'incomplete'

export const PASSPORT_VALIDITY_LABELS: Record<PassportValidity, string> = {
  valid: 'Gültig',
  expiring_soon: 'Läuft bald ab',
  expired: 'Abgelaufen',
  incomplete: 'Unvollständig',
}

export const PASSPORT_VALIDITY_COLORS: Record<PassportValidity, string> = {
  valid: '#4C7A5D',
  expiring_soon: '#B89A5E',
  expired: '#B5624A',
  incomplete: '#7C7063',
}

export function getPassportValidity(doc: {
  expires_at: string | null
  details: DocumentDetails | null
}): PassportValidity {
  if (!doc.details?.passport_number || !doc.expires_at) return 'incomplete'
  const expiresAt = new Date(doc.expires_at)
  const today = new Date()
  const in180Days = new Date(today.getTime() + 180 * 86400000)
  if (expiresAt < today) return 'expired'
  if (expiresAt < in180Days) return 'expiring_soon'
  return 'valid'
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
