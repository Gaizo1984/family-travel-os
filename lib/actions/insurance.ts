'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, combineIsoDate } from '@/lib/documents'

function readDateGroup(formData: FormData, prefix: string, fieldLabel: string): string | null {
  const day   = String(formData.get(`${prefix}_day`) ?? '').trim()
  const month = String(formData.get(`${prefix}_month`) ?? '').trim()
  const year  = String(formData.get(`${prefix}_year`) ?? '').trim()
  return combineIsoDate(day, month, year, fieldLabel)
}

function buildPolicyStoragePath(policyId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'bin'
  return `insurance/${policyId}/${crypto.randomUUID()}.${ext}`
}

function validateFile(file: FormDataEntryValue | null): { error?: string; file?: File } {
  if (!(file instanceof File) || file.size === 0) return {}
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type))
    return { error: 'Nur Fotos (JPEG, PNG, WebP) oder PDF-Dateien sind erlaubt' }
  if (file.size > MAX_DOCUMENT_FILE_SIZE)
    return { error: 'Die Datei ist zu groß (maximal 10 MB)' }
  return { file }
}

function readCommonFields(formData: FormData) {
  const label            = String(formData.get('label') ?? '').trim()
  const provider         = String(formData.get('provider') ?? '').trim()
  const policyType       = String(formData.get('policy_type') ?? '').trim()
  const referenceNumber  = String(formData.get('reference_number') ?? '').trim()
  const emergencyContact = String(formData.get('emergency_contact') ?? '').trim()
  const notes            = String(formData.get('notes') ?? '').trim()
  const validFrom        = readDateGroup(formData, 'valid_from', 'Gültig ab')
  const validTo          = readDateGroup(formData, 'valid_to', 'Gültig bis')
  const personIds        = formData.getAll('persons').map(String)
  const file             = formData.get('file')
  const assignTrip       = String(formData.get('assign_trip') ?? '').trim()
  const returnTo         = String(formData.get('return_to') ?? '').trim()

  return { label, provider, policyType, referenceNumber, emergencyContact, notes, validFrom, validTo, personIds, file, assignTrip, returnTo }
}

