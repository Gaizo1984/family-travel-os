'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { geocodeLocation, searchLodging, type LodgingResult } from '@/lib/providers/places-provider'
import { computeRouteMatrix } from '@/lib/providers/routes-provider'
import { ProviderConfigError } from '@/lib/providers/provider-errors'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { selectHotelShortlist, generateBudgetBreakdown, type HotelCandidateFact } from '@/lib/trip-idea-advisor-ai'

type IdeaRow = {
  id: string
  family_id: string
  session_id: string | null
  destination: string
  duration_days_min: number | null
  duration_days_max: number | null
  budget_range_min: number | null
  budget_range_max: number | null
  budget_currency: string
  includes_flights: boolean
}

async function loadIdeaContext(ideaId: string) {
  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('trip_ideas')
    .select('id, family_id, session_id, destination, duration_days_min, duration_days_max, budget_range_min, budget_range_max, budget_currency, includes_flights')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return null

  const { data: session } = idea.session_id
    ? await supabase.from('trip_idea_sessions').select('traveler_ids').eq('id', idea.session_id).maybeSingle()
    : { data: null }

  const dnaSummary = await buildFamilyDnaSummary(idea.family_id)
  const travelerIds = session?.traveler_ids as string[] | null
  const selectedPersons = travelerIds && travelerIds.length > 0
    ? dnaSummary.persons.filter((p) => travelerIds.includes(p.id))
    : dnaSummary.persons

  return { supabase, idea: idea as IdeaRow, dnaSummary, selectedPersons }
}

/**
 * §"Reiseideen 2.0, Hotel-Shortlist" (kleinster Einstieg): einziger Auslöser
 * für Places-/Routes-/OpenAI-Aufrufe dieser Idee -- nie beim bloßen Öffnen
 * der Ideen-Detailseite. Folgt exakt dem in `lib/actions/category-places.ts`
 * bewiesenen Muster (Kandidaten suchen, Dedupe per Place ID, echte Fahrzeiten
 * per Route Matrix, KI liefert nur Auswahl/Begründung, nie Fakten selbst).
 */
