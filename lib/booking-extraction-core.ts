import 'server-only'
import OpenAI from 'openai'
import { BOOKING_DOCUMENT_LABEL, combineDateTime } from '@/lib/bookings'
import type { BookingType } from '@/lib/supabase/types'

/**
 * §Reise-Postfach, Implementierungsschritt "die bestehende Booking-
 * Extraction starten" (Nutzervorgabe, wörtlich): gemeinsamer Kern, den
 * sowohl der bestehende Browser-Upload (lib/actions/booking-extraction.ts,
 * Typ bereits bekannt) als auch die neue, headless E-Mail-Pipeline
 * (lib/gmail/process-push.ts, Typ noch unbekannt) nutzen -- eine
 * Extraktionslogik statt einer zweiten, parallelen. Reiner Funktionskern,
 * keine Server Action (kein `redirect()`, kein `FormData`) -- beide
 * Aufrufer bringen ihre eigene Fehlerbehandlung/Navigation mit.
 */
const OPENAI_MODEL = 'gpt-5.4'

const BOOKING_FIELD_PROPERTIES = {
  readable: { type: 'boolean', description: 'false, wenn das Dokument nicht sinnvoll lesbar ist' },
  title: { type: ['string', 'null'], description: 'Name/Titel der Buchung, z. B. Hotelname oder Mietwagen-Bezeichnung — nicht für Flüge' },
  direction: { type: ['string', 'null'], enum: ['outbound', 'return', null], description: 'Nur für Flüge: Hinflug ("outbound") oder Rückflug ("return"), falls erkennbar' },
  provider: { type: ['string', 'null'], description: 'Airline, Hotelkette oder Mietwagenfirma' },
  flight_number: { type: ['string', 'null'] },
  from: { type: ['string', 'null'], description: 'Abflughafen (Flug) bzw. Abholort (Mietwagen)' },
  to: { type: ['string', 'null'], description: 'Zielflughafen (Flug) bzw. Rückgabeort (Mietwagen)' },
  terminal: { type: ['string', 'null'], description: 'Nur für Flüge: Abflug-Terminal' },
  gate: { type: ['string', 'null'], description: 'Nur für Flüge: Abflug-Gate' },
  location: { type: ['string', 'null'], description: 'Nur für Hotels: Ort/Stadt der Unterkunft' },
  start_date: { type: ['string', 'null'], description: 'Abflug/Check-in/Abholung, ISO 8601 JJJJ-MM-TT' },
  start_time: { type: ['string', 'null'], description: 'Uhrzeit dazu, HH:MM, falls vorhanden' },
  end_date: { type: ['string', 'null'], description: 'Landung/Check-out/Rückgabe, ISO 8601 JJJJ-MM-TT' },
  end_time: { type: ['string', 'null'], description: 'Uhrzeit dazu, HH:MM, falls vorhanden' },
  booking_reference: { type: ['string', 'null'] },
  amount: { type: ['number', 'null'] },
  currency: { type: ['string', 'null'], description: 'ISO-4217-Code, z. B. EUR, USD' },
} as const

const BOOKING_FIELD_REQUIRED = [
  'readable', 'title', 'direction', 'provider', 'flight_number', 'from', 'to', 'terminal', 'gate',
  'location', 'start_date', 'start_time', 'end_date', 'end_time', 'booking_reference',
  'amount', 'currency',
]

/** Bekannter Typ (Browser-Upload, Nutzer hat Buchungsart vorher ausgewählt). */
export const BOOKING_SCHEMA = {
  type: 'object',
  properties: BOOKING_FIELD_PROPERTIES,
  required: BOOKING_FIELD_REQUIRED,
  additionalProperties: false,
}

/**
 * §Reise-Postfach: Typ ist bei einer weitergeleiteten E-Mail NICHT bekannt
 * (anders als beim Browser-Upload, wo der Nutzer die Buchungsart vorher
 * auswählt) -- dieselben Felder plus `booking_type` zur Selbsterkennung.
 * Bewusst eine eigene, zweite Schema-Konstante statt das bestehende
 * BOOKING_SCHEMA um ein optionales Feld zu erweitern -- der Browser-Flow
 * bleibt dadurch unverändert (kein zusätzliches Feld, kein Risiko für die
 * bestehende, produktiv genutzte manuelle Auslesung).
 */
const EMAIL_BOOKING_TYPES = ['flight', 'accommodation', 'rental_car', 'transfer', 'activity', 'restaurant', 'train', 'ferry', 'insurance', 'other'] as const

export const EMAIL_BOOKING_SCHEMA = {
  type: 'object',
  properties: {
    ...BOOKING_FIELD_PROPERTIES,
    booking_type: {
      type: ['string', 'null'],
      enum: [...EMAIL_BOOKING_TYPES, null],
      description: 'Erkannter Buchungstyp, oder null wenn nicht eindeutig bestimmbar',
    },
  },
  required: [...BOOKING_FIELD_REQUIRED, 'booking_type'],
  additionalProperties: false,
}

export type ExtractionResult = Record<string, unknown>

