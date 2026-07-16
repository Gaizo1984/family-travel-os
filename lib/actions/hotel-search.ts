'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { geocodeLocation, searchLodging, type LodgingResult } from '@/lib/providers/places-provider'
import { computeRouteMatrix } from '@/lib/providers/routes-provider'
import { ProviderConfigError } from '@/lib/providers/provider-errors'
import { selectHotelShortlist, type HotelCandidateFact } from '@/lib/trip-idea-advisor-ai'
import { classifyAndQualify } from '@/lib/hotel-qualification'
import { readDateGroupFromFormData } from '@/lib/documents'
import { isoToday, isBeforeIso } from '@/lib/date-utils'
import type { HotelShortlistItem } from '@/lib/trip-idea-hotel-types'
import type { Json } from '@/lib/supabase/types'

const MAX_FALLBACK_CANDIDATES = 10

/** Nur nach normalisiertem Ziel qualifiziert -- Google Places kennt keine terminabhängige Verfügbarkeit, die realen Kandidaten hängen nur vom Ziel ab. */
function buildHotelSearchKey(destination: string): string {
  return destination.trim().toLowerCase().replace(/\s+/g, ' ')
}

export type HotelSearchOutcome =
  | { status: 'ok'; searchKey: string; items: HotelShortlistItem[]; belowStandard: boolean; searchedAt: string }
  | { status: 'no_results' }
  | { status: 'error'; message: string }

/**
 * §"Keine doppelte Hotelsuchlogik, echte eigenständige Hotelsuche": identisches
 * Kern-Muster wie `generateHotelShortlist` in `trip-idea-advisor.ts` (Geocoding
 * → searchLodging → Dedupe per Place ID → classifyAndQualify/Fallback → Route
 * Matrix → selectHotelShortlist (KI, anti-halluzinationssicher) → Merge-
 * Verify), aber vollständig idee-unabhängig und über `destination` gecacht --
 * Termine/Reisende/Zimmer fließen hier bewusst NICHT in die Suche ein, da
 * Places keine terminabhängige Verfügbarkeit liefert.
 */
export async function getOrSearchHotelOptions(params: {
  familyId: string
  destination: string
  familyDnaText: string
  forceRefresh?: boolean
}): Promise<HotelSearchOutcome> {
  const supabase = await createClient()
  const searchKey = buildHotelSearchKey(params.destination)

  const { data: existing } = await supabase
    .from('hotel_search_cache')
    .select('results, is_below_standard, updated_at')
    .eq('family_id', params.familyId)
    .eq('search_key', searchKey)
    .maybeSingle()

  const hasCachedResults = Array.isArray(existing?.results) && (existing.results as unknown[]).length > 0
  if (!params.forceRefresh && hasCachedResults) {
    return {
      status: 'ok',
      searchKey,
      items: existing!.results as unknown as HotelShortlistItem[],
      belowStandard: existing!.is_below_standard,
      searchedAt: existing!.updated_at,
    }
  }

  let destGeo: Awaited<ReturnType<typeof geocodeLocation>>
  try {
    destGeo = await geocodeLocation(params.destination)
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof ProviderConfigError
        ? 'Die Hotelsuche ist aktuell nicht konfiguriert -- bitte Support informieren.'
        : 'Die Hotelsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.',
    }
  }
  if (!destGeo) return { status: 'error', message: 'Zielort konnte nicht gefunden werden.' }

  let candidates: LodgingResult[] | null
  try {
    candidates = await searchLodging({ locationName: params.destination, lat: destGeo.lat, lng: destGeo.lng })
  } catch {
    return { status: 'error', message: 'Die Hotelsuche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.' }
  }
  if (!candidates || candidates.length === 0) return { status: 'no_results' }

  // §"Nach Place ID deduplizieren": zwei Hotels können ähnliche/identische Namen tragen, aber nie dieselbe Place ID.
  const seenIds = new Set<string>()
  const dedupedRaw = candidates.filter((c) => {
    if (seenIds.has(c.id)) return false
    seenIds.add(c.id)
    return true
  })

  const qualificationByPlaceId = new Map(dedupedRaw.map((c) => [c.id, classifyAndQualify(c)]))
  const qualified = dedupedRaw.filter((c) => qualificationByPlaceId.get(c.id)!.qualifies)

  const belowStandardMode = qualified.length === 0
  const deduped = belowStandardMode
    ? [...dedupedRaw].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, MAX_FALLBACK_CANDIDATES)
    : qualified

  let referencePoint = destGeo
  try {
    const airportGeo = await geocodeLocation(`Flughafen ${params.destination}`)
    if (airportGeo) referencePoint = airportGeo
  } catch {
    // Kein Flughafen auflösbar -- Zielort-Geocode bleibt als Referenzpunkt.
  }

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

  const picks = await selectHotelShortlist({
    destination: params.destination, familyDnaText: params.familyDnaText, candidates: candidateFacts, belowStandardMode,
  })
  if (!picks || picks.length === 0)
    return { status: 'error', message: 'Die Hotelauswahl ist gerade nicht verfügbar -- bitte in Kürze erneut versuchen.' }

  const pickByName = new Map(picks.map((p) => [p.placeName, p]))

  // §Defensive zweite Absicherung neben dem Schema: jeder KI-Name ohne Fakten-Treffer in der echten Kandidatenliste wird verworfen.
  const items: HotelShortlistItem[] = withFacts
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
        tier: belowStandardMode ? null : qualification.tier,
        tierBasis: qualification.tierBasis,
        unverifiedFields,
        livePricing: null,
      }
    })

  if (items.length === 0)
    return { status: 'error', message: 'Die Hotelauswahl konnte nicht mit echten Treffern abgeglichen werden -- bitte erneut versuchen.' }

  const searchedAt = new Date().toISOString()
  const { error: upsertError } = await supabase.from('hotel_search_cache').upsert(
    {
      family_id: params.familyId, search_key: searchKey, destination: params.destination,
      is_below_standard: belowStandardMode, results: items as unknown as Json, updated_at: searchedAt,
    },
    { onConflict: 'family_id,search_key' },
  )
  if (upsertError) console.error('[hotel_search_cache] Speicherfehler:', upsertError.message)

  return { status: 'ok', searchKey, items, belowStandard: belowStandardMode, searchedAt }
}

