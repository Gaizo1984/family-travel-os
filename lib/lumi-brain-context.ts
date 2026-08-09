import { createClient } from './supabase/server'
import { createLumiCoreClient } from './supabase/lumi-core-server'
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
  const lumiCore = await createLumiCoreClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  // §"Inspiration aus bisherigen Hotels" (Nutzervorgabe): nur Titel bereits
  // gebuchter Unterkünfte historischer Reisen -- keine neue "Lieblingshotels"-
  // Tabelle, keine Erfindung einer Bewertung, die nicht existiert. Bewusst
  // eine einzige Query (Buchungen sind ohnehin schon Teil der Trip-Abfrage
  // für die Datumsableitung) statt eines zweiten `trips!inner`-Joins.
  //
  // FINALER CUTOVER: `trips`/`stages`/`bookings` sind jetzt separate,
  // flache Lumi-Core-Abfragen (embedded Supabase-Joins über FK-Relationen
  // funktionieren nicht mehr 1:1, siehe Aufgabenbeschreibung) -- die
  // Etappen/Buchungen werden hier per `trip_id` gruppiert nachgebaut, damit
  // die untenstehende Logik (die dieselbe verschachtelte Form erwartet) unverändert bleibt.
  const [dna, travelWorld, { data: tripsRaw }] = await Promise.all([
    buildFamilyDnaSummary(familyId),
    buildTravelWorld({ familyId }),
    lumiCore.from('travel_trips')
      .select('id, slug, title, status, start_date, end_date')
      .eq('household_id', familyId),
  ])

  const tripIds = (tripsRaw ?? []).map((t) => t.id)
  const [{ data: stagesRaw }, { data: bookingsRaw }] = tripIds.length > 0
    ? await Promise.all([
        lumiCore.from('travel_stages').select('trip_id, start_date, end_date').in('trip_id', tripIds),
        lumiCore.from('travel_bookings').select('trip_id, type, title, status, start_datetime, end_datetime').in('trip_id', tripIds),
      ])
    : [{ data: [] as { trip_id: string; start_date: string | null; end_date: string | null }[] }, { data: [] as { trip_id: string; type: string; title: string; status: string; start_datetime: string | null; end_datetime: string | null }[] }]

  const stagesByTrip = new Map<string, { start_date: string | null; end_date: string | null }[]>()
  for (const s of stagesRaw ?? []) {
    const list = stagesByTrip.get(s.trip_id) ?? []
    list.push({ start_date: s.start_date, end_date: s.end_date })
    stagesByTrip.set(s.trip_id, list)
  }
  const bookingsByTrip = new Map<string, { type: string; title: string; status: string; start_datetime: string | null; end_datetime: string | null }[]>()
  for (const b of bookingsRaw ?? []) {
    const list = bookingsByTrip.get(b.trip_id) ?? []
    list.push({ type: b.type, title: b.title, status: b.status, start_datetime: b.start_datetime, end_datetime: b.end_datetime })
    bookingsByTrip.set(b.trip_id, list)
  }

  const trips = (tripsRaw ?? []).map((t) => ({
    ...t,
    stages: stagesByTrip.get(t.id) ?? [],
    bookings: bookingsByTrip.get(t.id) ?? [],
  }))
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
  const lumiCore = await createLumiCoreClient()
  const [{ data: stageLocations }, { data: tripStatusRow }] = await Promise.all([
    lumiCore.from('travel_stages').select('location, title').eq('trip_id', lumi.tripId),
    lumiCore.from('travel_trips').select('status, start_date, end_date').eq('id', lumi.tripId).maybeSingle(),
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
