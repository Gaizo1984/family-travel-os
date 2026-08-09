'use server'

import { redirect } from 'next/navigation'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

/**
 * §"Auswahl der zuletzt verwendeten Reise nur für diesen Nutzer bzw. diese
 * Familie speichern" (Nutzervorgabe, wörtlich): bewusst KEIN Cookie -- ein
 * Browser-Cookie würde bei mehreren Familienmitgliedern/Geräten falsch
 * geteilt oder verloren gehen. `households.last_lumi_trip_id` ist jetzt eine
 * echte, native FK auf `travel_trips(id)` (Schema-Lücken-Schliessung,
 * FINALER CUTOVER-Nachtrag) -- beide Tabellen leben im selben Lumi-Core-
 * Projekt, die frühere Travel-FK-Problematik (neue, nach dem Cutover
 * angelegte Reisen existierten nur in Lumi Core) besteht nicht mehr.
 */
export async function selectLumiBrainTrip(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const slug = String(formData.get('slug') ?? '').trim()
  const returnToBase = String(formData.get('return_to_base') ?? '').trim() || '/concierge'

  if (!familyId) redirect(returnToBase)

  if (!slug) {
    redirect(`${returnToBase}?scope=general`)
  }

  const lumiCore = await createLumiCoreClient()
  const { data: trip } = await lumiCore.from('travel_trips').select('id').eq('household_id', familyId).eq('slug', slug).maybeSingle()
  if (trip) {
    await lumiCore.from('households').update({ last_lumi_trip_id: trip.id }).eq('id', familyId)
  }

  redirect(`${returnToBase}?trip=${encodeURIComponent(slug)}`)
}
