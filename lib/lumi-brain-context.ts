import { createClient } from './supabase/server'
import { buildLumiContext, lumiContextErrorMessage, type LumiContext } from './lumi-context'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from './family-dna'
import { buildTravelWorld } from './travel-world'
import { isTripHistorical } from './trip-status'
import { deriveTripDateRange } from './trip-dates'
import { computeTripReadiness, type ReadinessStatus } from './readiness'
import type { HotelShortlistItem } from './trip-idea-hotel-types'
import type { FlightSearchOption } from './flight-types'
import { loadRelevantMemories, memoryCategoriesForIntent, type FamilyMemory } from './family-memories'
import type { LumiBrainIntent } from './lumi-brain-intent'

/**
 * §"LUMI Brain -- zentrale Kontextstruktur" (Nutzervorgabe, wörtlich: "keine
 * zweite parallele Kontext-, Readiness-, Journey- oder Familienlogik"):
 * dieser Builder erfindet KEINE neue Datenbeschaffung -- er ruft
 * ausschließlich bereits bestehende Funktionen auf (`buildLumiContext` für
 * den reisegebundenen Fall, `buildTravelWorld` für die Reisehistorie) und
 * ergänzt nur den bisher fehlenden "Allgemein"-Modus (kein Trip ausgewählt)
 * plus die für Frag LUMI zusätzlich nötigen Hotel-/Flugvergleichsdaten.
 */

export type LumiBrainScope =
  | { mode: 'trip'; tripId: string }
  | { mode: 'general' }

export type LumiBrainTripContext = {
  tripId: string
  slug: string
  title: string
  isActive: boolean
  isHistorical: boolean
  lumi: LumiContext
  /** Nur befüllt, wenn ein passender Hotelsuchlauf für dieses Ziel existiert (hotel_search_cache) -- kein neuer Suchlauf wird ausgelöst. */
  hotelOptions: HotelShortlistItem[] | null
  /** Nur befüllt, wenn ein passender Flugsuchlauf existiert (flight_search_cache) -- kein neuer Suchlauf wird ausgelöst. */
  flightOptions: FlightSearchOption[] | null
  /** §"Kontrolliertes LUMI Memory" (Nutzervorgabe): nur bestätigte, für den Intent relevante Einträge -- niemals der volle Bestand. */
  relevantMemories: FamilyMemory[]
}

export type LumiBrainGeneralContext = {
  dnaText: string
  hotelCriteria: string[]
  upcomingTrips: Array<{ title: string; slug: string; startDate: string | null; readinessStatus: ReadinessStatus }>
  travelWorldSummary: { tripsCount: number; countryCount: number; travelDays: number }
  pastAccommodationTitles: string[]
  relevantMemories: FamilyMemory[]
}

export type LumiBrainContextResult =
  | { ok: true; scope: LumiBrainScope; trip: LumiBrainTripContext; general: null }
  | { ok: true; scope: LumiBrainScope; trip: null; general: LumiBrainGeneralContext }
  | { ok: false; message: string }

/** Normalisiert einen Zieltext exakt wie `lib/actions/hotel-search.ts::buildHotelSearchKey` -- keine zweite Normalisierung, nur zum Lesen bereits vorhandener Cache-Zeilen, kein neuer Suchlauf. */
function normalizeDestinationKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Bestmögliche, rein lesende Zuordnung einer Reise zu einem bereits vorhandenen Hotelsuchlauf -- vergleicht den Reisetitel/die Etappenorte gegen bereits gespeicherte `hotel_search_cache.destination`-Werte derselben Familie. Kein neuer API-Aufruf, keine Fuzzy-Logik über simple Teilstring-Treffer hinaus. */
async function findMatchingHotelOptions(familyId: string, tripTitle: string, stageLocations: string[]): Promise<HotelShortlistItem[] | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('hotel_search_cache')
    .select('destination, results')
    .eq('family_id', familyId)

  const candidates = [tripTitle, ...stageLocations].map(normalizeDestinationKey).filter(Boolean)
  const match = (data ?? []).find((row) => {
    const rowKey = normalizeDestinationKey(row.destination)
    return candidates.some((c) => c.includes(rowKey) || rowKey.includes(c))
  })
  if (!match) return null
  return (match.results as unknown as HotelShortlistItem[]) ?? null
}

/** Analog zu `findMatchingHotelOptions`, aber für `flight_search_cache` -- Zuordnung über `destination_code`/`origin_codes` ist hier nicht sinnvoll ohne Flughafen-Kontext, deshalb bewusst nur über ein bereits vorhandenes `search_key`-Präfix-Muster (Zielort-Text steckt nicht im Flug-Cache-Key) -- siehe Kommentar in der Funktion. */
async function findMatchingFlightOptions(familyId: string, destinationCode: string | null): Promise<FlightSearchOption[] | null> {
  if (!destinationCode) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('flight_search_cache')
    .select('results, updated_at')
    .eq('family_id', familyId)
    .eq('destination_code', destinationCode)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return (data.results as unknown as FlightSearchOption[]) ?? null
}

