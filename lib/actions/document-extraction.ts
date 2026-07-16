'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, buildStoragePath,
  DOCUMENT_TYPE_CONFIG,
} from '@/lib/documents'
import type { DocumentType } from '@/lib/documents'

/**
 * Aktuell dokumentierter "Standard"-Tier von OpenAI (vision-/PDF-fähig) —
 * spürbar genauer als das günstigste Modell, ohne Premium-Preis. Austauschbar,
 * falls ein anderes Modell besser passt.
 */
const OPENAI_MODEL = 'gpt-5.4'

const IDENTITY_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'false, wenn das Dokument nicht sinnvoll lesbar ist' },
    first_name: { type: ['string', 'null'] },
    last_name: { type: ['string', 'null'] },
    birth_date: { type: ['string', 'null'], description: 'ISO 8601, JJJJ-MM-TT' },
    gender: { type: ['string', 'null'], enum: ['male', 'female', 'other', null], description: 'Muss exakt "male", "female", "other" oder null sein' },
    nationality: { type: ['string', 'null'] },
    birth_place: { type: ['string', 'null'] },
    passport_number: { type: ['string', 'null'] },
    issuing_country: { type: ['string', 'null'] },
    issue_date: { type: ['string', 'null'], description: 'ISO 8601, JJJJ-MM-TT' },
    expires_at: { type: ['string', 'null'], description: 'ISO 8601, JJJJ-MM-TT' },
  },
  required: [
    'readable', 'first_name', 'last_name', 'birth_date', 'gender', 'nationality',
    'birth_place', 'passport_number', 'issuing_country', 'issue_date', 'expires_at',
  ],
  additionalProperties: false,
}

const ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'false, wenn das Dokument nicht sinnvoll lesbar ist' },
    detected_name: { type: ['string', 'null'], description: 'Name der Person laut Dokument, nur zum Abgleich' },
    issuing_country: { type: ['string', 'null'], description: 'Land / Zielgebiet' },
    passport_number: { type: ['string', 'null'], description: 'Antrags-/Referenznummer des Dokuments selbst' },
    related_passport_number: { type: ['string', 'null'], description: 'Im Dokument referenzierte Passnummer, falls vorhanden' },
    issue_date: { type: ['string', 'null'], description: 'Genehmigungsdatum, ISO 8601' },
    valid_from: { type: ['string', 'null'], description: 'Gültig ab, ISO 8601' },
    expires_at: { type: ['string', 'null'], description: 'Gültig bis, ISO 8601' },
    approval_status: { type: ['string', 'null'], enum: ['pending', 'approved', null] },
  },
  required: [
    'readable', 'detected_name', 'issuing_country', 'passport_number', 'related_passport_number',
    'issue_date', 'valid_from', 'expires_at', 'approval_status',
  ],
  additionalProperties: false,
}

const ESTA_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'false, wenn das Dokument nicht sinnvoll lesbar ist' },
    first_name: { type: ['string', 'null'] },
    last_name: { type: ['string', 'null'] },
    birth_date: { type: ['string', 'null'], description: 'ISO 8601, JJJJ-MM-TT' },
    issuing_country: { type: ['string', 'null'], description: 'Zielland/Zielgebiet, für ESTA i. d. R. "United States"' },
    application_number: { type: ['string', 'null'], description: 'Die ESTA Application Number — NICHT die Passnummer' },
    traveler_passport_number: { type: ['string', 'null'], description: 'Die im Dokument genannte Passnummer des Reisenden — NICHT die Application Number' },
    expires_at: { type: ['string', 'null'], description: 'Gültig bis, ISO 8601' },
  },
  required: [
    'readable', 'first_name', 'last_name', 'birth_date', 'issuing_country',
    'application_number', 'traveler_passport_number', 'expires_at',
  ],
  additionalProperties: false,
}

function buildPrompt(config: { label: string; isIdentityType: boolean; value: string }): string {
  const kind = config.isIdentityType
    ? 'Reisepass oder Personalausweis'
    : `Einreisedokument (${config.label})`
  const base = (
    `Du liest einen ${kind} aus einem Foto oder PDF aus und extrahierst ausschließlich Daten, ` +
    `die im Dokument tatsächlich sichtbar sind. Erfinde niemals Werte — wenn ein Feld nicht ` +
    `erkennbar ist, setze es auf null. Falls eine maschinenlesbare Zone (MRZ) sichtbar ist, nutze ` +
    `sie zusätzlich zur Plausibilitätsprüfung von Namen, Geburtsdatum, Dokumentnummer und ` +
    `Ablaufdatum. Setze "readable" auf false, wenn das Dokument nicht sinnvoll lesbar ist (z. B. ` +
    `zu unscharf, falsches Dokument, leere Seite). Alle Datumsangaben im Format JJJJ-MM-TT.`
  )
  if (config.value !== 'esta') return base
  return (
    base +
    ` Ein ESTA-Dokument enthält zwei unterschiedliche, getrennt aufgedruckte Nummern: die ` +
    `"Application Number" (die eigene Antragsnummer des ESTA) und die "Passport Number" (die ` +
    `Nummer des zugrunde liegenden Reisepasses des Antragstellers). Verwechsle diese beiden ` +
    `Nummern niemals — trage die Antragsnummer in "application_number" und die Passnummer in ` +
    `"traveler_passport_number" ein. Falls Vor- und Nachname getrennt aufgeführt sind, übernimm ` +
    `sie direkt; andernfalls versuche einen zusammenhängenden Namen sinnvoll in Vor- und ` +
    `Nachname aufzuteilen.`
  )
}

