'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, buildStoragePath, buildBookingStoragePath, combineIsoDate } from '@/lib/documents'
import type { DocumentType, DocumentDetails } from '@/lib/documents'

function readDateGroup(formData: FormData, prefix: string, fieldLabel: string): string | null {
  const day   = String(formData.get(`${prefix}_day`) ?? '').trim()
  const month = String(formData.get(`${prefix}_month`) ?? '').trim()
  const year  = String(formData.get(`${prefix}_year`) ?? '').trim()
  return combineIsoDate(day, month, year, fieldLabel)
}

function readCommonFields(formData: FormData) {
  const personId    = String(formData.get('person_id') ?? '')
  const docType     = String(formData.get('doc_type') ?? 'other') as DocumentType
  const label       = String(formData.get('label') ?? '').trim()
  const expiresAt   = readDateGroup(formData, 'expires_at', 'Ablaufdatum')
  const notes       = String(formData.get('notes') ?? '').trim()
  const returnTo    = String(formData.get('return_to') ?? '').trim()
  const assignTrip  = String(formData.get('assign_trip') ?? '').trim()

  const details: DocumentDetails = {}
  const firstName      = String(formData.get('first_name') ?? '').trim()
  const lastName       = String(formData.get('last_name') ?? '').trim()
  const birthDate      = readDateGroup(formData, 'birth_date', 'Geburtsdatum')
  const gender         = String(formData.get('gender') ?? '').trim()
  const nationality    = String(formData.get('nationality') ?? '').trim()
  const birthPlace     = String(formData.get('birth_place') ?? '').trim()
  const passportNumber = String(formData.get('passport_number') ?? '').trim()
  const issuingCountry = String(formData.get('issuing_country') ?? '').trim()
  const issueDate      = readDateGroup(formData, 'issue_date', 'Ausstellungsdatum')
  const validFrom      = readDateGroup(formData, 'valid_from', 'Gültig ab')
  const relatedPassportNumber = String(formData.get('related_passport_number') ?? '').trim()
  const approvalStatus = String(formData.get('approval_status') ?? '').trim()
  if (firstName) details.first_name = firstName
  if (lastName) details.last_name = lastName
  if (birthDate) details.birth_date = birthDate
  if (gender) details.gender = gender
  if (nationality) details.nationality = nationality
  if (birthPlace) details.birth_place = birthPlace
  if (passportNumber) details.passport_number = passportNumber
  if (issuingCountry) details.issuing_country = issuingCountry
  if (issueDate) details.issue_date = issueDate
  if (validFrom) details.valid_from = validFrom
  if (relatedPassportNumber) details.related_passport_number = relatedPassportNumber
  if (approvalStatus === 'pending' || approvalStatus === 'approved') details.approval_status = approvalStatus

  const file = formData.get('file')
  const existingStoragePath = String(formData.get('existing_storage_path') ?? '').trim()

  return { personId, docType, label, expiresAt, notes, returnTo, assignTrip, details, file, existingStoragePath }
}

function validateFile(file: FormDataEntryValue | null, required: boolean): { error?: string; file?: File } {
  if (!(file instanceof File) || file.size === 0) {
    if (required) return { error: 'Bitte ein Foto oder eine PDF-Datei auswählen' }
    return {}
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type))
    return { error: 'Nur Fotos (JPEG, PNG, WebP) oder PDF-Dateien sind erlaubt' }
  if (file.size > MAX_DOCUMENT_FILE_SIZE)
    return { error: 'Die Datei ist zu groß (maximal 10 MB)' }
  return { file }
}