export function buildBookingPrompt(type: BookingType): string {
  const kind = BOOKING_DOCUMENT_LABEL[type] ?? 'Buchungsbestätigung'
  return (
    `Du liest einen ${kind} aus einem Foto oder PDF aus und extrahierst ausschließlich Daten, die im ` +
    `Dokument tatsächlich sichtbar sind. Erfinde niemals Werte — wenn ein Feld nicht erkennbar oder nicht ` +
    `zutreffend ist, setze es auf null. Setze "readable" auf false, wenn das Dokument nicht sinnvoll ` +
    `lesbar ist (z. B. zu unscharf, falscher Dokumenttyp, leere Seite). Alle Datumsangaben im Format ` +
    `JJJJ-MM-TT, Uhrzeiten im Format HH:MM. Fülle nur Felder, die zum jeweiligen Buchungstyp passen ` +
    `(z. B. "direction"/"flight_number"/"terminal"/"gate" nur bei Flügen, "location" nur bei Hotels) — ` +
    `alle anderen bleiben null.`
  )
}

/** §Reise-Postfach: Gegenstück zu buildBookingPrompt für den Auto-Erkennungsfall (E-Mail-Pipeline, Typ unbekannt). */
export function buildAutoDetectBookingPrompt(): string {
  return (
    `Du liest eine Reise-Buchungsbestätigung (Flug, Hotel/Unterkunft, Mietwagen, Transfer, Aktivität, ` +
    `Restaurant, Versicherung oder eine sonstige Reisebuchung) aus einer weitergeleiteten E-Mail oder ` +
    `einem Anhang aus und extrahierst ausschließlich Daten, die tatsächlich sichtbar sind. Erfinde ` +
    `niemals Werte — wenn ein Feld nicht erkennbar oder nicht zutreffend ist, setze es auf null. ` +
    `Setze "booking_type" auf den erkannten Buchungstyp, oder null, wenn nicht eindeutig bestimmbar ` +
    `(z. B. bei einer Newsletter-Mail statt einer echten Buchungsbestätigung). Setze "readable" auf ` +
    `false, wenn kein sinnvoll auswertbarer Inhalt vorhanden ist. Alle Datumsangaben im Format ` +
    `JJJJ-MM-TT, Uhrzeiten im Format HH:MM. Fülle nur Felder, die zum jeweiligen Buchungstyp passen — ` +
    `alle anderen bleiben null.`
  )
}

function requireOpenAiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY ist nicht konfiguriert.')
  return apiKey
}

export type ExtractionInput =
  | { kind: 'file'; filename: string; mimeType: string; base64: string }
  | { kind: 'text'; text: string }

/**
 * Ein OpenAI-Aufruf, zwei mögliche Eingabeformen: Datei (Foto/PDF, wie beim
 * Browser-Upload) oder reiner Text (E-Mail-Textkörper ohne Anhang -- viele
 * Buchungsbestätigungen sind reine HTML-/Text-Mails ohne PDF).
 */
export async function callBookingExtractionModel(
  input: ExtractionInput,
  schema: typeof BOOKING_SCHEMA | typeof EMAIL_BOOKING_SCHEMA,
  prompt: string,
): Promise<ExtractionResult> {
  const openai = new OpenAI({ apiKey: requireOpenAiKey() })
  const isPdf = input.kind === 'file' && input.mimeType === 'application/pdf'

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: prompt },
        input.kind === 'text'
          ? { type: 'input_text', text: input.text }
          : isPdf
            ? { type: 'input_file', filename: input.filename, file_data: `data:application/pdf;base64,${input.base64}` }
            : { type: 'input_image', image_url: `data:${input.mimeType};base64,${input.base64}`, detail: 'high' },
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'booking_fields',
        schema,
        strict: true,
      },
    },
  })

  return JSON.parse(response.output_text) as ExtractionResult
}

export type BookingDraft = {
  stage_id: string | null; title: string | null; provider: string | null; booking_reference: string | null
  status: string; payment_status: string; amount: number | null; currency: string
  start_datetime: string | null; end_datetime: string | null; notes: string | null
  details: Record<string, string> | null
}

export function buildDraft(type: BookingType, parsed: ExtractionResult): BookingDraft {
  const details: Record<string, string> = {}
  const set = (key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) details[key] = value.trim()
  }

  if (type === 'flight') {
    set('direction', parsed.direction)
    set('flight_number', parsed.flight_number)
    set('from', parsed.from)
    set('to', parsed.to)
    set('terminal', parsed.terminal)
    set('gate', parsed.gate)
  } else if (type === 'accommodation') {
    set('location', parsed.location)
  } else if (type === 'rental_car') {
    set('pickup_location', parsed.from)
    set('dropoff_location', parsed.to)
  }

  const startDate = typeof parsed.start_date === 'string' ? parsed.start_date : ''
  const startTime = typeof parsed.start_time === 'string' ? parsed.start_time : ''
  const endDate = typeof parsed.end_date === 'string' ? parsed.end_date : ''
  const endTime = typeof parsed.end_time === 'string' ? parsed.end_time : ''

  return {
    stage_id: null,
    title: type !== 'flight' && typeof parsed.title === 'string' ? parsed.title : null,
    provider: typeof parsed.provider === 'string' ? parsed.provider : null,
    booking_reference: typeof parsed.booking_reference === 'string' ? parsed.booking_reference : null,
    status: 'pending',
    payment_status: 'unpaid',
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    currency: typeof parsed.currency === 'string' && parsed.currency ? parsed.currency : 'EUR',
    start_datetime: combineDateTime(startDate, startTime),
    end_datetime: combineDateTime(endDate, endTime),
    notes: null,
    details: Object.keys(details).length > 0 ? details : null,
  }
}
