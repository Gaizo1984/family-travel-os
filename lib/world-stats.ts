import { createClient } from '@/lib/supabase/server'
import { getTripDuration } from '@/lib/demo-data'

export type WorldStatsTrip = { id: string; title: string; start_date: string | null; end_date: string | null; status: string }
export type WorldStatsPastTrip = { id: string; country_or_region: string; country_code: string | null; year: number; duration_days: number | null }

export type WorldStats = {
  trips: WorldStatsTrip[]
  pastTrips: WorldStatsPastTrip[]
  tripsCount: number
  countryCodes: Set<string>
  travelDays: number
}

/**
 * Zentrale "Reisebilanz"-Berechnung (Reisen/Länder/Reisetage) — von der
 * Familienseite ("Unsere Welt") und dem Home-Dashboard gemeinsam genutzt,
 * damit beide Stellen garantiert dieselbe Zahl zeigen.
 */
export async function buildWorldStats(familyId: string): Promise<WorldStats> {
  const supabase = await createClient()

  const [{ data: tripsRaw }, { data: pastTripsRaw }] = await Promise.all([
    supabase.from('trips').select('id, title, start_date, end_date, status').eq('family_id', familyId),
    supabase.from('past_trips').select('id, country_or_region, country_code, year, duration_days').eq('family_id', familyId),
  ])

  const trips = (tripsRaw ?? []).filter((t) => t.status !== 'archived')
  const pastTrips = pastTripsRaw ?? []

  const { data: stageCountries } = await supabase
    .from('stages')
    .select('country_code, trip_id')
    .in('trip_id', trips.length > 0 ? trips.map((t) => t.id) : ['00000000-0000-0000-0000-000000000000'])

  const countryCodes = new Set<string>()
  ;(stageCountries ?? []).forEach((s) => { if (s.country_code) countryCodes.add(s.country_code) })
  pastTrips.forEach((p) => { if (p.country_code) countryCodes.add(p.country_code) })

  const travelDays =
    trips.reduce((sum, t) => sum + (t.start_date && t.end_date ? getTripDuration(t.start_date, t.end_date) : 0), 0) +
    pastTrips.reduce((sum, p) => sum + (p.duration_days ?? 0), 0)

  const tripsCount = trips.length + pastTrips.length

  return { trips, pastTrips, tripsCount, countryCodes, travelDays }
}
