'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeRoute, type ComputeRouteResult } from '@/lib/providers/routes-provider'
import { ProviderConfigError } from '@/lib/providers/provider-errors'
import { generateFiveRecommendations } from '@/lib/concierge-ai'
import { buildLumiContext, lumiContextErrorMessage, type LumiContext } from '@/lib/lumi-context'
import { describeWeatherCode } from '@/lib/weather'
import { ageAtDate } from '@/lib/family-dna'
import { hasRealTime } from '@/lib/bookings'
import { expandBookingOccurrences, type TimelineBooking, type TimelineEvent } from '@/lib/journey'
import { getTodayCategoryConfig, type TodayCategoryKey, type TodayCategoryConfig } from '@/lib/today-categories'
import { loadRelevantMemories, formatMemoriesForPrompt, MEMORY_CATEGORIES_BY_INTENT } from '@/lib/family-memories'
import { originKeyFor, buildCategoryPlaceItems, type CategoryPlaceItem, type CategoryCandidateFact } from '@/lib/category-places-shared'
import { getCategoryPlaces, searchCategoryCandidates, writeCategoryPlacesCache } from '@/lib/actions/category-places'

/**
 * §"Tagesplaner 2.0" (Nutzervorgabe): freies Zieldatum statt der bisherigen
 * heute/morgen-Modi (v1, siehe Git-Historie) -- Voraussetzung dafür, dass
 * die Journey einen beliebigen freien Reisetag direkt an den Tagesplaner
 * übergeben kann. Erzeugt drei Varianten (Entspannt/Ausgewogen/
 * Erlebnisreich) aus EINEM gemeinsamen Kandidatenpool (siehe
 * `resolveCandidatePool`) statt dreier unabhängiger Places-/Routes-/KI-
 * Durchläufe. Ausschließlich Vorschau -- Speicherung erst nach expliziter
 * Variantenwahl über `commitDayPlanVariantToJourney`
 * (lib/actions/lumi-journey.ts).
 */

export type DayPlanPace = 'entspannt' | 'ausgewogen' | 'erlebnisreich'

export type DayPlanStop = {
  placeId: string; name: string; category: TodayCategoryKey
  /** "HH:MM", echte Uhrzeit ab dem ersten freien Zeitfenster des Tages -- niemals erfunden, siehe computeFreeWindows. */
  time: string | null
  travelMinutes: number; travelDistanceKm: number; stopDurationMinutes: number
  why: string | null
}

export type DayPlanVariant = {
  pace: DayPlanPace
  title: string
  stops: DayPlanStop[]
  totalTravelMinutes: number; totalTravelDistanceKm: number
  mealBreakNote: string | null; weatherNote: string | null; kidsNote: string | null
  returnNote: string
}

export type DayPlan = {
  date: string
  originLabel: string
  variants: DayPlanVariant[]
  /** Erklärender Hinweis, wenn für den Tag keine/kaum Varianten möglich waren (zu wenig freie Zeit) -- kein erzwungener Plan. */
  freeWindowNote: string | null
  generatedAt: string
  /** §"Zwischenstopp-Planung optional" (Nutzervorgabe): mit welchem Umschalter-Stand dieser Plan erzeugt wurde -- ein gecachter Plan wird nur bei übereinstimmendem Umschalter erneut angezeigt (siehe app/(app)/today/plan/page.tsx). */
  preferStopover: boolean
}

