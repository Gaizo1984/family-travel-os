'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { MAX_SAVED_HOTELS_PER_DESTINATION } from '@/lib/saved-hotels-shared'
import type { HotelShortlistItem } from '@/lib/trip-idea-hotel-types'
import type { Json } from '@/lib/supabase/types'

function appendError(returnTo: string, error: string): string {
  const separator = returnTo.includes('?') ? '&' : '?'
  return `${returnTo}${separator}error=${encodeURIComponent(error)}`
}

/**
 * §"Echte Hotel-Merkfunktion ergänzen" (Nutzervorgabe, kombinierter
 * Fix-Sprint): 1:1 nach Vorbild von saveFlightOption -- lädt das volle
 * Hotel-Objekt servereitig aus dem bereits vorhandenen `hotel_search_cache`
 * nach (kein Manipulationsrisiko über versteckte Formularfelder), statt es
 * über den Client zu übertragen.
 */
export async function saveHotelOption(formData: FormData): Promise<void> {
  const searchKey = String(formData.get('search_key') ?? '')
  const optionId = String(formData.get('option_id') ?? '')
  const destination = String(formData.get('destination') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/hotels')

  if (!searchKey || !optionId) redirect(appendError(returnTo, 'Dieses Hotel konnte nicht gemerkt werden.'))

  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  const { data: cacheRow } = await supabase
    .from('hotel_search_cache')
    .select('destination, results')
    .eq('family_id', familyId)
    .eq('search_key', searchKey)
    .maybeSingle()
  if (!cacheRow) redirect(appendError(returnTo, 'Diese Suche ist nicht mehr verfügbar -- bitte erneut suchen.'))

  const options = (cacheRow.results as unknown as HotelShortlistItem[]) ?? []
  const option = options.find((o) => o.placeId === optionId)
  if (!option) redirect(appendError(returnTo, 'Dieses Hotel wurde in der Suche nicht mehr gefunden.'))

  const { data: existingSame } = await supabase
    .from('saved_hotel_options')
    .select('id')
    .eq('family_id', familyId)
    .eq('search_key', searchKey)
    .eq('option_id', optionId)
    .maybeSingle()

  if (!existingSame) {
    const { count } = await supabase
      .from('saved_hotel_options')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .eq('search_key', searchKey)
    if ((count ?? 0) >= MAX_SAVED_HOTELS_PER_DESTINATION) {
      redirect(appendError(returnTo, `Für dieses Ziel sind bereits ${MAX_SAVED_HOTELS_PER_DESTINATION} Hotels gemerkt -- bitte zuerst eines löschen.`))
    }
  }

  const { error } = await supabase.from('saved_hotel_options').upsert(
    {
      family_id: familyId, search_key: searchKey, destination: cacheRow.destination || destination,
      option_id: optionId, hotel_option: option as unknown as Json,
    },
    { onConflict: 'family_id,search_key,option_id' },
  )
  if (error) redirect(appendError(returnTo, 'Speichern fehlgeschlagen: ' + error.message))

  redirect(returnTo)
}

export async function deleteSavedHotelOption(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/hotels')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id) await supabase.from('saved_hotel_options').delete().eq('id', id).eq('family_id', familyId)

  redirect(returnTo)
}

/** §Phase B "Reise zuordnen" (Nutzervorgabe): setzt nur trip_id, keine Statusänderung -- gleiches Muster inkl. trips.family_id-Gegenprüfung wie assignTripToSavedFlightOption. */
export async function assignTripToSavedHotelOption(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/hotels')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id && tripId) {
    const { data: trip } = await supabase.from('trips').select('id').eq('id', tripId).eq('family_id', familyId).maybeSingle()
    if (trip) await supabase.from('saved_hotel_options').update({ trip_id: tripId }).eq('id', id).eq('family_id', familyId)
  }

  redirect(returnTo)
}

/** §Phase B "Ausgewählt ist eine Zwischenstufe" (Nutzervorgabe, wörtlich): nur möglich, wenn bereits eine Reise zugeordnet ist. */
export async function markSavedHotelOptionSelected(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/hotels')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id) {
    await supabase.from('saved_hotel_options').update({ status: 'selected' }).eq('id', id).eq('family_id', familyId).not('trip_id', 'is', null)
  }

  redirect(returnTo)
}

export async function unmarkSavedHotelOptionSelected(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/hotels')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id) await supabase.from('saved_hotel_options').update({ status: 'saved' }).eq('id', id).eq('family_id', familyId)

  redirect(returnTo)
}
