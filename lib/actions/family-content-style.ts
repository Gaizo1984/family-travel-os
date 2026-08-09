'use server'

import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { redirect } from 'next/navigation'

/**
 * FINALER CUTOVER, Schema-Luecken-Schliessung: `content_style_preference`
 * hat kein eigenes Lumi-Core-Kernschema-Aequivalent, braucht aber auch
 * keine neue Tabelle/Spalte -- der bereits bestehende, App-uebergreifende
 * Einstellungs-Container `app_preferences.settings` (ein JSONB-Feld pro
 * Household) nimmt sie unter dem Schluessel `travel_content_style_preference`
 * auf ("bestehendes Core-Konzept bevorzugen", Nutzervorgabe). Read-modify-
 * write statt eines rohen jsonb-Merge-Ausdrucks, damit Einstellungen
 * anderer Apps unter anderen Schluesseln im selben JSON nie ueberschrieben
 * werden.
 */
export async function updateContentStylePreference(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const toneRaw = String(formData.get('tone') ?? '').trim()
  const voiceDescription = String(formData.get('voice_description') ?? '').trim()
  const hashtagStyle = String(formData.get('hashtag_style') ?? 'minimal').trim()
  const defaultVisibility = String(formData.get('default_visibility') ?? 'private').trim()
  const avoidRaw = String(formData.get('avoid') ?? '').trim()

  const lumiCore = await createLumiCoreClient()

  const contentStylePreference = {
    tone: toneRaw ? toneRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    voice_description: voiceDescription || null,
    hashtag_style: hashtagStyle,
    default_visibility: defaultVisibility,
    avoid: avoidRaw ? avoidRaw.split(',').map((a) => a.trim()).filter(Boolean) : [],
  }

  const { data: existing } = await lumiCore.from('app_preferences').select('settings').eq('household_id', familyId).maybeSingle()
  const settings = { ...(existing?.settings ?? {}), travel_content_style_preference: contentStylePreference }

  const { error } = await lumiCore
    .from('app_preferences')
    .upsert({ household_id: familyId, settings, updated_at: new Date().toISOString() }, { onConflict: 'household_id' })

  if (error)
    redirect(`/content-studio/settings?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect('/content-studio')
}
