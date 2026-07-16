'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { MAX_SAVED_FLIGHTS_PER_ROUTE, buildRouteKey } from '@/lib/saved-flights-shared'
import type { FlightSearchOption } from '@/lib/flight-types'
import type { Json } from '@/lib/supabase/types'

function appendError(returnTo: string, error: string): string {
  const separator = returnTo.includes('?') ? '&' : '?'
  return `${returnTo}${separator}error=${encodeURIComponent(error)}`
}

/**
 * §"Auch an die Löschfunktion denken" (Nutzervorgabe): speichert eine
 * einzelne, bereits gefundene Flugverbindung aus einem laufenden Suchlauf
 * (`flight_search_cache`) -- lädt die vollen Angebotsdaten servereitig aus
 * dem Cache nach, statt sie über versteckte Formularfelder zu übertragen
 * (kein Manipulationsrisiko, kein sperriges Formular). `expiresAt` des
 * Angebots bleibt beim ursprünglichen Wert -- eine gemerkte Verbindung ist
 * eine Preis-/Verbindungs-Momentaufnahme zum Vergleich, kein weiterhin
 * buchbares Live-Angebot.
 */
export async function saveFlightOption(formData: FormData): Promise<void> {
  const searchKey = String(formData.get('search_key') ?? '')
  const optionId = String(formData.get('option_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/flights')

  if (!searchKey || !optionId) redirect(appendError(returnTo, 'Diese Verbindung konnte nicht gemerkt werden.'))

  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  const { data: cacheRow } = await supabase
    .from('flight_search_cache')
    .select('origin_codes, destination_code, departure_date, return_date, results')
    .eq('family_id', familyId)
    .eq('search_key', searchKey)
    .maybeSingle()
  if (!cacheRow) redirect(appendError(returnTo, 'Diese Suche ist nicht mehr verfügbar -- bitte erneut suchen.'))

  const options = (cacheRow.results as unknown as FlightSearchOption[]) ?? []
  const option = options.find((o) => o.id === optionId)
  if (!option) redirect(appendError(returnTo, 'Diese Verbindung wurde in der Suche nicht mehr gefunden.'))

  const routeKey = buildRouteKey(cacheRow.origin_codes, cacheRow.destination_code)

  const { data: existingSame } = await supabase
    .from('saved_flight_options')
    .select('id')
    .eq('family_id', familyId)
    .eq('route_key', routeKey)
    .eq('option_id', optionId)
    .maybeSingle()

  if (!existingSame) {
    const { count } = await supabase
      .from('saved_flight_options')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .eq('route_key', routeKey)
    if ((count ?? 0) >= MAX_SAVED_FLIGHTS_PER_ROUTE) {
      redirect(appendError(returnTo, `Für diese Strecke sind bereits ${MAX_SAVED_FLIGHTS_PER_ROUTE} Verbindungen gemerkt -- bitte zuerst eine löschen.`))
    }
  }

  const { error } = await supabase.from('saved_flight_options').upsert(
    {
      family_id: familyId, route_key: routeKey, origin_codes: cacheRow.origin_codes, destination_code: cacheRow.destination_code,
      option_id: optionId, flight_option: option as unknown as Json,
      found_departure_date: cacheRow.departure_date, found_return_date: cacheRow.return_date,
    },
    { onConflict: 'family_id,route_key,option_id' },
  )
  if (error) redirect(appendError(returnTo, 'Speichern fehlgeschlagen: ' + error.message))

  redirect(returnTo)
}

export async function deleteSavedFlightOption(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/flights')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id) await supabase.from('saved_flight_options').delete().eq('id', id).eq('family_id', familyId)

  redirect(returnTo)
}
