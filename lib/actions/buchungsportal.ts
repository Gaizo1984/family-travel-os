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

/**
 * Gegenstück zu saveToWishlist — entfernt einen gemerkten Eintrag wieder
 * (echtes Löschen der journey_events-Zeile, kein Status-Flag). Nach dem
 * Redirect fällt der WishlistButton automatisch zurück auf "Zur Merkliste".
 */
export async function removeFromWishlist(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '')
  const title = String(formData.get('title') ?? '').trim()

  if (!eventId) redirect('/buchungsportal?error=' + encodeURIComponent('Konnte nicht entfernt werden'))

  const supabase = await createClient()
  const { error } = await supabase.from('journey_events').delete().eq('id', eventId)

  if (error) redirect('/buchungsportal?error=' + encodeURIComponent('Löschfehler: ' + error.message))
  redirect('/buchungsportal?removed=' + encodeURIComponent(title))
}