type ExtractionResult = Record<string, unknown>

export async function extractDocumentData(formData: FormData) {
  const personId    = String(formData.get('person_id') ?? '')
  const docType     = String(formData.get('doc_type') ?? '') as DocumentType
  const mode        = String(formData.get('mode') ?? 'create')
  const documentId  = String(formData.get('document_id') ?? '')
  const returnTo    = String(formData.get('return_to') ?? '').trim()
  const assignTrip  = String(formData.get('assign_trip') ?? '').trim()

  const passthrough = new URLSearchParams()
  if (returnTo) passthrough.set('return_to', returnTo)
  if (assignTrip) passthrough.set('assign_trip', assignTrip)

  const targetPath = mode === 'edit'
    ? `/family/${personId}/documents/${documentId}/edit`
    : `/family/${personId}/documents/new`

  function fail(message: string, storagePath?: string): never {
    const params = new URLSearchParams(passthrough)
    if (mode !== 'edit') params.set('type', docType)
    params.set('error', message)
    if (storagePath) params.set('storage_path', storagePath)
    redirect(`${targetPath}?${params.toString()}`)
  }

  if (!process.env.OPENAI_API_KEY)
    fail('Die automatische Auslesung ist aktuell nicht konfiguriert. Bitte Dokument manuell ausfüllen.')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0)
    fail('Bitte zuerst ein Foto oder eine PDF-Datei auswählen.')
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type))
    fail('Nur Fotos (JPEG, PNG, WebP) oder PDF-Dateien sind erlaubt.')
  if (file.size > MAX_DOCUMENT_FILE_SIZE)
    fail('Die Datei ist zu groß (maximal 10 MB).')

  const config = DOCUMENT_TYPE_CONFIG[docType]
  if (!config.isIdentityType && !config.isEntryDocumentType)
    fail('Für diesen Dokumenttyp ist keine automatische Auslesung vorgesehen.')

  const supabase = await createClient()
  const storagePath = buildStoragePath(personId, file.name)

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type,
    cacheControl: '31536000',
  })
  if (uploadError)
    fail('Upload fehlgeschlagen: ' + uploadError.message)

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')
  const isPdf = file.type === 'application/pdf'
  const schema = config.isIdentityType ? IDENTITY_SCHEMA : docType === 'esta' ? ESTA_SCHEMA : ENTRY_SCHEMA

  let parsed: ExtractionResult
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: buildPrompt(config) },
          isPdf
            ? { type: 'input_file', filename: file.name, file_data: `data:application/pdf;base64,${base64}` }
            : { type: 'input_image', image_url: `data:${file.type};base64,${base64}`, detail: 'high' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'document_fields',
          schema,
          strict: true,
        },
      },
    })
    parsed = JSON.parse(response.output_text) as ExtractionResult
  } catch {
    fail('Die KI-Auslesung ist gerade nicht verfügbar (Fehler oder Zeitüberschreitung). Bitte manuell fortfahren.', storagePath)
  }

  if (!parsed.readable)
    fail('Das Dokument konnte nicht zuverlässig ausgelesen werden. Bitte ein anderes Foto/PDF hochladen oder die Daten manuell eingeben.', storagePath)

  // ESTA nutzt eigene, eindeutige KI-Feldnamen (application_number/traveler_passport_number),
  // um Application Number und Passnummer nie zu verwechseln — hier auf die kanonischen
  // DocumentDetails-Feldnamen abbilden, die die new/edit-Seiten generisch weiterverarbeiten.
  if (docType === 'esta') {
    const { application_number, traveler_passport_number, ...rest } = parsed
    parsed = {
      ...rest,
      passport_number: application_number ?? null,
      related_passport_number: traveler_passport_number ?? null,
    }
  }

  const params = new URLSearchParams(passthrough)
  if (mode !== 'edit') params.set('type', docType)
  params.set('storage_path', storagePath)
  params.set('draft', JSON.stringify(parsed))
  redirect(`${targetPath}?${params.toString()}`)
}
