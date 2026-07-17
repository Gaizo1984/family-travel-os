'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE } from '@/lib/documents'
import { TRAVEL_NEED_OPTIONS } from '@/lib/family-dna'

function buildProfilePhotoPath(personId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'jpg'
  return `profile-photos/${personId}/${crypto.randomUUID()}.${ext}`
}

export async function updatePersonProfile(formData: FormData) {
  const personId    = String(formData.get('person_id') ?? '')
  const name        = String(formData.get('name') ?? '').trim()
  const roleLabel   = String(formData.get('role_label') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const tagsRaw      = String(formData.get('interest_tags') ?? '').trim()
  const birthDateRaw = String(formData.get('birth_date') ?? '').trim()
  const isMinor     = formData.get('is_minor') === 'on'
  const returnTo    = String(formData.get('return_to') ?? '').trim()
  const editPath    = `/family/${personId}/edit`

  const travelNeeds = TRAVEL_NEED_OPTIONS
    .map((o) => o.key)
    .filter((key) => formData.get(`need_${key}`) === 'on')

  const interestTags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  if (name.length < 1)
    redirect(`${editPath}?error=${encodeURIComponent('Name darf nicht leer sein')}`)

  const supabase = await createClient()

  const update: {
    name: string; role_label: string | null; description: string | null
    interest_tags: string[]; travel_needs: string[]; photo_storage_path?: string
    birth_date: string | null; is_minor: boolean
  } = {
    name,
    role_label: roleLabel || null,
    description: description || null,
    interest_tags: interestTags,
    travel_needs: travelNeeds,
    birth_date: birthDateRaw || null,
    is_minor: isMinor,
  }

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) || file.type === 'application/pdf')
      redirect(`${editPath}?error=${encodeURIComponent('Bitte ein Foto (JPEG, PNG oder WebP) auswählen.')}`)
    if (file.size > MAX_DOCUMENT_FILE_SIZE)
      redirect(`${editPath}?error=${encodeURIComponent('Die Datei ist zu groß (maximal 10 MB).')}`)

    const { data: existing } = await supabase.from('persons').select('photo_storage_path').eq('id', personId).maybeSingle()

    const newPath = buildProfilePhotoPath(personId, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(newPath, file, { contentType: file.type, cacheControl: '31536000' })
    if (uploadError)
      redirect(`${editPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: ' + uploadError.message)}`)

    if (existing?.photo_storage_path) {
      // Altes Foto erst nach erfolgreichem Upload des neuen entfernen — nie
      // verwaist im Storage lassen, aber auch nie das neue Foto riskieren.
      await supabase.storage.from('documents').remove([existing.photo_storage_path])
    }

    update.photo_storage_path = newPath
  }

  const { error } = await supabase.from('persons').update(update).eq('id', personId)
  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(returnTo || `/family/${personId}`)
}
