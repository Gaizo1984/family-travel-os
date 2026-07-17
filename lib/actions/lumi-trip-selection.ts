'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * §"Auswahl der zuletzt verwendeten Reise nur für diesen Nutzer bzw. diese
 * Familie speichern" (Nutzervorgabe, wörtlich): bewusst KEIN Cookie -- ein
 * Browser-Cookie würde bei mehreren Familienmitgliedern/Geräten falsch
 * geteilt oder verloren gehen. Stattdessen `families.last_lumi_trip_id`
 * (Migration 20260723000001), serverseitig über RLS an die eingeloggte
 * Familie gebunden, geräteübergreifend gültig.
 */
export async function selectLumiBrainTrip(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const slug = String(formData.get('slug') ?? '').trim()
  const returnToBase = String(formData.get('return_to_base') ?? '').trim() || '/concierge'

  if (!familyId) redirect(returnToBase)

  if (!slug) {
    redirect(`${returnToBase}?scope=general`)
  }

  const supabase = await createClient()
  const { data: trip } = await supabase
    .from('trips')
    .select('id, slug')
    .eq('family_id', familyId)
    .eq('slug', slug)
    .maybeSingle()

  if (trip) {
    await supabase.from('families').update({ last_lumi_trip_id: trip.id }).eq('id', familyId)
  }

  redirect(`${returnToBase}?trip=${encodeURIComponent(slug)}`)
}
