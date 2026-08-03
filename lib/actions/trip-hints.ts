'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * §"Als erledigt markieren"/"Ausblenden" (Nutzervorgabe): reine Status-
 * Übergänge auf bereits vom Cron generierten Hinweisen (lib/hint-generation.ts)
 * -- RLS (family_members_only, Migration 20260802000001_trip_hints.sql)
 * übernimmt die Familienzugehörigkeitsprüfung, kein zusätzlicher
 * .eq('family_id', ...) hier nötig.
 */
export async function dismissTripHint(formData: FormData) {
  const hintId = String(formData.get('hint_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today')

  const supabase = await createClient()
  await supabase.from('trip_hints').update({ status: 'dismissed', dismissed_at: new Date().toISOString() }).eq('id', hintId)

  revalidatePath(returnTo)
}

export async function completeTripHint(formData: FormData) {
  const hintId = String(formData.get('hint_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today')

  const supabase = await createClient()
  await supabase.from('trip_hints').update({ status: 'completed' }).eq('id', hintId)

  revalidatePath(returnTo)
}
