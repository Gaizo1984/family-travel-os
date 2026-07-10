'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { COMPASS_CATEGORY_ORDER, HOTEL_CRITERIA_OPTIONS } from '@/lib/family-dna'

/**
 * Speichert alle Reisekompass-Kategorien und die Hotelkriterien in einem
 * gemeinsamen Save (ein Formular, zwei zusammengehörige Konzepte der
 * Familien-Travel-DNA). Gewichte 1–5, Notiz frei editierbar.
 */
export async function saveFamilyCompass(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const editPath = '/family/compass/edit'

  const supabase = await createClient()

  for (const key of COMPASS_CATEGORY_ORDER) {
    const weightRaw = String(formData.get(`weight_${key}`) ?? '3')
    const weight = Math.min(5, Math.max(1, Number(weightRaw) || 3))
    const note = String(formData.get(`note_${key}`) ?? '').trim()

    const { error } = await supabase.from('family_preference_categories').upsert({
      family_id: familyId,
      category_key: key,
      weight,
      note: note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'family_id,category_key' })

    if (error)
      redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler (Reisekompass): ' + error.message)}`)
  }

  const hotelCriteria = HOTEL_CRITERIA_OPTIONS
    .map((o) => o.key)
    .filter((key) => formData.get(`hotel_${key}`) === 'on')

  const { error: familyError } = await supabase
    .from('families')
    .update({ exceptional_hotel_criteria: hotelCriteria })
    .eq('id', familyId)

  if (familyError)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler (Hotelkriterien): ' + familyError.message)}`)

  redirect('/family')
}
