'use server'

import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, buildBookingStoragePath } from '@/lib/documents'
import { BOOKING_TYPE_CONFIG } from '@/lib/bookings'
import type { BookingType } from '@/lib/supabase/types'
import { toTravelDocumentsPath } from '@/lib/lumi-core-storage/paths'
import { BOOKING_SCHEMA, buildBookingPrompt, callBookingExtractionModel, buildDraft, type ExtractionResult } from '@/lib/booking-extraction-core'

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

  // §Bugfix "kein doppelter Upload" (Nutzervorgabe, wörtlich): dieser Upload
  // ist der EINZIGE Upload der Datei. bookings selbst hat weiterhin kein
  // eigenes Dokumenten-/Foto-Feld (Boardingpässe sind ein separates,
  // personenbezogenes Feature, siehe
  // app/(app)/trips/[id]/bookings/[bookingId]/boarding-passes) -- storage_path
  // fließt stattdessen über das Formular-Hiddenfeld "existing_storage_path"
  // zu lib/actions/bookings.ts::createBooking/updateBooking, die daraus nach
  // erfolgreichem Speichern der Buchung automatisch eine echte
  // travel_documents-Zeile (doc_type='booking_document') anlegen -- dieselbe
  // bereits hochgeladene Datei wird dadurch wiederverwendet, nie ein zweites
  // Mal hochgeladen.
  const supabase = await createLumiCoreClient()
  const rawPath = buildBookingStoragePath(bookingId || 'staging', file.name)
  const storagePath = await toTravelDocumentsPath(rawPath)
  if (!storagePath)
    fail('Upload fehlgeschlagen: Haushalt nicht gefunden')
  const { error: uploadError } = await supabase.storage.from('travel-documents').upload(storagePath, file, {
    contentType: file.type,
    cacheControl: '31536000',
  })
  if (uploadError)
    fail('Upload fehlgeschlagen: ' + uploadError.message)

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')

  let parsed: ExtractionResult
  try {
    parsed = await callBookingExtractionModel(
      { kind: 'file', filename: file.name, mimeType: file.type, base64 },
      BOOKING_SCHEMA,
      buildBookingPrompt(type),
    )
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
