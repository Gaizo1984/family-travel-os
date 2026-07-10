'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updateContentStylePreference(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const toneRaw = String(formData.get('tone') ?? '').trim()
  const voiceDescription = String(formData.get('voice_description') ?? '').trim()
  const hashtagStyle = String(formData.get('hashtag_style') ?? 'minimal').trim()
  const defaultVisibility = String(formData.get('default_visibility') ?? 'private').trim()
  const avoidRaw = String(formData.get('avoid') ?? '').trim()

  const supabase = await createClient()

  const contentStylePreference = {
    tone: toneRaw ? toneRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    voice_description: voiceDescription || null,
    hashtag_style: hashtagStyle,
    default_visibility: defaultVisibility,
    avoid: avoidRaw ? avoidRaw.split(',').map((a) => a.trim()).filter(Boolean) : [],
  }

  const { error } = await supabase.from('families').update({ content_style_preference: contentStylePreference }).eq('id', familyId)

  if (error)
    redirect(`/content-studio/settings?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect('/content-studio')
}