const PACE_CONFIG: Record<DayPlanPace, { label: string; maxStops: number; categories: TodayCategoryKey[] }> = {
  entspannt: { label: 'Entspannt', maxStops: 2, categories: ['beaches', 'nature', 'restaurants'] },
  ausgewogen: { label: 'Ausgewogen', maxStops: 3, categories: ['activities', 'nature', 'beaches', 'restaurants'] },
  erlebnisreich: { label: 'Erlebnisreich', maxStops: 4, categories: ['activities', 'beaches', 'nature', 'restaurants'] },
}
const CANDIDATE_CATEGORIES: TodayCategoryKey[] = ['activities', 'restaurants', 'beaches', 'nature']
/** Grobe, deterministische Aufenthaltsdauer je Kategorie -- keine erfundene KI-Zahl, nur eine transparente Faustregel (identisch zum v1-Muster). */
const STOP_DURATION_MINUTES: Record<TodayCategoryKey, number> = {
  restaurants: 75, beaches: 120, activities: 90, nature: 100, family: 90,
}

const DAY_WINDOW_START = '09:00'
const DAY_WINDOW_END = '21:00'
/** §"Bestehende Termine als echte blockierte Zeitfenster berücksichtigen": Sicherheitsabstand vor/nach einem feststehenden Termin, kein knappes Aneinanderreihen. */
const COMMITMENT_BUFFER_MINUTES = 45
/** §"Keine erzwungene Planung, wenn zu wenig freie Zeit vorhanden ist": unter dieser Schwelle wird gar nicht erst versucht, Varianten zu bauen. */
const MIN_USABLE_FREE_MINUTES = 90

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

type TimeWindow = { startMinutes: number; endMinutes: number }

/**
 * §"Bestehende Termine als echte blockierte Zeitfenster berücksichtigen,
 * keine erfundenen Fahr-/Aufenthaltszeiten" (Nutzervorgabe): nur Buchungen/
 * Journey-Termine mit einer ECHTEN Uhrzeit (siehe hasRealTime) blockieren
 * Zeit -- ein Termin ohne bekannte Uhrzeit könnte irgendwann am Tag
 * stattfinden, dafür lässt sich kein verlässliches Zeitfenster ausschließen.
 */
function computeFreeWindows(dateIso: string, bookings: TimelineBooking[], events: TimelineEvent[]): TimeWindow[] {
  const blocked: TimeWindow[] = []

  for (const occ of expandBookingOccurrences(bookings.filter((b) => b.status !== 'cancelled'))) {
    if (occ.date !== dateIso) continue
    const rawTime = occ.booking.start_datetime?.slice(11, 16) ?? null
    if (!hasRealTime(rawTime)) continue
    const startMin = timeToMinutes(rawTime!)
    blocked.push({ startMinutes: Math.max(0, startMin - COMMITMENT_BUFFER_MINUTES), endMinutes: startMin + COMMITMENT_BUFFER_MINUTES })
  }
  for (const e of events) {
    if (e.date !== dateIso || !hasRealTime(e.time)) continue
    const startMin = timeToMinutes(e.time!)
    blocked.push({ startMinutes: Math.max(0, startMin - COMMITMENT_BUFFER_MINUTES), endMinutes: startMin + COMMITMENT_BUFFER_MINUTES })
  }
  blocked.sort((a, b) => a.startMinutes - b.startMinutes)

  let windows: TimeWindow[] = [{ startMinutes: timeToMinutes(DAY_WINDOW_START), endMinutes: timeToMinutes(DAY_WINDOW_END) }]
  for (const block of blocked) {
    const next: TimeWindow[] = []
    for (const w of windows) {
      if (block.endMinutes <= w.startMinutes || block.startMinutes >= w.endMinutes) { next.push(w); continue }
      if (block.startMinutes > w.startMinutes) next.push({ startMinutes: w.startMinutes, endMinutes: block.startMinutes })
      if (block.endMinutes < w.endMinutes) next.push({ startMinutes: block.endMinutes, endMinutes: w.endMinutes })
    }
    windows = next
  }
  return windows.filter((w) => w.endMinutes - w.startMinutes >= 15)
}

function totalFreeMinutes(windows: TimeWindow[]): number {
  return windows.reduce((sum, w) => sum + (w.endMinutes - w.startMinutes), 0)
}

