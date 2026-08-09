import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getLumiCoreHouseholdId } from '@/lib/lumi-core-storage/paths'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

type TripRow = LumiCoreDatabase['public']['Tables']['travel_trips']['Row']
type TripInsert = LumiCoreDatabase['public']['Tables']['travel_trips']['Insert']

/** Gleiche Slugify-Logik wie lib/actions/trips.ts -- bewusst identisch, kein Verhaltensunterschied beim spaeteren Umverdrahten. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function listTrips(): Promise<TripRow[]> {
  const lumiCore = await createLumiCoreClient()
  const householdId = await getLumiCoreHouseholdId()
  if (!householdId) return []
  const { data, error } = await lumiCore
    .from('travel_trips')
    .select('*')
    .eq('household_id', householdId)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw new Error(`listTrips: ${error.message}`)
  return data
}

export async function getTripById(tripId: string): Promise<TripRow | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw new Error(`getTripById: ${error.message}`)
  return data
}

export async function getTripBySlug(slug: string): Promise<TripRow | null> {
  const lumiCore = await createLumiCoreClient()
  const householdId = await getLumiCoreHouseholdId()
  if (!householdId) return null
  const { data, error } = await lumiCore
    .from('travel_trips')
    .select('*')
    .eq('household_id', householdId)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`getTripBySlug: ${error.message}`)
  return data
}

async function uniqueSlug(lumiCore: Awaited<ReturnType<typeof createLumiCoreClient>>, householdId: string, baseSlug: string): Promise<string> {
  let slug = baseSlug || 'reise'
  for (let i = 1; i <= 99; i++) {
    const { data: existing } = await lumiCore.from('travel_trips').select('id').eq('household_id', householdId).eq('slug', slug).maybeSingle()
    if (!existing) return slug
    slug = `${baseSlug}-${i}`
  }
  return slug
}

export type CreateTripInput = {
  title: string
  destination: string
  status?: TripRow['status']
  startDate?: string | null
  endDate?: string | null
}

/**
 * Legt Trip + eine erste, undatierte Etappe an (gleiche zwei Schritte wie
 * lib/actions/trips.ts::createTrip) -- Mitglieder werden bewusst NICHT
 * hier gesetzt, siehe trip-members.ts::setTripMembers (getrennter Schritt,
 * gleiche Aufteilung wie im Original zwischen trips/trip_members-Insert).
 */
export async function createTrip(input: CreateTripInput): Promise<TripRow> {
  const lumiCore = await createLumiCoreClient()
  const householdId = await getLumiCoreHouseholdId()
  if (!householdId) throw new Error('createTrip: keine Lumi-Core-household_id gefunden')

  const finalTitle = input.title || input.destination
  const slug = await uniqueSlug(lumiCore, householdId, slugify(finalTitle))

  const insert: TripInsert = {
    household_id: householdId,
    slug,
    title: finalTitle,
    subtitle: input.destination,
    status: input.status ?? 'planned',
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
  }
  const { data: trip, error } = await lumiCore.from('travel_trips').insert(insert).select('*').single()
  if (error || !trip) throw new Error(`createTrip: ${error?.message ?? 'kein Ergebnis'}`)

  const { error: stageError } = await lumiCore.from('travel_stages').insert({
    trip_id: trip.id,
    title: input.destination,
    location: input.destination,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    sort_order: 0,
  })
  if (stageError) throw new Error(`createTrip (erste Etappe): ${stageError.message}`)

  return trip
}

export async function updateTrip(tripId: string, patch: Partial<TripInsert>): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_trips').update(patch).eq('id', tripId)
  if (error) throw new Error(`updateTrip: ${error.message}`)
}

export async function deleteTrip(tripId: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_trips').delete().eq('id', tripId)
  if (error) throw new Error(`deleteTrip: ${error.message}`)
}
