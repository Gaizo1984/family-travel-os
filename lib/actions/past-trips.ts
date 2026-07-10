'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE } from '@/lib/documents'
import { suggestCountryCode } from '@/lib/geo-suggestions'

function buildPastTripPhotoPath(pastTripId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'jpg'
  return `past-trips/${pastTripId}/${crypto.randomUUID()}.${ext}`
}

function readCommonFields(formData: FormData) {
  const countryOrRegion = String(formData.get('country_or_region') ?? '').trim()
  const yearRaw = String(formData.get('year') ?? '').trim()
  const places = String(formData.get('places') ?? '').trim()
  const durationRaw = String(formData.get('duration_days') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  const travelerIds = formData.getAll('traveler_ids').map(String)

  const year = yearRaw ? Number(yearRaw) : null
  const durationDays = durationRaw ? Number(durationRaw) : null

  return { countryOrRegion, year, yearRaw, places, durationDays, durationRaw, note, travelerIds }
}

export async function createPastTrip(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const newPath = '/family/history/new'
  const f = readCommonFields(formData)

  if (f.countryOrRegion.length < 2)
    redirect(`${newPath}?error=${encodeURIComponent('Land/Region: mindestens 2 Zeichen erforderlich')}`)
  if (!f.yearRaw || f.year === null || Number.isNaN(f.year) || f.year < 1950 || f.year > new Date().getFullYear() + 1)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte ein gültiges Jahr angeben')}`)

  const supabase = await createClient()
  const countryCode = suggestCountryCode(`${f.countryOrRegion} ${f.places}`)

  const { data: pastTrip, error } = await supabase.from('past_trips').insert({
    family_id: familyId,
    country_or_region: f.countryOrRegion,
    country_code: countryCode,
    year: f.year,
    places: f.places || null,
    duration_days: f.durationDays,
    note: f.note || null,
  }).select('id').single()

  if (error || !pastTrip)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  if (f.travelerIds.length > 0) {
    await supabase.from('past_trip_travelers').insert(
      f.travelerIds.map((personId) => ({ past_trip_id: pastTrip.id, person_id: personId })),
    )
  }

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) || file.type === 'application/pdf') {
      redirect(`/family/history/${pastTrip.id}/edit?error=${encodeURIComponent('Bitte ein Foto (JPEG, PNG oder WebP) auswählen.')}`)
    }
    if (file.size > MAX_DOCUMENT_FILE_SIZE) {
      redirect(`/family/history/${pastTrip.id}/edit?error=${encodeURIComponent('Die Datei ist zu groß (maximal 10 MB).')}`)
    }
    const photoPath = buildPastTripPhotoPath(pastTrip.id, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(photoPath, file, { contentType: file.type })
    if (!uploadError) {
      await supabase.from('past_trips').update({ photo_storage_path: photoPath }).eq('id', pastTrip.id)
    }
  }

  redirect('/family/history')
}

export async function updatePastTrip(formData: FormData) {
  const pastTripId = String(formData.get('past_trip_id') ?? '')
  const editPath = `/family/history/${pastTripId}/edit`
  const f = readCommonFields(formData)

  if (f.countryOrRegion.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Land/Region: mindestens 2 Zeichen erforderlich')}`)
  if (!f.yearRaw || f.year === null || Number.isNaN(f.year) || f.year < 1950 || f.year > new Date().getFullYear() + 1)
    redirect(`${editPath}?error=${encodeURIComponent('Bitte ein gültiges Jahr angeben')}`)

  const supabase = await createClient()
  const countryCode = suggestCountryCode(`${f.countryOrRegion} ${f.places}`)

  const { error } = await supabase.from('past_trips').update({
    country_or_region: f.countryOrRegion,
    country_code: countryCode,
    year: f.year,
    places: f.places || null,
    duration_days: f.durationDays,
    note: f.note || null,
  }).eq('id', pastTripId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  await supabase.from('past_trip_travelers').delete().eq('past_trip_id', pastTripId)
  if (f.travelerIds.length > 0) {
    await supabase.from('past_trip_travelers').insert(
      f.travelerIds.map((personId) => ({ past_trip_id: pastTripId, person_id: personId })),
    )
  }

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) || file.type === 'application/pdf')
      redirect(`${editPath}?error=${encodeURIComponent('Bitte ein Foto (JPEG, PNG oder WebP) auswählen.')}`)
    if (file.size > MAX_DOCUMENT_FILE_SIZE)
      redirect(`${editPath}?error=${encodeURIComponent('Die Datei ist zu groß (maximal 10 MB).')}`)

    const { data: existing } = await supabase.from('past_trips').select('photo_storage_path').eq('id', pastTripId).maybeSingle()
    const photoPath = buildPastTripPhotoPath(pastTripId, file.name)
    const { error: uploadError } = await supabase.storage.from('documents').upload(photoPath, file, { contentType: file.type })
    if (uploadError)
      redirect(`${editPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: ' + uploadError.message)}`)

    if (existing?.photo_storage_path) {
      await supabase.storage.from('documents').remove([existing.photo_storage_path])
    }
    await supabase.from('past_trips').update({ photo_storage_path: photoPath }).eq('id', pastTripId)
  }

  redirect('/family/history')
}

export async function deletePastTrip(formData: FormData) {
  const pastTripId = String(formData.get('past_trip_id') ?? '')
  const photoStoragePath = String(formData.get('photo_storage_path') ?? '').trim()

  const supabase = await createClient()

  if (photoStoragePath) {
    const { error: storageError } = await supabase.storage.from('documents').remove([photoStoragePath])
    // Abbrechen statt trotzdem zu löschen — sonst bliebe das Foto als
    // nicht mehr referenzierter Storage-Orphan zurück.
    if (storageError)
      redirect(`/family/history/${pastTripId}/edit?error=${encodeURIComponent('Foto konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('past_trips').delete().eq('id', pastTripId)
  if (error)
    redirect(`/family/history/${pastTripId}/edit?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect('/family/history')
}