/**
 * §"Wiederverwendbare Funktionen prüfen, keine neue Places-/Routes-/KI-
 * Logik" (Nutzervorgabe): liest für jede der vier Kategorien zuerst
 * `category_places_cache` (bereits vom "Heute"-Feature genutzt und
 * befüllt) -- nur fehlende Kategorien lösen `searchCategoryCandidates`
 * (Places-Suche + Route-Matrix, KEINE KI) aus. Für alle so gesammelten
 * fehlenden Kategorien läuft anschließend GENAU EINE gemeinsame
 * `generateFiveRecommendations`-Runde (nicht eine pro Kategorie) -- deren
 * Ergebnis wird pro Kategorie in den bestehenden Cache zurückgeschrieben
 * (Selbstheilung inkl. der neu ergänzten lat/lng-Felder).
 */
async function resolveCandidatePool(
  familyId: string, tripId: string, origin: LumiContext['origin'],
  dnaTextForAi: string, members: Array<{ name: string; age: number | null; isMinor: boolean }>, weatherSummary: string | null,
): Promise<Map<TodayCategoryKey, CategoryPlaceItem[]>> {
  const originKey = originKeyFor(origin)
  const pool = new Map<TodayCategoryKey, CategoryPlaceItem[]>()
  const misses: Array<{ category: TodayCategoryKey; facts: CategoryCandidateFact[] }> = []

  for (const category of CANDIDATE_CATEGORIES) {
    const cached = await getCategoryPlaces(familyId, tripId, category, originKey)
    if (cached) { pool.set(category, cached.items); continue }

    const config: TodayCategoryConfig | null = getTodayCategoryConfig(category)
    if (!config) { pool.set(category, []); continue }

    const result = await searchCategoryCandidates(origin, config)
    if (result.ok) misses.push({ category, facts: result.facts })
    else pool.set(category, []) // kein Treffer für diese Kategorie -- der restliche Tagesplan darf trotzdem entstehen
  }

  if (misses.length > 0) {
    const combinedCandidates = misses.flatMap((m) => m.facts.map((f) => ({
      name: f.place.name, category: m.category,
      rating: f.place.rating, userRatingCount: f.place.userRatingCount, openNow: f.place.openNow,
      durationMinutes: f.durationMinutes, distanceKm: f.distanceKm,
    })))

    // §"Nur eine KI-Bewertungsrunde für den gemeinsamen Kandidatenpool":
    // EIN Aufruf über alle fehlenden Kategorien zusammen, nicht einer je
    // Kategorie. generateFiveRecommendations liefert (wie auch beim
    // bestehenden "Heute"-Feature) höchstens 5 Begründungen zurück -- Orte
    // ohne Begründung bekommen `why: null` und bleiben trotzdem als Fakten-
    // basierter Kandidat nutzbar (siehe selectStopsForPace).
    const picks = await generateFiveRecommendations({
      locationLabel: origin.formattedAddress, candidates: combinedCandidates,
      familyDnaText: dnaTextForAi, members, weatherSummary,
    })

    for (const m of misses) {
      const items = buildCategoryPlaceItems(m.facts, picks)
      pool.set(m.category, items)
      await writeCategoryPlacesCache(familyId, tripId, m.category, originKey, origin.formattedAddress, origin.source, items)
    }
  }

  return pool
}

type PoolCandidate = CategoryPlaceItem & { category: TodayCategoryKey }

/** Ein Ort kann in mehreren Kategorien auftauchen (z. B. Strand mit Wassersport-Aktivität) -- global auf placeId dedupliziert, keine Koordinaten -> nicht routenfähig (siehe CategoryPlaceItem-Kommentar). */
function flattenPool(pool: Map<TodayCategoryKey, CategoryPlaceItem[]>): PoolCandidate[] {
  const seenPlaceIds = new Set<string>()
  const flat: PoolCandidate[] = []
  for (const [category, items] of pool) {
    for (const item of items) {
      if (seenPlaceIds.has(item.placeId)) continue
      if (item.lat == null || item.lng == null) continue
      seenPlaceIds.add(item.placeId)
      flat.push({ ...item, category })
    }
  }
  return flat
}