function buildHotelsPageUrl(params: {
  destination?: string | null; checkIn?: string | null; nights?: string | null
  ideaId?: string | null; searchKey?: string | null; error?: string | null
}): string {
  const usp = new URLSearchParams()
  if (params.destination) usp.set('destination', params.destination)
  if (params.checkIn) usp.set('check_in', params.checkIn)
  if (params.nights) usp.set('nights', params.nights)
  if (params.ideaId) usp.set('idea_id', params.ideaId)
  if (params.searchKey) usp.set('search_key', params.searchKey)
  if (params.error) usp.set('error', params.error)
  return `/hotels?${usp.toString()}`
}

/**
 * §"Nur Ort, Reisezeitraum, Nächte" (Nutzervorgabe): funktioniert sowohl
 * leer (Kachel auf `/discover`) als auch vorausgefüllt (Deep-Link aus einer
 * Ideen-Detailseite). Check-in/Nächte fließen bewusst NICHT in die
 * eigentliche Places-Suche ein (siehe `getOrSearchHotelOptions`) -- sie
 * werden nur für die spätere HolidayCheck-Suche bzw. einen künftigen
 * `HotelAvailabilityProvider` durchgereicht. Ohne Reisenden-Auswahl in der
 * UI wird die DNA-Zusammenfassung immer für die gesamte Familie gebildet.
 */
export async function searchHotelsStandalone(formData: FormData) {
  const destination = String(formData.get('destination') ?? '').trim()
  const ideaId = String(formData.get('idea_id') ?? '').trim() || null

  const redirectBack = (error: string, extra?: Partial<Parameters<typeof buildHotelsPageUrl>[0]>): never => {
    redirect(buildHotelsPageUrl({ destination, ideaId, error, ...extra }))
  }

  if (!destination) redirectBack('Bitte einen Ort angeben.')

  let checkIn: string | null = null
  try {
    checkIn = readDateGroupFromFormData(formData, 'check_in', 'Reisezeitraum')
  } catch (e) {
    redirectBack(e instanceof Error ? e.message : 'Ungültiges Datum')
  }
  const today = isoToday()
  if (checkIn && isBeforeIso(checkIn, today)) redirectBack('Das Check-in-Datum darf nicht in der Vergangenheit liegen.')

  const nights = String(formData.get('nights') ?? '').trim()

  const { id: familyId } = await getFamily()
  const dnaSummary = await buildFamilyDnaSummary(familyId)
  const dnaText = formatFamilyDnaForPrompt(dnaSummary, checkIn ?? today)

  const outcome = await getOrSearchHotelOptions({
    familyId, destination, familyDnaText: dnaText, forceRefresh: formData.get('force_refresh') === 'on',
  })

  if (outcome.status === 'error') redirectBack(outcome.message, { checkIn, nights })
  if (outcome.status === 'no_results') redirectBack('Keine Hotels für dieses Ziel gefunden.', { checkIn, nights })

  const okOutcome = outcome as Extract<HotelSearchOutcome, { status: 'ok' }>

  redirect(buildHotelsPageUrl({ destination, checkIn, nights, ideaId, searchKey: okOutcome.searchKey }))
}
