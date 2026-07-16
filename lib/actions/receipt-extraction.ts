'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE } from '@/lib/documents'
import { BUDGET_CATEGORY_ORDER } from '@/lib/budget'

/** Gleiches Modell wie die bestehende Pass-/ESTA-Auslesung — austauschbar über diese Konstante. */
const OPENAI_MODEL = 'gpt-5.4'

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'false, wenn der Beleg nicht sinnvoll lesbar ist' },
    merchant: { type: ['string', 'null'], description: 'Händler/Anbieter auf dem Beleg' },
    date: { type: ['string', 'null'], description: 'Beleg-/Rechnungsdatum, ISO 8601 JJJJ-MM-TT' },
    amount: { type: ['number', 'null'], description: 'Gesamtbetrag als Zahl, ohne Währungssymbol' },
    currency: { type: ['string', 'null'], description: 'ISO-4217-Währungscode, z. B. EUR, USD' },
    receipt_number: { type: ['string', 'null'], description: 'Rechnungs- oder Belegnummer, falls vorhanden' },
    label: { type: ['string', 'null'], description: 'Kurze, sinnvolle Bezeichnung der Ausgabe, z. B. "Abendessen Restaurant XY"' },
    category: {
      type: ['string', 'null'],
      enum: [...BUDGET_CATEGORY_ORDER, null],
      description: 'Am besten passende Budgetkategorie aus der vorgegebenen Liste',
    },
    location: { type: ['string', 'null'], description: 'Ort des Belegs, falls erkennbar' },
  },
  required: ['readable', 'merchant', 'date', 'amount', 'currency', 'receipt_number', 'label', 'category', 'location'],
  additionalProperties: false,
}

const RECEIPT_PROMPT = (
  'Du liest einen Kassenbeleg oder eine Rechnung aus einem Foto oder PDF aus und extrahierst ' +
  'ausschließlich Daten, die auf dem Beleg tatsächlich sichtbar sind. Erfinde niemals Werte — ' +
  'wenn ein Feld nicht erkennbar ist, setze es auf null. Setze "readable" auf false, wenn der ' +
  'Beleg nicht sinnvoll lesbar ist (z. B. zu unscharf, kein Beleg, leere Seite). Der Gesamtbetrag ' +
  'ist der tatsächlich bezahlte/zu zahlende Endbetrag, nicht ein Zwischensummen- oder ' +
  'Einzelposten-Betrag. Alle Datumsangaben im Format JJJJ-MM-TT.'
)

function buildReceiptStoragePath(tripId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'bin'
  return `receipts/${tripId}/${crypto.randomUUID()}.${ext}`
}

type ReceiptResult = {
  readable: boolean
  merchant: string | null
  date: string | null
  amount: number | null
  currency: string | null
  receipt_number: string | null
  label: string | null
  category: string | null
  location: string | null
  suggested_stage_id?: string | null
  suggested_booking_id?: string | null
}

export async function extractReceiptData(formData: FormData) {
  const tripId   = String(formData.get('trip_id') ?? '')
  const slug     = String(formData.get('slug') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const passthrough = new URLSearchParams()
  if (returnTo) passthrough.set('return_to', returnTo)
  const targetPath = `/trips/${slug}/budget/new`

  function fail(message: string, storagePath?: string): never {
    const params = new URLSearchParams(passthrough)
    params.set('error', message)
    if (storagePath) params.set('storage_path', storagePath)
    redirect(`${targetPath}?${params.toString()}`)
  }

  if (!process.env.OPENAI_API_KEY)
    fail('Die automatische Belegauslesung ist aktuell nicht konfiguriert. Bitte Kostenposition manuell ausfüllen.')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0)
    fail('Bitte zuerst ein Beleg-Foto oder eine PDF-Datei auswählen.')
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type))
    fail('Nur Fotos (JPEG, PNG, WebP) oder PDF-Dateien sind erlaubt.')
  if (file.size > MAX_DOCUMENT_FILE_SIZE)
    fail('Die Datei ist zu groß (maximal 10 MB).')

  const supabase = await createClient()
  const storagePath = buildReceiptStoragePath(tripId, file.name)

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type,
    cacheControl: '31536000',
  })
  if (uploadError)
    fail('Upload fehlgeschlagen: ' + uploadError.message)

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')
  const isPdf = file.type === 'application/pdf'

  let parsed: ReceiptResult
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: RECEIPT_PROMPT },
          isPdf
            ? { type: 'input_file', filename: file.name, file_data: `data:application/pdf;base64,${base64}` }
            : { type: 'input_image', image_url: `data:${file.type};base64,${base64}`, detail: 'high' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'receipt_fields',
          schema: RECEIPT_SCHEMA,
          strict: true,
        },
      },
    })
    parsed = JSON.parse(response.output_text) as ReceiptResult
  } catch {
    fail('Die KI-Auslesung ist gerade nicht verfügbar (Fehler oder Zeitüberschreitung). Bitte manuell fortfahren.', storagePath)
  }

  if (!parsed.readable)
    fail('Der Beleg konnte nicht zuverlässig ausgelesen werden. Bitte ein anderes Foto/PDF hochladen oder die Daten manuell eingeben.', storagePath)

  // Deterministische Vorschläge (keine KI) — nur Vorschlag, nie automatisch gesetzt:
  // Etappe anhand Belegdatum im Etappen-Zeitraum, Buchung anhand grobem Textabgleich
  // zwischen erkanntem Händler und Buchungstitel/-anbieter.
  if (parsed.date) {
    const { data: stages } = await supabase
      .from('stages')
      .select('id, start_date, end_date')
      .eq('trip_id', tripId)
    const match = (stages ?? []).find(
      (s) => s.start_date && s.end_date && parsed.date! >= s.start_date && parsed.date! <= s.end_date,
    )
    if (match) parsed.suggested_stage_id = match.id
  }

  if (parsed.merchant) {
    const merchantLower = parsed.merchant.toLowerCase()
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, title, provider')
      .eq('trip_id', tripId)
    const match = (bookings ?? []).find((b) => {
      const title = (b.title ?? '').toLowerCase()
      const provider = (b.provider ?? '').toLowerCase()
      return (title && (title.includes(merchantLower) || merchantLower.includes(title))) ||
        (provider && (provider.includes(merchantLower) || merchantLower.includes(provider)))
    })
    if (match) parsed.suggested_booking_id = match.id
  }

  const params = new URLSearchParams(passthrough)
  params.set('storage_path', storagePath)
  params.set('draft', JSON.stringify(parsed))
  redirect(`${targetPath}?${params.toString()}`)
}