/** Deterministische Auswahl je Variante: bevorzugt KI-begründete und besser bewertete Kandidaten, erste Runde mit Kategorie-Vielfalt, zweite Runde füllt bei Bedarf unabhängig von der Kategorie auf. */
function selectStopsForPace(pace: DayPlanPace, pool: PoolCandidate[]): PoolCandidate[] {
  const config = PACE_CONFIG[pace]
  const eligible = pool
    .filter((c) => config.categories.includes(c.category))
    .sort((a, b) => {
      const aHasWhy = a.why ? 1 : 0
      const bHasWhy = b.why ? 1 : 0
      if (aHasWhy !== bHasWhy) return bHasWhy - aHasWhy
      return (b.rating ?? 0) - (a.rating ?? 0)
    })

  const selected: PoolCandidate[] = []
  const usedCategories = new Set<TodayCategoryKey>()
  for (const c of eligible) {
    if (selected.length >= config.maxStops) break
    if (usedCategories.has(c.category)) continue
    selected.push(c)
    usedCategories.add(c.category)
  }
  for (const c of eligible) {
    if (selected.length >= config.maxStops) break
    if (selected.includes(c)) continue
    selected.push(c)
  }
  return selected
}

/**
 * Reihenfolge über `computeRoute` (echte Fahrzeiten, optimierte
 * Reihenfolge -- identisch zum v1-Muster), dann Einpassung in die freien
 * Zeitfenster: Stopps, die nicht mehr hineinpassen, entfallen ersatzlos
 * (keine erzwungene Planung, kein Sprung über einen bereits feststehenden
 * Termin hinweg).
 */
async function buildVariant(
  pace: DayPlanPace, candidates: PoolCandidate[], origin: LumiContext['origin'],
  freeWindows: TimeWindow[], weatherDaily: LumiContext['weather'], dna: LumiContext['dna'], dateIso: string, originLabel: string,
): Promise<DayPlanVariant | null> {
  if (candidates.length === 0 || freeWindows.length === 0) return null

  let route: ComputeRouteResult | null
  try {
    route = await computeRoute({
      origin: { lat: origin.lat, lng: origin.lng }, destination: { lat: origin.lat, lng: origin.lng },
      waypoints: candidates.map((c) => ({ lat: c.lat!, lng: c.lng! })),
      optimizeWaypointOrder: candidates.length > 1,
    })
  } catch {
    return null
  }
  if (!route) return null

  const order = route.optimizedWaypointOrder ?? candidates.map((_, i) => i)
  const orderedCandidates = order.map((i) => candidates[i])

  const stops: DayPlanStop[] = []
  let windowIndex = 0
  let cursorMinutes = freeWindows[0].startMinutes
  let totalTravelMinutes = 0
  let totalTravelDistanceKm = 0

  for (let i = 0; i < orderedCandidates.length; i++) {
    const cand = orderedCandidates[i]
    const leg = route.legs[i]
    const travelMinutes = Math.round((leg?.durationSeconds ?? 0) / 60)
    const travelDistanceKm = Math.round((leg?.distanceMeters ?? 0) / 100) / 10
    const stopDuration = STOP_DURATION_MINUTES[cand.category] ?? 90

    while (windowIndex < freeWindows.length && cursorMinutes + travelMinutes > freeWindows[windowIndex].endMinutes) {
      windowIndex++
      if (windowIndex < freeWindows.length) cursorMinutes = Math.max(cursorMinutes, freeWindows[windowIndex].startMinutes)
    }
    if (windowIndex >= freeWindows.length) break

    const arrivalMinutes = cursorMinutes + travelMinutes
    if (arrivalMinutes + stopDuration > freeWindows[windowIndex].endMinutes) break

    stops.push({
      placeId: cand.placeId, name: cand.name, category: cand.category,
      time: minutesToTime(arrivalMinutes),
      travelMinutes, travelDistanceKm, stopDurationMinutes: stopDuration,
      why: cand.why,
    })
    totalTravelMinutes += travelMinutes
    totalTravelDistanceKm += travelDistanceKm
    cursorMinutes = arrivalMinutes + stopDuration
  }

  if (stops.length === 0) return null

  const minorNames = dna.persons.filter((p) => p.is_minor).map((p) => p.name)
  const dayForecast = weatherDaily?.daily.find((d) => d.date === dateIso) ?? null

  return {
    pace, title: `${PACE_CONFIG[pace].label} ab ${originLabel}`,
    stops, totalTravelMinutes, totalTravelDistanceKm,
    mealBreakNote: stops.length >= 2 && !stops.some((s) => s.category === 'restaurants')
      ? 'Pause/Mittagessen selbst einplanen -- kein Restaurant-Stopp in diesem Plan.' : null,
    weatherNote: dayForecast
      ? `${dayForecast.tempMin}-${dayForecast.tempMax}°C, ${describeWeatherCode(dayForecast.code).label}${dayForecast.precipitationProbability !== null ? ` · ${dayForecast.precipitationProbability}% Regen` : ''}.`
      : null,
    kidsNote: minorNames.length > 0 ? `Mit dabei: ${minorNames.join(', ')}.` : null,
    returnNote: `Rückkehr zum Ausgangspunkt eingerechnet -- letzter Stopp endet ca. ${minutesToTime(cursorMinutes)} Uhr.`,
  }
}

