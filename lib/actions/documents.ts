'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, buildStoragePath, combineIsoDate } from '@/lib/documents'
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

  const details: DocumentDetails = { source: 'manual' }
  const firstName      = String(formData.get('first_name') ?? '').trim()
  const lastName       = String(formData.get('last_name') ?? '').trim()
  const birthDate      = readDateGroup(formData, 'birth_date', 'Geburtsdatum')
  const passportNumber = String(formData.get('passport_number') ?? '').trim()
  const issuingCountry = String(formData.get('issuing_country') ?? '').trim()
  const issueDate      = readDateGroup(formData, 'issue_date', 'Ausstellungsdatum')
  const approvalStatus = String(formData.get('approval_status') ?? '').trim()
  if (firstName) details.first_name = firstName
  if (lastName) details.last_name = lastName
  if (birthDate) details.birth_date = birthDate
  if (passportNumber) details.passport_number = passportNumber
  if (issuingCountry) details.issuing_country = issuingCountry
  if (issueDate) details.issue_date = issueDate
  if (approvalStatus === 'pending' || approvalStatus === 'approved') details.approval_status = approvalStatus

  const file = formData.get('file')

  return { personId, docType, label, expiresAt, notes, returnTo, assignTrip, details, file }
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

  const { error: fileError, file } = validateFile(f.file, true)
  if (fileError || !file)
    redirect(`${newPath}&error=${encodeURIComponent(fileError ?? 'Datei fehlt')}`)

  const supabase = await createClient()
  const storagePath = buildStoragePath(f.personId, file.name)

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type,
  })
  if (uploadError)
    redirect(`${newPath}&error=${encodeURIComponent('Upload fehlgeschlagen: ' + uploadError.message)}`)

  const { data: inserted, error: insertError } = await supabase
    .from('documents')
    .insert({
      person_id: f.personId,
      doc_type: f.docType,
      label: f.label,
      expires_at: f.expiresAt || null,
      notes: f.notes || null,
      details: f.details,
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
    details: f.details,
  }

  if (file) {
    const { data: existing } = await supabase
      .from('documents').select('storage_path').eq('id', documentId).maybeSingle()

    const storagePath = buildStoragePath(f.personId, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type,
    })
    if (uploadError)
      redirect(`${editPath}?error=${encodeURIComponent('Upload fehlgeschlagen: ' + uploadError.message)}`)

    update.storage_path = storagePath
    if (existing?.storage_path) await supabase.storage.from('documents').remove([existing.storage_path])
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

export async function deleteDocument(formData: FormData) {
  const documentId  = String(formData.get('document_id') ?? '')
  const personId    = String(formData.get('person_id') ?? '')
  const storagePath = String(formData.get('storage_path') ?? '')
  const returnTo    = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()

  if (storagePath) await supabase.storage.from('documents').remove([storagePath])

  const { error } = await supabase.from('documents').delete().eq('id', documentId)

  if (error)
    redirect(`/family/${personId}/documents/${documentId}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo || `/family/${personId}`)
}
