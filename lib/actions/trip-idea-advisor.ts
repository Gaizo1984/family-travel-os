'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { geocodeLocation, searchLodging, type LodgingResult } from '@/lib/providers/places-provider'
import { computeRouteMatrix } from '@/lib/providers/routes-provider'
import { ProviderConfigError } from '@/lib/providers/provider-errors'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { selectHotelShortlist, generateBudgetBreakdown, generateTripVariants as generateTripVariantsAi, type HotelCandidateFact } from '@/lib/trip-idea-advisor-ai'
import { classifyAndQualify, selectBalancedQualified } from '@/lib/hotel-qualification'
import type { HotelShortlist } from '@/lib/trip-idea-hotel-types'

type IdeaRow = {
  id: string
  family_id: string
  session_id: string | null
  destination: string
  route_summary: string | null
  duration_days_min: number | null
  duration_days_max: number | null
  budget_range_min: number | null
  budget_range_max: number | null
  budget_currency: string
  includes_flights: boolean
  hotel_shortlist: HotelShortlist | null
}

async function loadIdeaContext(ideaId: string) {
  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('trip_ideas')
    .select('id, family_id, session_id, destination, route_summary, duration_days_min, duration_days_max, budget_range_min, budget_range_max, budget_currency, includes_flights, hotel_shortlist')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return null

  const { data: session } = idea.session_id
    ? await supabase
      .from('trip_idea_sessions')
      .select('traveler_ids, travel_start_date, climate_preference, trip_type_preference, stopover_preference, max_stopovers')
      .eq('id', idea.session_id)
      .maybeSingle()
    : { data: null }

  const dnaSummary = await buildFamilyDnaSummary(idea.family_id)
  const travelerIds = session?.traveler_ids as string[] | null
  const selectedPersons = travelerIds && travelerIds.length > 0
    ? dnaSummary.persons.filter((p) => travelerIds.includes(p.id))
    : dnaSummary.persons

  // §"Reisebriefing": echtes Reisedatum ersetzt das bisher hartkodierte
  // "heute" für die Altersberechnung, sofern die Session eines hinterlegt hat
  // (nur bei travel_date_mode='exact') -- alte Sessions ohne dieses Feld
  // fallen kontrolliert auf "heute" zurück, wie zuvor.
  const effectiveDate = session?.travel_start_date ?? new Date().toISOString().slice(0, 10)

  return {
    supabase, idea: idea as unknown as IdeaRow, dnaSummary, selectedPersons, effectiveDate,
    climatePreference: (session?.climate_preference as string | null) ?? null,
    tripTypePreference: (session?.trip_type_preference as string | null) ?? null,
    stopoverPreference: (session?.stopover_preference as string | null) ?? null,
    maxStopovers: (session?.max_stopovers as number | null) ?? null,
  }
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
  const { supabase, idea, dnaSummary, selectedPersons, effectiveDate } = ctx

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
  const dedupedRaw = candidates.filter((c) => {
    if (seenIds.has(c.id)) return false
    seenIds.add(c.id)
    return true
  })

  // §"Qualitativ neu kalibrieren": Mindeststandard gehobenes 5-Sterne-Niveau
  // (Westin/Le Méridien-Klasse) -- Kandidaten unterhalb davon fliegen HIER
  // raus, bevor Route Matrix/KI überhaupt dafür aufgerufen werden (spart auch
  // Kosten für Hotels, die ohnehin nicht in Frage kommen).
  const qualificationByPlaceId = new Map(dedupedRaw.map((c) => [c.id, classifyAndQualify(c)]))
  const anyQualified = dedupedRaw.some((c) => qualificationByPlaceId.get(c.id)!.qualifies)

  // §"Fallback für Regionen ohne qualifizierte Hotels": statt gar nichts
  // anzuzeigen, fällt die Suche auf die real gefundenen Kandidaten mit der
  // besten Bewertung zurück -- klar als unterhalb des Mindeststandards
  // gekennzeichnet (siehe belowStandardMode/tier:null unten), nie stillschweigend aufgewertet.
  const belowStandardMode = !anyQualified
  const MAX_FALLBACK_CANDIDATES = 10
  // §"Ausgewogen zusammengesetzt, nicht nur die höchste Stufe": 2 gehobene
  // 5-Sterne + 2 Premium Luxury + 1 Ultra Luxury + optional 1 iconic Pick,
  // ausschließlich aus echten, bereits qualifizierten Places-Treffern.
  const deduped = belowStandardMode
    ? [...dedupedRaw].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, MAX_FALLBACK_CANDIDATES)
    : selectBalancedQualified(dedupedRaw, qualificationByPlaceId)

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
    tier: belowStandardMode ? null : qualificationByPlaceId.get(r.candidate.id)!.tier,
  }))

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, effectiveDate)
  const picks = await selectHotelShortlist({ destination: idea.destination, familyDnaText: dnaText, candidates: candidateFacts, belowStandardMode })

  if (!picks || picks.length === 0)
    redirect(`${returnTo}?error=${encodeURIComponent('Die Hotelauswahl ist gerade nicht verfügbar -- bitte in Kürze erneut versuchen.')}`)

  const pickByName = new Map(picks.map((p) => [p.placeName, p]))

  // §Defensive zweite Absicherung neben dem Schema: jeder KI-Name ohne
  // Fakten-Treffer in der echten Kandidatenliste wird verworfen.
  const shortlist = withFacts
    .filter((r) => pickByName.has(r.candidate.name))
    .map((r) => {
      const pick = pickByName.get(r.candidate.name)!
      const qualification = qualificationByPlaceId.get(r.candidate.id)!
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
        // §"Falls Google Places keine sichere Sterneklassifizierung liefert,
        // nicht raten": tier ist deterministisch aus Marke ODER Bewertung+
        // Preisniveau bestimmt (siehe classifyAndQualify oben), NIE von der
        // KI. `null` = Fallback-Kandidat unterhalb des Mindeststandards
        // (siehe belowStandardMode). tierBasis === 'heuristic' kennzeichnet
        // zusätzlich die Unsicherheit in der UI (kein verifizierter
        // Markenname, nur Fakten-Kombination).
        tier: belowStandardMode ? null : qualification.tier,
        tierBasis: qualification.tierBasis,
        isIconic: qualification.isIconic,
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
    .update({
      hotel_shortlist: { items: shortlist, belowStandard: belowStandardMode },
      hotel_shortlist_updated_at: new Date().toISOString(),
    })
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
  const { supabase, idea, dnaSummary, selectedPersons, effectiveDate } = ctx

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, effectiveDate)
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

/**
 * §"Reiseideen 2.0, Phase 2 -- Reisevarianten": kein neuer Places-/Routes-
 * Aufruf -- die Hotelreferenz je Variante kommt ausschließlich aus der
 * bereits vorhandenen, echten `hotel_shortlist` der Idee. Einziger Auslöser
 * ist ein expliziter Button-Klick (gleiche Diskretion wie die beiden
 * anderen Aktionen dieser Datei).
 */
export async function generateTripVariants(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const sessionId = String(formData.get('session_id') ?? '')
  const returnTo = `/plan/ideas/${sessionId}/${ideaId}`

  const ctx = await loadIdeaContext(ideaId)
  if (!ctx) redirect(returnTo)
  const { supabase, idea, dnaSummary, selectedPersons, effectiveDate, climatePreference, tripTypePreference, stopoverPreference, maxStopovers } = ctx

  const dnaText = formatFamilyDnaForPrompt({ ...dnaSummary, persons: selectedPersons }, effectiveDate)

  const shortlistItems = idea.hotel_shortlist?.items ?? []
  // §"Wenn die Shortlist keine sinnvolle Differenzierung ermöglicht": ab 2
  // echten, qualifizierten Hotelnamen bekommt die KI sie als Auswahl-Pool,
  // sonst bleibt recommended_hotel_name bei jeder Variante null (siehe Prompt
  // in generateTripVariants/lib/trip-idea-advisor-ai.ts).
  const hotelCandidates = shortlistItems.map((h) => ({
    name: h.name, tier: h.tier, priceLevel: h.priceLevel, transferMinutes: h.transferMinutes,
  }))

  const variants = await generateTripVariantsAi({
    destination: idea.destination,
    routeSummary: idea.route_summary,
    durationDaysMin: idea.duration_days_min,
    durationDaysMax: idea.duration_days_max,
    budgetRangeMin: idea.budget_range_min,
    budgetRangeMax: idea.budget_range_max,
    budgetCurrency: idea.budget_currency,
    familyDnaText: dnaText,
    hotelCandidates,
    // §"Reisebriefing": aus dem Wizard bekannte Präferenzen steuern die
    // Varianten-Generierung, statt der KI die Anreise-/Themenfokus-Wahl
    // vollständig zu überlassen (z. B. "Entspannte Anreise" bei explizit
    // ausgeschlossenem Stopover).
    climatePreference,
    tripTypePreference,
    stopoverPreference,
    maxStopovers,
  })

  if (!variants || variants.length === 0)
    redirect(`${returnTo}?error=${encodeURIComponent('Die Varianten-Entwicklung ist gerade nicht verfügbar -- bitte in Kürze erneut versuchen.')}`)

  const shortlistByName = new Map(shortlistItems.map((h) => [h.name, h]))

  // §Defensive zweite Absicherung neben dem Schema: jeder von der KI
  // genannte Hotelname ohne echten Treffer in der Shortlist wird verworfen
  // (recommendedHotel bleibt null) -- kein erfundenes Hotel kann durchrutschen.
  const storedVariants = variants.map((v) => ({
    variantType: v.variantType,
    title: v.title,
    routeSummary: v.routeSummary,
    stageCount: v.stageCount,
    hasStopover: v.hasStopover,
    durationDaysMin: v.durationDaysMin,
    durationDaysMax: v.durationDaysMax,
    transferBurden: v.transferBurden,
    themeFocus: v.themeFocus,
    budgetRangeMin: v.budgetRangeMin,
    budgetRangeMax: v.budgetRangeMax,
    budgetCurrency: v.budgetCurrency,
    pros: v.pros,
    cons: v.cons,
    whyThisVariant: v.whyThisVariant,
    recommendedHotel: v.recommendedHotelName ? shortlistByName.get(v.recommendedHotelName) ?? null : null,
  }))

  const { error: updateError } = await supabase
    .from('trip_ideas')
    .update({ variants: storedVariants, variants_generated_at: new Date().toISOString() })
    .eq('id', ideaId)

  if (updateError) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + updateError.message)}`)

  redirect(returnTo)
}