export async function createInsurancePolicy(formData: FormData) {
  const newPath = '/family/insurance/new'

  let f: ReturnType<typeof readCommonFields>
  try {
    f = readCommonFields(formData)
  } catch (e) {
    redirect(`${newPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (f.label.length < 2)
    redirect(`${newPath}?error=${encodeURIComponent('Name: mindestens 2 Zeichen erforderlich')}`)

  const { error: fileError, file } = validateFile(f.file)
  if (fileError)
    redirect(`${newPath}?error=${encodeURIComponent(fileError)}`)

  const supabase = await createClient()

  const { data: family } = await supabase.from('families').select('id').limit(1).single()
  if (!family?.id)
    redirect(`${newPath}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  const { data: policy, error: insertError } = await supabase
    .from('insurance_policies')
    .insert({
      family_id: family.id,
      label: f.label,
      provider: f.provider || null,
      policy_type: f.policyType || null,
      reference_number: f.referenceNumber || null,
      valid_from: f.validFrom,
      valid_to: f.validTo,
      emergency_contact: f.emergencyContact || null,
      notes: f.notes || null,
    })
    .select('id')
    .single()

  if (insertError || !policy)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (insertError?.message ?? 'Unbekannt'))}`)

  if (f.personIds.length > 0)
    await supabase.from('insurance_policy_persons').insert(
      f.personIds.map((person_id) => ({ policy_id: policy.id, person_id }))
    )

  if (file) {
    const storagePath = buildPolicyStoragePath(policy.id, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type,
    })
    if (!uploadError)
      await supabase.from('insurance_policies')
        .update({ storage_bucket: 'documents', storage_path: storagePath })
        .eq('id', policy.id)
  }

  if (f.assignTrip)
    await supabase.from('insurance_policy_trips').insert({ policy_id: policy.id, trip_id: f.assignTrip })

  redirect(f.returnTo || `/family/insurance/${policy.id}`)
}

export async function updateInsurancePolicy(formData: FormData) {
  const policyId = String(formData.get('policy_id') ?? '')
  const editPath = `/family/insurance/${policyId}/edit`

  let f: ReturnType<typeof readCommonFields>
  try {
    f = readCommonFields(formData)
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Datum')}`)
  }

  if (f.label.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Name: mindestens 2 Zeichen erforderlich')}`)

  const { error: fileError, file } = validateFile(f.file)
  if (fileError)
    redirect(`${editPath}?error=${encodeURIComponent(fileError)}`)

  const supabase = await createClient()

  const update: {
    label: string
    provider: string | null
    policy_type: string | null
    reference_number: string | null
    valid_from: string | null
    valid_to: string | null
    emergency_contact: string | null
    notes: string | null
    storage_bucket?: string
    storage_path?: string
  } = {
    label: f.label,
    provider: f.provider || null,
    policy_type: f.policyType || null,
    reference_number: f.referenceNumber || null,
    valid_from: f.validFrom,
    valid_to: f.validTo,
    emergency_contact: f.emergencyContact || null,
    notes: f.notes || null,
  }

  if (file) {
    const { data: existing } = await supabase
      .from('insurance_policies').select('storage_path').eq('id', policyId).maybeSingle()

    const storagePath = buildPolicyStoragePath(policyId, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
      contentType: file.type,
    })
    if (uploadError)
      redirect(`${editPath}?error=${encodeURIComponent('Upload fehlgeschlagen: ' + uploadError.message)}`)

    update.storage_bucket = 'documents'
    update.storage_path = storagePath
    if (existing?.storage_path) await supabase.storage.from('documents').remove([existing.storage_path])
  }

  const { error } = await supabase.from('insurance_policies').update(update).eq('id', policyId)
  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  await supabase.from('insurance_policy_persons').delete().eq('policy_id', policyId)
  if (f.personIds.length > 0)
    await supabase.from('insurance_policy_persons').insert(
      f.personIds.map((person_id) => ({ policy_id: policyId, person_id }))
    )

  redirect(`/family/insurance/${policyId}`)
}

export async function deleteInsurancePolicy(formData: FormData) {
  const policyId    = String(formData.get('policy_id') ?? '')
  const storagePath = String(formData.get('storage_path') ?? '')

  const supabase = await createClient()

  if (storagePath) await supabase.storage.from('documents').remove([storagePath])

  const { error } = await supabase.from('insurance_policies').delete().eq('id', policyId)
  if (error)
    redirect(`/family/insurance/${policyId}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect('/family/insurance')
}

export async function assignPolicyToTrip(formData: FormData) {
  const policyId  = String(formData.get('policy_id') ?? '')
  const tripId    = String(formData.get('trip_id') ?? '')
  const returnTo  = String(formData.get('return_to') ?? '').trim()
  const detailPath = returnTo || `/family/insurance/${policyId}`

  if (!tripId)
    redirect(`${detailPath}?error=${encodeURIComponent('Bitte eine Reise auswählen')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('insurance_policy_trips').insert({ policy_id: policyId, trip_id: tripId })

  if (error)
    redirect(`${detailPath}?error=${encodeURIComponent('Zuordnung fehlgeschlagen: ' + error.message)}`)

  redirect(detailPath)
}

export async function unassignPolicyFromTrip(formData: FormData) {
  const policyId = String(formData.get('policy_id') ?? '')
  const tripId   = String(formData.get('trip_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const detailPath = returnTo || `/family/insurance/${policyId}`

  const supabase = await createClient()
  await supabase.from('insurance_policy_trips').delete().eq('policy_id', policyId).eq('trip_id', tripId)

  redirect(detailPath)
}