export type DayPlanGenerationResult =
  | { ok: true; plan: DayPlan }
  | { ok: false; reason: string }

/**
 * Zentrale Erzeugungsfunktion -- reine Vorschau, kein Journey-Schreibzugriff
 * (siehe `lib/actions/lumi-journey.ts::commitDayPlanVariantToJourney` für die
 * explizite Bestätigung). `dateIso` wird direkt als Referenzdatum an
 * `buildLumiContext` durchgereicht -- löst damit Hotel/Etappe für GENAU
 * DIESEN Tag auf (§Bugfix ggü. v1, das immer das reale Heute für die
 * Ausgangspunkt-Auflösung nutzte, auch im Modus "morgen").
 */
export async function generateDayPlanPreview(familyId: string, tripId: string, dateIso: string, preferStopover = false): Promise<DayPlanGenerationResult> {
  const contextResult = await buildLumiContext(familyId, tripId, dateIso, preferStopover)
  if (!contextResult.ok) return { ok: false, reason: lumiContextErrorMessage(contextResult.reason) }
  const context = contextResult.context

  const freeWindows = computeFreeWindows(dateIso, context.allBookings, context.allEvents)
  const freeMinutes = totalFreeMinutes(freeWindows)
  if (freeMinutes < MIN_USABLE_FREE_MINUTES) {
    return {
      ok: true,
      plan: {
        date: dateIso, originLabel: context.origin.formattedAddress, variants: [],
        freeWindowNote: 'An diesem Tag ist zu wenig freie Zeit für einen Tagesplan -- bereits feststehende Termine füllen den Tag weitgehend aus.',
        generatedAt: new Date().toISOString(), preferStopover,
      },
    }
  }

  // §"Bestätigte Vorlieben berücksichtigen, keine neue Memory-Logik": nutzt
  // die bereits bestehende Intent-Kategorie "journey_support" (lib/family-
  // memories.ts) unverändert -- dieselbe Filterung/Formatierung wie Frag LUMI.
  const memories = await loadRelevantMemories(familyId, MEMORY_CATEGORIES_BY_INTENT.journey_support)
  const memoriesText = formatMemoriesForPrompt(memories)
  const dnaTextForAi = [context.dnaText, memoriesText].filter(Boolean).join(' ')
  const members = context.dna.persons.map((p) => ({ name: p.name, age: ageAtDate(p.birth_date, dateIso), isMinor: p.is_minor }))
  const dayForecast = context.weather?.daily.find((d) => d.date === dateIso) ?? null
  const weatherSummary = dayForecast ? `${dayForecast.tempMin}-${dayForecast.tempMax}°C, ${describeWeatherCode(dayForecast.code).label}` : null

  let pool: Map<TodayCategoryKey, CategoryPlaceItem[]>
  try {
    pool = await resolveCandidatePool(familyId, tripId, context.origin, dnaTextForAi, members, weatherSummary)
  } catch (e) {
    const message = e instanceof ProviderConfigError
      ? 'LUMI ist aktuell nicht konfiguriert -- bitte Support informieren.'
      : 'Die Suche ist gerade fehlgeschlagen -- bitte in Kürze erneut versuchen.'
    return { ok: false, reason: message }
  }

  const flatPool = flattenPool(pool)
  if (flatPool.length === 0) return { ok: false, reason: 'Keine geeigneten Orte in plausibler Fahrzeit gefunden.' }

  const variants: DayPlanVariant[] = []
  for (const pace of ['entspannt', 'ausgewogen', 'erlebnisreich'] as DayPlanPace[]) {
    const candidates = selectStopsForPace(pace, flatPool)
    const variant = await buildVariant(pace, candidates, context.origin, freeWindows, context.weather, context.dna, dateIso, context.origin.formattedAddress)
    if (variant) variants.push(variant)
  }

  if (variants.length === 0) {
    return {
      ok: true,
      plan: {
        date: dateIso, originLabel: context.origin.formattedAddress, variants: [],
        freeWindowNote: 'Für diesen Tag konnte kein Tagesplan erzeugt werden -- zu wenig freie Zeit oder keine ausreichend nahen Orte.',
        generatedAt: new Date().toISOString(), preferStopover,
      },
    }
  }

  return { ok: true, plan: { date: dateIso, originLabel: context.origin.formattedAddress, variants, freeWindowNote: null, generatedAt: new Date().toISOString(), preferStopover } }
}

