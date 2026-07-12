'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, buildBookingStoragePath } from '@/lib/documents'
import { BOOKING_TYPE_CONFIG, combineDateTime } from '@/lib/bookings'
import type { BookingType } from '@/lib/supabase/types'

/**
 * §Wiederverwendung statt Parallel-Implementierung: identisches Modell und
 * identischer OpenAI-Aufrufstil wie lib/actions/document-extraction.ts
 * (Pass/ESTA-Auslesung) — nur Schema und Zieltyp unterscheiden sich.
 */
const OPENAI_MODEL = 'gpt-5.4'

const BOOKING_SCHEMA = {
  type: 'object',
  properties: {
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
    booking_date: { type: ['string', 'null'], description: 'Nur für Hotels: Datum, an dem die Buchung vorgenommen wurde, ISO 8601' },
    booking_reference: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'], description: 'ISO-4217-Code, z. B. EUR, USD' },
  },
  required: [
    'readable', 'title', 'direction', 'provider', 'flight_number', 'from', 'to', 'terminal', 'gate',
    'location', 'start_date', 'start_time', 'end_date', 'end_time', 'booking_date', 'booking_reference',
    'amount', 'currency',
  ],
  additionalProperties: false,
}

const DOCUMENT_KIND_LABEL: Record<string, string> = {
  flight: 'Boardingpass oder Flugbuchungsbestätigung',
  accommodation: 'Hotelbuchungsbestätigung',
  rental_car: 'Mietwagen-Buchungsbestätigung',
}

function buildPrompt(type: BookingType): string {
  const kind = DOCUMENT_KIND_LABEL[type] ?? 'Buchungsbestätigung'
  return (
    `Du liest einen ${kind} aus einem Foto oder PDF aus und extrahierst ausschließlich Daten, die im ` +
    `Dokument tatsächlich sichtbar sind. Erfinde niemals Werte — wenn ein Feld nicht erkennbar oder nicht ` +
    `zutreffend ist, setze es auf null. Setze "readable" auf false, wenn das Dokument nicht sinnvoll ` +
    `lesbar ist (z. B. zu unscharf, falscher Dokumenttyp, leere Seite). Alle Datumsangaben im Format ` +
    `JJJJ-MM-TT, Uhrzeiten im Format HH:MM. Fülle nur Felder, die zum jeweiligen Buchungstyp passen ` +
    `(z. B. "direction"/"flight_number"/"terminal"/"gate" nur bei Flügen, "location"/"booking_date" nur ` +
    `bei Hotels) — alle anderen bleiben null.`
  )
}

type ExtractionResult = Record<string, unknown>

type BookingDraft = {
  stage_id: string | null; title: string | null; provider: string | null; booking_reference: string | null
  status: string; payment_status: string; amount: number | null; currency: string
  start_datetime: string | null; end_datetime: string | null; notes: string | null
  details: Record<string, string> | null
}

function buildDraft(type: BookingType, parsed: ExtractionResult): BookingDraft {
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
    set('booking_date', parsed.booking_date)
  } else if (type === 'rental_car') {
    // §pickup_location/dropoff_location sind in der Maske ausgeblendet (siehe
    // lib/bookings.ts), werden aber bei erfolgreicher Auslesung trotzdem aus
    // from/to übernommen, statt die erkannten Orte zu verwerfen.
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

export async function extractBookingData(formData: FormData) {
  const slug       = String(formData.get('slug') ?? '')
  const type       = String(formData.get('type') ?? '') as BookingType
  const category   = String(formData.get('category') ?? '').trim()
  const mode       = String(formData.get('mode') ?? 'create')
  const bookingId  = String(formData.get('booking_id') ?? '')

  const targetPath = mode === 'edit'
    ? `/trips/${slug}/bookings/${bookingId}/edit`
    : `/trips/${slug}/bookings/new`

  function fail(message: string): never {
    const params = new URLSearchParams()
    if (mode !== 'edit') {
      params.set('type', type)
      if (category) params.set('category', category)
    }
    params.set('error', message)
    redirect(`${targetPath}?${params.toString()}`)
  }

  if (!process.env.OPENAI_API_KEY)
    fail('Die automatische Auslesung ist aktuell nicht konfiguriert. Bitte manuell ausfüllen.')

  const config = BOOKING_TYPE_CONFIG[type]
  if (!config?.supportsExtraction)
    fail('Für diesen Buchungstyp ist keine automatische Auslesung vorgesehen.')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0)
    fail('Bitte zuerst ein Foto oder eine PDF-Datei auswählen.')
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type))
    fail('Nur Fotos (JPEG, PNG, WebP) oder PDF-Dateien sind erlaubt.')
  if (file.size > MAX_DOCUMENT_FILE_SIZE)
    fail('Die Datei ist zu groß (maximal 10 MB).')

  // §Upload dient hier nur als Zwischenschritt für die OpenAI-Auslesung, nicht
  // als dauerhafte Anlage an die Buchung -- bookings hat kein eigenes
  // Dokumenten-/Foto-Feld (Boardingpässe sind ein separates, personenbezogenes
  // Feature, siehe app/(app)/trips/[id]/bookings/[bookingId]/boarding-passes).
  // storage_path dient dem Formular anschließend nur als UI-Signal ("bereits
  // ausgelesen"), nicht als Referenz auf eine gespeicherte Datei.
  const supabase = await createClient()
  const storagePath = buildBookingStoragePath(bookingId || 'staging', file.name)
  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type,
  })
  if (uploadError)
    fail('Upload fehlgeschlagen: ' + uploadError.message)

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')
  const isPdf = file.type === 'application/pdf'

  let parsed: ExtractionResult
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: buildPrompt(type) },
          isPdf
            ? { type: 'input_file', filename: file.name, file_data: `data:application/pdf;base64,${base64}` }
            : { type: 'input_image', image_url: `data:${file.type};base64,${base64}`, detail: 'high' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'booking_fields',
          schema: BOOKING_SCHEMA,
          strict: true,
        },
      },
    })
    parsed = JSON.parse(response.output_text) as ExtractionResult
  } catch {
    fail('Die KI-Auslesung ist gerade nicht verfügbar (Fehler oder Zeitüberschreitung). Bitte manuell fortfahren.')
  }

  if (!parsed.readable)
    fail('Das Dokument konnte nicht zuverlässig ausgelesen werden. Bitte ein anderes Foto/PDF hochladen oder die Daten manuell eingeben.')

  const draft = buildDraft(type, parsed)

  const params = new URLSearchParams()
  if (mode !== 'edit') {
    params.set('type', type)
    if (category) params.set('category', category)
  }
  params.set('storage_path', storagePath)
  params.set('draft', JSON.stringify(draft))
  redirect(`${targetPath}?${params.toString()}`)
}