export async function createDocument(formData: FormData) {
  const personId = String(formData.get('person_id') ?? '')
  const docType  = String(formData.get('doc_type') ?? 'other')
  const newPath  = `/family/${personId}/documents/new?type=${docType}`

  let f: ReturnType<typeof readCommonFields>
  try {
    f = readCommonFields(formData)
  } catch (e) {
    redirect(`${newPath}&error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (f.label.length < 2)
    redirect(`${newPath}&error=${encodeURIComponent('Dokumentname: mindestens 2 Zeichen erforderlich')}`)

  const { error: fileError, file } = validateFile(f.file, !f.existingStoragePath)
  if (fileError)
    redirect(`${newPath}&error=${encodeURIComponent(fileError)}`)
  if (!file && !f.existingStoragePath)
    redirect(`${newPath}&error=${encodeURIComponent('Datei fehlt')}`)

  const supabase = await createClient()

  // Kommt die Datei bereits aus einer vorangegangenen KI-Auslesung (existing_storage_path),
  // wird sie nicht erneut hochgeladen — sonst nur, wenn der Nutzer sie hier ersetzt hat.
  let storagePath: string
  let source: 'manual' | 'extracted'
  if (file) {
    storagePath = buildStoragePath(f.personId, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type,
    })
    if (uploadError)
      redirect(`${newPath}&error=${encodeURIComponent('Upload fehlgeschlagen: ' + uploadError.message)}`)
    // Nutzer hat die automatisch ausgelesene Datei durch eine eigene ersetzt — die alte wird verwaist, also entfernen.
    if (f.existingStoragePath) await supabase.storage.from('documents').remove([f.existingStoragePath])
    source = 'manual'
  } else {
    storagePath = f.existingStoragePath
    source = 'extracted'
  }

  const { data: inserted, error: insertError } = await supabase
    .from('documents')
    .insert({
      person_id: f.personId,
      doc_type: f.docType,
      label: f.label,
      expires_at: f.expiresAt || null,
      notes: f.notes || null,
      details: { ...f.details, source },
      storage_provider: 'supabase_storage',
      storage_bucket: 'documents',
      storage_path: storagePath,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    await supabase.storage.from('documents').remove([storagePath])
    redirect(`${newPath}&error=${encodeURIComponent('Speicherfehler: ' + (insertError?.message ?? 'Unbekannt'))}`)
  }

  if (f.assignTrip)
    await supabase.from('document_trips').insert({ document_id: inserted.id, trip_id: f.assignTrip })

  redirect(f.returnTo || `/family/${f.personId}`)
}

export async function updateDocument(formData: FormData) {
  const documentId = String(formData.get('document_id') ?? '')
  const personId    = String(formData.get('person_id') ?? '')
  const editPath    = `/family/${personId}/documents/${documentId}/edit`

  let f: ReturnType<typeof readCommonFields>
  try {
    f = readCommonFields(formData)
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (f.label.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Dokumentname: mindestens 2 Zeichen erforderlich')}`)

  const { error: fileError, file } = validateFile(f.file, false)
  if (fileError)
    redirect(`${editPath}?error=${encodeURIComponent(fileError)}`)

  const supabase = await createClient()

  // Herkunft (manuell/KI) bestimmen: eigener Datei-Upload macht es wieder "manuell",
  // eine übernommene KI-Auslesung (existing_storage_path) macht es "extracted", ohne
  // Dateiänderung bleibt die bisherige Herkunft aus der DB unverändert erhalten.
  let source: 'manual' | 'extracted' = 'manual'
  let previousStoragePath: string | undefined
  if (file || f.existingStoragePath) {
    const { data: existing } = await supabase
      .from('documents').select('storage_path').eq('id', documentId).maybeSingle()
    previousStoragePath = existing?.storage_path
    source = file ? 'manual' : 'extracted'
  } else {
    const { data: existing } = await supabase
      .from('documents').select('details').eq('id', documentId).maybeSingle()
    source = (existing?.details as DocumentDetails | null)?.source ?? 'manual'
  }

  const update: {
    doc_type: string
    label: string
    expires_at: string | null
    notes: string | null
    details: DocumentDetails
    storage_path?: string
  } = {
    doc_type: f.docType,
    label: f.label,
    expires_at: f.expiresAt || null,
    notes: f.notes || null,
    details: { ...f.details, source },
  }

  if (file) {
    const storagePath = buildStoragePath(f.personId, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type,
    })
    if (uploadError)
      redirect(`${editPath}?error=${encodeURIComponent('Upload fehlgeschlagen: ' + uploadError.message)}`)

    update.storage_path = storagePath
    if (previousStoragePath) await supabase.storage.from('documents').remove([previousStoragePath])
  } else if (f.existingStoragePath) {
    update.storage_path = f.existingStoragePath
    if (previousStoragePath) await supabase.storage.from('documents').remove([previousStoragePath])
  }

  const { error } = await supabase.from('documents').update(update).eq('id', documentId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(f.returnTo || `/family/${f.personId}/documents/${documentId}`)
}

export async function assignDocumentToTrip(formData: FormData) {
  const documentId = String(formData.get('document_id') ?? '')
  const personId    = String(formData.get('person_id') ?? '')
  const tripId      = String(formData.get('trip_id') ?? '')
  const detailPath  = `/family/${personId}/documents/${documentId}`

  if (!tripId)
    redirect(`${detailPath}?error=${encodeURIComponent('Bitte eine Reise auswählen')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('document_trips').insert({ document_id: documentId, trip_id: tripId })

  if (error)
    redirect(`${detailPath}?error=${encodeURIComponent('Zuordnung fehlgeschlagen: ' + error.message)}`)

  redirect(detailPath)
}

export async function unassignDocumentFromTrip(formData: FormData) {
  const documentId = String(formData.get('document_id') ?? '')
  const personId    = String(formData.get('person_id') ?? '')
  const tripId      = String(formData.get('trip_id') ?? '')
  const detailPath  = `/family/${personId}/documents/${documentId}`

  const supabase = await createClient()
  await supabase.from('document_trips').delete().eq('document_id', documentId).eq('trip_id', tripId)

  redirect(detailPath)
}

/**
 * Dokumenten-Hub §11: eine Buchungsunterlage (Flugticket, Hotel-Voucher,
 * Mietwagenunterlage, ...) gehört zur Buchung selbst, nicht zu einer Person —
 * `person_id` bleibt leer. Dieselbe Datei erscheint dadurch automatisch sowohl
 * auf der Buchungsdetailseite als auch im Dokumenten-Hub der Reise (kein
 * zweiter Upload, keine zweite Storage-Datei, nur eine gemeinsame Referenz).
 */
export async function uploadBookingDocument(formData: FormData) {
  const tripId    = String(formData.get('trip_id') ?? '')
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug      = String(formData.get('slug') ?? '')
  const label     = String(formData.get('label') ?? '').trim()
  const detailPath = `/trips/${slug}/bookings/${bookingId}`

  const { error: fileError, file } = validateFile(formData.get('file'), true)
  if (fileError)
    redirect(`${detailPath}?error=${encodeURIComponent(fileError)}`)
  if (!file)
    redirect(`${detailPath}?error=${encodeURIComponent('Datei fehlt')}`)
  if (label.length < 2)
    redirect(`${detailPath}?error=${encodeURIComponent('Dokumentname: mindestens 2 Zeichen erforderlich')}`)

  const supabase = await createClient()

  const storagePath = buildBookingStoragePath(bookingId, file.name)
  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type,
  })
  if (uploadError)
    redirect(`${detailPath}?error=${encodeURIComponent('Upload fehlgeschlagen: ' + uploadError.message)}`)

  const { error: insertError } = await supabase.from('documents').insert({
    trip_id: tripId,
    booking_id: bookingId,
    person_id: null,
    doc_type: 'booking_document',
    label,
    details: { source: 'manual' },
    storage_provider: 'supabase_storage',
    storage_bucket: 'documents',
    storage_path: storagePath,
  })

  if (insertError) {
    await supabase.storage.from('documents').remove([storagePath])
    redirect(`${detailPath}?error=${encodeURIComponent('Speicherfehler: ' + insertError.message)}`)
  }

  redirect(detailPath)
}

export async function deleteBookingDocument(formData: FormData) {
  const documentId  = String(formData.get('document_id') ?? '')
  const storagePath = String(formData.get('storage_path') ?? '')
  const slug        = String(formData.get('slug') ?? '')
  const bookingId   = String(formData.get('booking_id') ?? '')
  const detailPath  = `/trips/${slug}/bookings/${bookingId}`

  const supabase = await createClient()

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('documents').remove([storagePath])
    if (storageError)
      redirect(`${detailPath}?error=${encodeURIComponent('Datei konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error)
    redirect(`${detailPath}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(detailPath)
}

export async function deleteDocument(formData: FormData) {
  const documentId  = String(formData.get('document_id') ?? '')
  const personId    = String(formData.get('person_id') ?? '')
  const storagePath = String(formData.get('storage_path') ?? '')
  const returnTo    = String(formData.get('return_to') ?? '').trim()
  const detailPath  = `/family/${personId}/documents/${documentId}`

  const supabase = await createClient()

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('documents').remove([storagePath])
    // Abbrechen statt die DB-Zeile trotzdem zu löschen — sonst bliebe die Datei als
    // nicht mehr referenzierter Storage-Orphan zurück, unauffindbar für jeden Retry.
    if (storageError)
      redirect(`${detailPath}?error=${encodeURIComponent('Datei konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('documents').delete().eq('id', documentId)

  if (error)
    redirect(`${detailPath}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo || `/family/${personId}`)
}