/** Zuletzt für diesen Tag erzeugter Plan -- Vorschau bleibt bei Navigation bestehen, bis eine neue Ermittlung sie überschreibt (gleiches Muster wie v1). */
export async function getLatestDayPlan(familyId: string, tripId: string, dateIso: string): Promise<DayPlan | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('day_plan_cache')
    .select('plan')
    .eq('family_id', familyId).eq('trip_id', tripId).eq('date', dateIso)
    .maybeSingle()

  if (!data) return null
  return data.plan as unknown as DayPlan
}

/** Server-Action-Fassade fürs Formular -- Vorschau erzeugen und cachen, nie direkt in die Journey schreiben. */
export async function generateDayPlan(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const date = String(formData.get('date') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today/plan')
  const preferStopover = String(formData.get('prefer_stopover') ?? '') === '1'

  if (!familyId || !tripId || !date) redirect('/today')

  const result = await generateDayPlanPreview(familyId, tripId, date, preferStopover)
  const redirectParams = new URLSearchParams({ date })
  if (preferStopover) redirectParams.set('stopover', '1')

  if (!result.ok) {
    redirectParams.set('error', result.reason)
    redirect(`${returnTo}?${redirectParams.toString()}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('day_plan_cache').upsert(
    { family_id: familyId, trip_id: tripId, date, mode: 'tagesplan', plan: result.plan, updated_at: new Date().toISOString() },
    { onConflict: 'family_id,trip_id,date' },
  )
  if (error) console.error('[day-planner] cache upsert failed', { date, error: error.message })

  redirect(`${returnTo}?${redirectParams.toString()}`)
}