export async function generateHotelShortlist(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const sessionId = String(formData.get('session_id') ?? '')
  const returnTo = `/plan/ideas/${sessionId}/${ideaId}`

  const ctx = await loadIdeaContext(ideaId)
  if (!ctx) redirect(returnTo)
  const { supabase, idea, dnaSummary, selectedPersons } = ctx

  let destGeo: Awaited<ReturnType<typeof geocodeLocation>>
  try {
    destGeo = await geocodeLocation(idea.destination)
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'Die Hotelsuche ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Hotelsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`)
  }
  if (!destGeo) redirect(`${returnTo}?error=${encodeURIComponent('Zielort konnte nicht gefunden werden.')}`)

  let candidates: LodgingResult[] | null
  try {
    candidates = await searchLodging({ locationName: idea.destination, lat: destGeo.lat, lng: destGeo.lng })
  } catch {
    redirect(`${returnTo}?error=${encodeURIComponent('Die Hotelsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.')}`)
  }
  if (!candidates || candidates.length === 0)
    redirect(`${returnTo}?error=${encodeURIComponent('Keine Hotels für dieses Ziel gefunden -- bitte später erneut versuchen.')}`)

  // §"Nach Place ID deduplizieren": zwei Hotels können ähnliche/identische
  // Namen tragen, aber nie dieselbe Place ID -- Dedupe bewusst auf `id`, nicht auf `name`.
  const seenIds = new Set<string>()
  const deduped = candidates.filter((c) => {
    if (seenIds.has(c.id)) return false
    seenIds.add(c.id)
    return true
  })

  // §"Referenzpunkt für Transferzeit": erst der Flughafen des Ziels
  // versuchen, sonst der Zielort selbst als Näherung.
  let referencePoint = destGeo
  try {
    const airportGeo = await geocodeLocation(`Flughafen ${idea.destination}`)
    if (airportGeo) referencePoint = airportGeo
  } catch {
    // Kein Flughafen auflösbar -- Zielort-Geocode bleibt als Referenzpunkt.
  }

  // §"Route-Matrix-Fehler dürfen die Hotel-Shortlist nicht verwerfen": schlägt
  // der Matrix-Call fehl, läuft die Erzeugung mit durationMinutes=null je
  // Kandidat weiter -- die UI zeigt diese Hotels dann ohne Transferzeit.
  let matrix: Awaited<ReturnType<typeof computeRouteMatrix>> = null
  try {
    matrix = await computeRouteMatrix({
      origins: [{ lat: referencePoint.lat, lng: referencePoint.lng }],
      destinations: deduped.map((c) => ({ lat: c.lat, lng: c.lng })),
    })
  } catch {
    // Bereits über logProviderError() geloggt -- Hotels bleiben ohne Transferzeit-Anreicherung erhalten.
  }

  const withFacts = deduped.map((c, i) => {
    const m = matrix?.find((el) => el.destinationIndex === i)
    const durationMinutes = m?.reachable && m.durationSeconds != null ? Math.round(m.durationSeconds / 60) : null
    return { candidate: c, durationMinutes }
  })

  const candidateFacts: HotelCandidateFact[] = withFacts.map((r) => ({
    name: r.candidate.name,
    rating: r.candidate.rating,
    userRatingCount: r.candidate.userRatingCount,
    priceLevel: r.candidate.priceLevel,
    transferMinutes: r.durationMinutes,
    address: r.candidate.formattedAddress,
    types: r.candidate.types,
  }))

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, new Date().toISOString().slice(0, 10))
  const picks = await selectHotelShortlist({ destination: idea.destination, familyDnaText: dnaText, candidates: candidateFacts })

  if (!picks || picks.length === 0)
    redirect(`${returnTo}?error=${encodeURIComponent('Die Hotelauswahl ist gerade nicht verfügbar -- bitte in Kürze erneut versuchen.')}`)

  const pickByName = new Map(picks.map((p) => [p.placeName, p]))

  // §Defensive zweite Absicherung neben dem Schema: jeder KI-Name ohne
  // Fakten-Treffer in der echten Kandidatenliste wird verworfen.
  const shortlist = withFacts
    .filter((r) => pickByName.has(r.candidate.name))
    .map((r) => {
      const pick = pickByName.get(r.candidate.name)!
      const unverifiedFields: string[] = []
      if (r.candidate.rating === null) unverifiedFields.push('rating')
      if (!r.candidate.priceLevel) unverifiedFields.push('priceLevel')
      if (!r.candidate.websiteUri) unverifiedFields.push('website')
      if (r.durationMinutes === null) unverifiedFields.push('transferMinutes')
      return {
        placeId: r.candidate.id,
        name: r.candidate.name,
        address: r.candidate.formattedAddress,
        rating: r.candidate.rating,
        reviewCount: r.candidate.userRatingCount,
        priceLevel: r.candidate.priceLevel,
        photoName: r.candidate.photoName,
        websiteUri: r.candidate.websiteUri,
        transferMinutes: r.durationMinutes,
        familyFitReasoning: pick.familyFitReasoning,
        styleImpression: pick.styleImpression,
        bestFor: pick.bestFor,
        caveats: pick.caveats,
        unverifiedFields,
        // §Vorbereitung für einen späteren HotelAvailabilityProvider
        // (Booking.com/Expedia): reserviertes Feld, damit ein Live-Preis-/
        // Verfügbarkeits-Anbieter später ergänzt werden kann, ohne diese
        // Places-basierte Hoteldiscovery neu zu bauen.
        livePricing: null,
      }
    })

  if (shortlist.length === 0)
    redirect(`${returnTo}?error=${encodeURIComponent('Die Hotelauswahl konnte nicht mit echten Treffern abgeglichen werden -- bitte erneut versuchen.')}`)

  const { error: updateError } = await supabase
    .from('trip_ideas')
    .update({ hotel_shortlist: shortlist, hotel_shortlist_updated_at: new Date().toISOString() })
    .eq('id', ideaId)

  if (updateError) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + updateError.message)}`)

  redirect(returnTo)
}

/**
 * §"Reiseideen 2.0, Budget-Schätzung" (kleinster Einstieg): reine
 * KI-Schätzung ohne externe API, gleiche Diskretion (nur auf Klick),
 * Kategorien 1:1 aus lib/budget.ts.
 */
export async function estimateTripIdeaBudget(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const sessionId = String(formData.get('session_id') ?? '')
  const returnTo = `/plan/ideas/${sessionId}/${ideaId}`

  const ctx = await loadIdeaContext(ideaId)
  if (!ctx) redirect(returnTo)
  const { supabase, idea, dnaSummary, selectedPersons } = ctx

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, new Date().toISOString().slice(0, 10))
  const membersText = selectedPersons.length > 0 ? selectedPersons.map((p) => p.name).join(', ') : 'keine Reisenden hinterlegt'

  const estimate = await generateBudgetBreakdown({
    destination: idea.destination,
    durationDaysMin: idea.duration_days_min,
    durationDaysMax: idea.duration_days_max,
    existingBudgetMin: idea.budget_range_min,
    existingBudgetMax: idea.budget_range_max,
    existingBudgetCurrency: idea.budget_currency,
    includesFlights: idea.includes_flights,
    familyDnaText: dnaText,
    membersText,
  })

  if (!estimate) redirect(`${returnTo}?error=${encodeURIComponent('Die Budget-Schätzung ist gerade nicht verfügbar -- bitte in Kürze erneut versuchen.')}`)

  const { error: updateError } = await supabase
    .from('trip_ideas')
    .update({ budget_breakdown: estimate, budget_breakdown_updated_at: new Date().toISOString() })
    .eq('id', ideaId)

  if (updateError) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + updateError.message)}`)

  redirect(returnTo)
}
