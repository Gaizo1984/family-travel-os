'use server'

import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
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

  const lumiCore = await createLumiCoreClient()

  for (const key of COMPASS_CATEGORY_ORDER) {
    const weightRaw = String(formData.get(`weight_${key}`) ?? '3')
    const weight = Math.min(5, Math.max(1, Number(weightRaw) || 3))
    const note = String(formData.get(`note_${key}`) ?? '').trim()

    const { error } = await lumiCore.from('travel_preference_categories').upsert({
      household_id: familyId,
      category_key: key,
      weight,
      note: note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'household_id,category_key' })

    if (error)
      redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler (Reisekompass): ' + error.message)}`)
  }

  const hotelCriteria = HOTEL_CRITERIA_OPTIONS
    .map((o) => o.key)
    .filter((key) => formData.get(`hotel_${key}`) === 'on')

  const { data: existingPrefs } = await lumiCore.from('app_preferences').select('settings').eq('household_id', familyId).maybeSingle()
  const settings = { ...(existingPrefs?.settings ?? {}), travel_exceptional_hotel_criteria: hotelCriteria }

  const { error: prefsError } = await lumiCore
    .from('app_preferences')
    .upsert({ household_id: familyId, settings, updated_at: new Date().toISOString() }, { onConflict: 'household_id' })

  if (prefsError)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler (Hotelkriterien): ' + prefsError.message)}`)

  redirect('/family')
}
