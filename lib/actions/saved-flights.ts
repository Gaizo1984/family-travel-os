'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { getOrSearchFlightOptions, type FlightSearchOutcome } from '@/lib/actions/flight-search'
import { ProviderConfigError, ProviderRequestError, describeProviderError } from '@/lib/providers/provider-errors'
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
    .select('origin_codes, destination_code, departure_date, return_date, results, adults, children, infants')
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
      // §"Aus der Merkliste direkt zum Treffer" (Nutzervorgabe): search_key
      // erlaubt später einen direkten Cache-Lookup ("Treffer öffnen"), ohne
      // die Originalsuche neu zusammensetzen zu müssen.
      search_key: searchKey, adults: cacheRow.adults, children: cacheRow.children, infants: cacheRow.infants,
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

/**
 * §Phase B "Reise zuordnen" (Nutzervorgabe): setzt nur trip_id, keine
 * Statusänderung -- ein gemerkter Treffer bleibt bis zur bewussten
 * Markierung "ausgewählt". §"Familien- und Nutzerzugriff prüfen" (Vorgabe
 * aus dem ursprünglichen Fix-Sprint): trips.family_id wird explizit
 * gegengeprüft, statt der über das Formular übergebenen trip_id blind zu
 * vertrauen -- RLS auf saved_flight_options schützt nur die Zeile selbst,
 * nicht die referenzierte trip_id.
 */
export async function assignTripToSavedFlightOption(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/flights')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id && tripId) {
    const { data: trip } = await supabase.from('trips').select('id').eq('id', tripId).eq('family_id', familyId).maybeSingle()
    if (trip) await supabase.from('saved_flight_options').update({ trip_id: tripId }).eq('id', id).eq('family_id', familyId)
  }

  redirect(returnTo)
}

/** §Phase B "Ausgewählt ist eine Zwischenstufe" (Nutzervorgabe, wörtlich): nur möglich, wenn bereits eine Reise zugeordnet ist. */
export async function markSavedFlightOptionSelected(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/flights')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id) {
    await supabase.from('saved_flight_options').update({ status: 'selected' }).eq('id', id).eq('family_id', familyId).not('trip_id', 'is', null)
  }

  redirect(returnTo)
}

export async function unmarkSavedFlightOptionSelected(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/flights')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  if (id) await supabase.from('saved_flight_options').update({ status: 'saved' }).eq('id', id).eq('family_id', familyId)

  redirect(returnTo)
}

function describeRefreshFailure(e: unknown): string {
  if (e instanceof ProviderConfigError || e instanceof ProviderRequestError) return describeProviderError(e)
  if (e instanceof Error && e.message) return `Neusuche fehlgeschlagen: ${e.message}`
  return 'Neusuche gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
}

/**
 * §Bugfix "Kein falscher Buchungslink, stattdessen ehrliche Neusuche"
 * (Nutzervorgabe, wörtlich: "Verbindung neu suchen soll die ursprünglichen
 * Suchparameter übernehmen, Duffel erneut live abfragen"): fragt Duffel über
 * die bereits bestehende, einzige Suchmaschine (`getOrSearchFlightOptions`,
 * `forceRefresh: true`) erneut ab -- keine zweite Suchlogik. Nutzt dafür
 * ausschließlich die bereits auf `saved_flight_options` persistierten
 * Original-Parameter (Codes, Datum, gebuckete Passagierzahlen), keine neue
 * Namensauflösung nötig (Codes liegen schon vor).
 *
 * Exakte Passagier-Alter werden NICHT gespeichert (nur die Bucket-Zähler
 * adults/children/infants) -- für die Provider-Anfrage werden repräsentative
 * Alter je Bucket verwendet (30/8/1). Das ist eine technische Näherung für
 * die Tarifklassen-Anfrage, keine erfundene Personenidentität.
 */
export async function refreshSavedFlightOption(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/flights')
  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  const { data: saved } = await supabase
    .from('saved_flight_options')
    .select('origin_codes, destination_code, found_departure_date, found_return_date, adults, children, infants')
    .eq('id', id)
    .eq('family_id', familyId)
    .maybeSingle()
  if (!saved) redirect(appendError(returnTo, 'Dieser gemerkte Flug wurde nicht gefunden.'))

  const passengerAges: Array<number | null> = [
    ...Array(saved!.adults ?? 1).fill(30),
    ...Array(saved!.children ?? 0).fill(8),
    ...Array(saved!.infants ?? 0).fill(1),
  ]

  const dnaSummary = await buildFamilyDnaSummary(familyId)
  const dnaText = formatFamilyDnaForPrompt(dnaSummary, saved!.found_departure_date)

  // §Bugfix-im-eigenen-Entwurf: redirect() wirft intern ein spezielles
  // Next.js-Signal (kein echter Fehler) -- darf deshalb NIE innerhalb dieses
  // try-Blocks aufgerufen werden, sonst würde der catch-Block es fälschlich
  // als Suchfehler interpretieren. Nur der eigentliche Provider-Aufruf steht
  // im try, alle redirect()-Aufrufe folgen erst danach (gleiches Muster wie
  // searchFlightsStandalone in lib/actions/flight-search.ts).
  let outcome!: FlightSearchOutcome
  try {
    outcome = await getOrSearchFlightOptions({
      familyId,
      originCodes: saved!.origin_codes,
      destinationCode: saved!.destination_code,
      departureDate: saved!.found_departure_date,
      returnDate: saved!.found_return_date,
      passengerAges,
      maxStops: null,
      familyDnaText: dnaText,
      stopoverPreference: null,
      forceRefresh: true,
    })
  } catch (e) {
    redirect(appendError(returnTo, describeRefreshFailure(e)))
  }

  if (outcome.status === 'limit_reached')
    redirect(appendError(returnTo, 'Monatliches Such-Limit erreicht -- weitere Suchen sind erst im nächsten Monat möglich.'))
  if (outcome.status === 'already_in_progress')
    redirect(appendError(returnTo, 'Für diese Suche läuft bereits eine Anfrage -- bitte kurz warten und erneut versuchen.'))
  if (outcome.status === 'no_results')
    redirect(appendError(returnTo, 'Für diese Route/Daten wurden gerade keine Flüge gefunden -- das ursprüngliche Angebot ist offenbar nicht mehr verfügbar.'))

  const okOutcome = outcome as Extract<FlightSearchOutcome, { status: 'ok' }>
  const params = new URLSearchParams({ search_key: okOutcome.searchKey, expired_option: id })
  redirect(`/discover/flights?${params.toString()}`)
}
