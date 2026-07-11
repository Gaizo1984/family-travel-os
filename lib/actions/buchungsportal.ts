'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { JourneyEventCategory } from '@/lib/journey-events'

/**
 * §"Keine Buchungslogik integrieren, nur Merken": exakt wie Concierge's
 * `commitConciergeAction` (lib/actions/concierge-actions.ts) — ein bewusster
 * Klick legt eine echte `journey_events`-Zeile mit `status:'idea'` an, die
 * die Familie später wie jeden anderen Termin bearbeiten kann.
 */
export async function saveToWishlist(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const date = String(formData.get('date') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const category = String(formData.get('category') ?? 'note') as JourneyEventCategory

  if (!tripId || !date || !title) redirect('/buchungsportal?error=' + encodeURIComponent('Konnte nicht gemerkt werden'))

  const supabase = await createClient()
  const { error } = await supabase.from('journey_events').insert({
    trip_id: tripId,
    date,
    category,
    title,
    status: 'idea',
  })

  if (error) redirect('/buchungsportal?error=' + encodeURIComponent('Speicherfehler: ' + error.message))
  redirect('/buchungsportal?saved=' + encodeURIComponent(title))
}
