'use server'

import { redirect } from 'next/navigation'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'
import { toProfilePhotoPath, LUMI_CORE_PROFILE_PHOTOS_BUCKET } from '@/lib/lumi-core-storage/paths'
import { uploadToLumiCore, removeFromLumiCore } from '@/lib/lumi-core-storage/client'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE, readDateGroupFromFormData } from '@/lib/documents'
import { TRAVEL_NEED_OPTIONS } from '@/lib/family-dna'

/**
 * §ID-Space: `person_id` ist die echte Lumi-Core household_member_id
 * (household_members ist die Core-Wahrheit, siehe /family/[personId]-Routen).
 * name/birth_date/is_minor/avatar liegen bereits nativ auf household_members;
 * role_label/description/interest_tags/travel_needs (kein Lumi-Core-
 * Kernschema-Aequivalent, rein Travel-spezifisch) liegen in der Zusatztabelle
 * travel_household_member_profiles (1:1 zu household_members).
 */
export async function updatePersonProfile(formData: FormData) {
  const householdMemberId = String(formData.get('person_id') ?? '')
  const name        = String(formData.get('name') ?? '').trim()
  const roleLabel   = String(formData.get('role_label') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const tagsRaw      = String(formData.get('interest_tags') ?? '').trim()
  const isMinor     = formData.get('is_minor') === 'on'
  const returnTo    = String(formData.get('return_to') ?? '').trim()
  const editPath    = `/family/${householdMemberId}/edit`

  if (!householdMemberId) redirect(`${editPath}?error=${encodeURIComponent('Person nicht gefunden.')}`)

  // §"Identische Datumsmatrix wie z.B. beim Flugvergleich verwenden"
  // (Nutzervorgabe): DateSelectFields liefert drei Felder (_day/_month/_year)
  // statt eines einzelnen `birth_date`-Werts -- readDateGroupFromFormData ist
  // dieselbe Hilfsfunktion, die auch Dokumente/Reisen/Etappen nutzen.
  let birthDate: string | null
  try {
    birthDate = readDateGroupFromFormData(formData, 'birth_date', 'Geburtsdatum')
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : 'Ungültiges Geburtsdatum')}`)
  }

  const travelNeeds = TRAVEL_NEED_OPTIONS
    .map((o) => o.key)
    .filter((key) => formData.get(`need_${key}`) === 'on')

  const interestTags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  if (name.length < 1)
    redirect(`${editPath}?error=${encodeURIComponent('Name darf nicht leer sein')}`)

  const lumiCore = await createLumiCoreClient()
  const { id: householdId } = await getFamily()

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) || file.type === 'application/pdf')
      redirect(`${editPath}?error=${encodeURIComponent('Bitte ein Foto (JPEG, PNG oder WebP) auswählen.')}`)
    if (file.size > MAX_DOCUMENT_FILE_SIZE)
      redirect(`${editPath}?error=${encodeURIComponent('Die Datei ist zu groß (maximal 10 MB).')}`)

    const { data: existing } = await lumiCore.from('household_members').select('avatar_storage_path').eq('id', householdMemberId).maybeSingle()

    const newPath = await toProfilePhotoPath(householdMemberId, file.name)
    if (!newPath) redirect(`${editPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: Household nicht ermittelbar.')}`)

    const { error: uploadError } = await uploadToLumiCore(LUMI_CORE_PROFILE_PHOTOS_BUCKET, newPath, file, { contentType: file.type })
    if (uploadError)
      redirect(`${editPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: ' + uploadError)}`)

    if (existing?.avatar_storage_path) {
      // Altes Foto erst nach erfolgreichem Upload des neuen entfernen — nie
      // verwaist im Storage lassen, aber auch nie das neue Foto riskieren.
      await removeFromLumiCore(LUMI_CORE_PROFILE_PHOTOS_BUCKET, [existing.avatar_storage_path])
    }

    await lumiCore.from('household_members').update({ avatar_storage_path: newPath }).eq('id', householdMemberId)
  }

  const { error: memberError } = await lumiCore
    .from('household_members')
    .update({ name, birth_date: birthDate, is_minor: isMinor })
    .eq('id', householdMemberId)
  if (memberError)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + memberError.message)}`)

  const { error: profileError } = await lumiCore
    .from('travel_household_member_profiles')
    .upsert(
      {
        household_id: householdId,
        household_member_id: householdMemberId,
        role_label: roleLabel || null,
        description: description || null,
        interest_tags: interestTags,
        travel_needs: travelNeeds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_member_id' },
    )
  if (profileError)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + profileError.message)}`)

  redirect(returnTo || `/family/${householdMemberId}`)
}
