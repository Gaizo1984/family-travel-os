'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { compressImageForStorage } from '@/lib/image-compression'

const MAX_PHOTOS_PER_UPLOAD = 20

export async function uploadMemoryPhotos(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '').trim() || null
  const uploadedByPersonId = String(formData.get('uploaded_by_person_id') ?? '').trim() || null
  const takenAt = String(formData.get('taken_at') ?? '').trim() || null
  const caption = String(formData.get('caption') ?? '').trim() || null

  const backPath = '/memories'

  if (!familyId) redirect(`${backPath}?error=${encodeURIComponent('Familie nicht gefunden')}`)

  const rawFiles = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (rawFiles.length === 0)
    redirect(`${backPath}?error=${encodeURIComponent('Bitte mindestens ein Foto auswählen.')}`)
  if (rawFiles.length > MAX_PHOTOS_PER_UPLOAD)
    redirect(`${backPath}?error=${encodeURIComponent(`Maximal ${MAX_PHOTOS_PER_UPLOAD} Fotos pro Upload.`)}`)

  for (const f of rawFiles) {
    if (!f.type.startsWith('image/'))
      redirect(`${backPath}?error=${encodeURIComponent('Nur Fotos werden unterstützt (JPEG, PNG, WebP).')}`)
    if (f.size > 15 * 1024 * 1024)
      redirect(`${backPath}?error=${encodeURIComponent('Mindestens eine Datei ist zu groß (maximal 15 MB pro Foto).')}`)
  }

  const supabase = await createClient()

  for (const file of rawFiles) {
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const compressed = await compressImageForStorage(rawBuffer)
    const storagePath = `memories/${familyId}/${crypto.randomUUID()}.webp`

    const { error: uploadError } = await supabase.storage.from('documents')
      .upload(storagePath, compressed, { contentType: 'image/webp' })
    if (uploadError)
      redirect(`${backPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: ' + uploadError.message)}`)

    const { error: insertError } = await supabase.from('memory_photos').insert({
      family_id: familyId,
      trip_id: tripId,
      uploaded_by_person_id: uploadedByPersonId,
      storage_path: storagePath,
      taken_at: takenAt,
      caption,
    })
    if (insertError) {
      await supabase.storage.from('documents').remove([storagePath])
      redirect(`${backPath}?error=${encodeURIComponent('Speicherfehler: ' + insertError.message)}`)
    }
  }

  redirect(`${backPath}?uploaded=${rawFiles.length}`)
}

/** Gehärtetes Löschmuster wie lib/actions/documents.ts: Storage zuerst, DB-Zeile nur bei Erfolg. */
export async function deleteMemoryPhoto(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/memories'

  const supabase = await createClient()
  const { data: photo } = await supabase.from('memory_photos').select('storage_path').eq('id', photoId).maybeSingle()

  if (photo?.storage_path) {
    const { error: storageError } = await supabase.storage.from('documents').remove([photo.storage_path])
    if (storageError)
      redirect(`${returnTo}?error=${encodeURIComponent('Datei konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('memory_photos').delete().eq('id', photoId)
  if (error)
    redirect(`${returnTo}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo)
}

export async function toggleMemoryHighlight(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const nextValue = formData.get('next_value') === 'true'
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/memories'

  const supabase = await createClient()
  await supabase.from('memory_photos').update({ is_highlight: nextValue }).eq('id', photoId)

  redirect(returnTo)
}
