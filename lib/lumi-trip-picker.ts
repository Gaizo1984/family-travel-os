import { createClient } from './supabase/server'
import { deriveTripDateRange, formatTripDateRangeLabel, type TripDateRange } from './trip-dates'
import { isTripCurrentlyRunning, isTripHistorical } from './trip-status'
import { COUNTRY_NAMES } from './geo-suggestions'

/**
 * §"Reiseauswahl in Frag LUMI" (Nutzervorgabe, wörtlich: "lib/lumi-trip-picker.ts
 * als einzige zentrale Quelle für Reiseauswahl und Text-Matching verwenden --
 * keine parallele Matching-Logik in UI und askConcierge"): EINE Liste, EIN
 * Matching, von der Picker-UI (components/LumiTripPicker.tsx) UND der
 * automatischen Texterkennung (lib/actions/concierge-actions.ts) gemeinsam
 * genutzt. Baut ausschließlich auf bereits bestehenden Bausteinen auf
 * (deriveTripDateRange/isTripCurrentlyRunning/isTripHistorical/COUNTRY_NAMES)
 * -- keine neue Reise-/Statuslogik.
 */

export type TripPickerStatus = 'upcoming' | 'active' | 'historical'

export type TripPickerEntry = {
  id: string
  slug: string
  title: string
  startDate: string | null
  endDate: string | null
  dateRangeLabel: string
  destinationLabel: string | null
  /** Titel, Ziel, alle Etappenorte, Ländernamen -- normalisiert erst beim Matching selbst (matchTripsFromText). */
  matchTerms: string[]
  status: TripPickerStatus
}

type TripPickerRow = {
  id: string; slug: string; title: string; status: string
  start_date: string | null; end_date: string | null
  stages: Array<{ location: string | null; title: string; country_code: string | null; start_date: string | null; end_date: string | null }>
  bookings: Array<{ type: string; status: string; start_datetime: string | null; end_datetime: string | null }>
}

function tripStatus(range: TripDateRange, dbStatus: string, todayIso: string): TripPickerStatus {
  const tripLike = { status: dbStatus, start_date: range.startDate, end_date: range.endDate }
  if (isTripHistorical(tripLike, todayIso)) return 'historical'
  if (isTripCurrentlyRunning(tripLike, todayIso)) return 'active'
  return 'upcoming'
}

function buildMatchTerms(title: string, destinationLabel: string | null, stages: TripPickerRow['stages']): string[] {
  const countryNames = stages
    .map((s) => (s.country_code ? COUNTRY_NAMES[s.country_code] : null))
    .filter((c): c is string => Boolean(c))
  const stageLocations = stages.map((s) => s.location ?? s.title).filter(Boolean)
  return [...new Set([title, destinationLabel, ...stageLocations, ...countryNames].filter((t): t is string => Boolean(t)))]
}

/** Eine Query, alle Reisen der Familie -- laufend, geplant UND vergangen (Vorgabe: "vergangene Reisen im Picker zulassen"). */
export async function listTripsForPicker(familyId: string, todayIso: string = new Date().toISOString().slice(0, 10)): Promise<TripPickerEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('trips')
    .select('id, slug, title, status, start_date, end_date, stages ( location, title, country_code, start_date, end_date ), bookings ( type, status, start_datetime, end_datetime )')
    .eq('family_id', familyId)

  const rows = (data ?? []) as unknown as TripPickerRow[]
  const entries: TripPickerEntry[] = rows.map((t) => {
    const range = deriveTripDateRange(t, t.bookings, t.stages)
    const destinationLabel = t.stages[0]?.location ?? t.stages[0]?.title ?? null
    return {
      id: t.id, slug: t.slug, title: t.title,
      startDate: range.startDate, endDate: range.endDate,
      dateRangeLabel: formatTripDateRangeLabel(range),
      destinationLabel,
      matchTerms: buildMatchTerms(t.title, destinationLabel, t.stages),
      status: tripStatus(range, t.status, todayIso),
    }
  })

  const nonHistorical = entries
    .filter((e) => e.status !== 'historical')
    .sort((a, b) => (a.startDate ?? '9999-99-99').localeCompare(b.startDate ?? '9999-99-99'))
  const historical = entries
    .filter((e) => e.status === 'historical')
    .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))

  return [...nonHistorical, ...historical]
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * §"Automatische Erkennung aus Fragen" (Nutzervorgabe): reines,
 * synchrones Keyword-Matching -- kein zweiter KI-Aufruf. Gibt ALLE Treffer
 * zurück; der Aufrufer entscheidet (1 Treffer = eindeutig, >1 = Auswahl
 * anbieten statt zu raten).
 */
export function matchTripsFromText(questionText: string, trips: TripPickerEntry[]): TripPickerEntry[] {
  const normalizedText = normalizeForMatch(questionText)
  return trips.filter((trip) =>
    trip.matchTerms.some((term) => {
      const normTerm = normalizeForMatch(term)
      return normTerm.length > 2 && normalizedText.includes(normTerm)
    }),
  )
}

/**
 * §"Standardauswahl" (Nutzervorgabe, Prioritätskette wörtlich): aktiv
 * laufende Reise > zuletzt verwendete Reise (falls noch vorhanden) > nächste
 * bevorstehende Reise > null (= Allgemein, wenn nichts davon zutrifft).
 */
export function resolveDefaultTripId(trips: TripPickerEntry[], rememberedTripId: string | null): string | null {
  if (trips.length === 0) return null
  const active = trips.find((t) => t.status === 'active')
  if (active) return active.id
  if (rememberedTripId && trips.some((t) => t.id === rememberedTripId)) return rememberedTripId
  const nextUpcoming = trips.find((t) => t.status === 'upcoming')
  if (nextUpcoming) return nextUpcoming.id
  return null
}

/** §"Nur für diese Familie speichern" (Nutzervorgabe): liest die serverseitig gemerkte letzte Reise -- kein Cookie, siehe lib/actions/lumi-trip-selection.ts. */
export async function getRememberedTripId(familyId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('families').select('last_lumi_trip_id').eq('id', familyId).maybeSingle()
  return data?.last_lumi_trip_id ?? null
}