async function buildGeneralContext(familyId: string): Promise<Omit<LumiBrainGeneralContext, 'relevantMemories'>> {
  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  // §"Inspiration aus bisherigen Hotels" (Nutzervorgabe): nur Titel bereits
  // gebuchter Unterkünfte historischer Reisen -- keine neue "Lieblingshotels"-
  // Tabelle, keine Erfindung einer Bewertung, die nicht existiert. Bewusst
  // eine einzige Query (Buchungen sind ohnehin schon Teil der Trip-Abfrage
  // für die Datumsableitung) statt eines zweiten `trips!inner`-Joins.
  const [dna, travelWorld, { data: tripsRaw }] = await Promise.all([
    buildFamilyDnaSummary(familyId),
    buildTravelWorld({ familyId }),
    supabase.from('trips')
      .select('id, slug, title, status, start_date, end_date, stages ( start_date, end_date ), bookings ( type, title, status, start_datetime, end_datetime )')
      .eq('family_id', familyId),
  ])

  const trips = tripsRaw ?? []
  const upcomingTrips = await Promise.all(
    trips
      .filter((t) => {
        const range = deriveTripDateRange(t, t.bookings, t.stages)
        return !isTripHistorical({ status: t.status, start_date: range.startDate, end_date: range.endDate }, todayIso)
      })
      .slice(0, 5)
      .map(async (t) => {
        const range = deriveTripDateRange(t, t.bookings, t.stages)
        const readiness = await computeTripReadiness(t.id)
        return { title: t.title, slug: t.slug, startDate: range.startDate, readinessStatus: readiness.status }
      }),
  )

  const pastAccommodationTitles = [...new Set(
    trips
      .filter((t) => {
        const range = deriveTripDateRange(t, t.bookings, t.stages)
        return isTripHistorical({ status: t.status, start_date: range.startDate, end_date: range.endDate }, todayIso)
      })
      .flatMap((t) => t.bookings.filter((b) => b.type === 'accommodation' && b.status !== 'cancelled').map((b) => b.title)),
  )].slice(0, 20)

  return {
    dnaText: formatFamilyDnaForPrompt(dna, todayIso),
    hotelCriteria: dna.hotelCriteria,
    upcomingTrips,
    travelWorldSummary: { tripsCount: travelWorld.tripsCount, countryCount: travelWorld.countryCodes.size, travelDays: travelWorld.travelDays },
    pastAccommodationTitles,
  }
}

/**
 * Zentrale Einstiegsfunktion für Frag LUMI. Bei `scope.mode==='trip'` wird
 * `buildLumiContext` (lib/lumi-context.ts) unverändert wiederverwendet --
 * KEINE zweite Reise-/Readiness-/Familienlogik. Vergleichsdaten (Hotel/Flug)
 * werden nur gelesen, nie neu gesucht.
 */
export async function buildLumiBrainContext(familyId: string, scope: LumiBrainScope, intent: LumiBrainIntent): Promise<LumiBrainContextResult> {
  const relevantMemories = await loadRelevantMemories(familyId, memoryCategoriesForIntent(intent))

  if (scope.mode === 'general') {
    const general = await buildGeneralContext(familyId)
    return { ok: true, scope, trip: null, general: { ...general, relevantMemories } }
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const result = await buildLumiContext(familyId, scope.tripId, todayIso)
  if (!result.ok) return { ok: false, message: lumiContextErrorMessage(result.reason) }

  const lumi = result.context
  const supabase = await createClient()
  const [{ data: stageLocations }, { data: tripStatusRow }] = await Promise.all([
    supabase.from('stages').select('location, title').eq('trip_id', lumi.tripId),
    supabase.from('trips').select('status, start_date, end_date').eq('id', lumi.tripId).maybeSingle(),
  ])

  const [hotelOptions, flightOptions] = await Promise.all([
    findMatchingHotelOptions(familyId, lumi.tripTitle, (stageLocations ?? []).map((s) => s.location ?? s.title)),
    findMatchingFlightOptions(familyId, lumi.countryCode),
  ])

  const tripDateRange = deriveTripDateRange(tripStatusRow ?? { start_date: null, end_date: null })
  const isHistorical = tripStatusRow
    ? isTripHistorical({ status: tripStatusRow.status, start_date: tripDateRange.startDate, end_date: tripDateRange.endDate }, todayIso)
    : false

  return {
    ok: true,
    scope,
    general: null,
    trip: {
      tripId: lumi.tripId, slug: lumi.tripSlug, title: lumi.tripTitle,
      isActive: lumi.isActive,
      isHistorical,
      lumi, hotelOptions, flightOptions, relevantMemories,
    },
  }
}
