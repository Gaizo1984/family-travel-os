import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { createCrud } from './_generic'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

type Tables = LumiCoreDatabase['public']['Tables']

/**
 * Phase 3, Gruppe 2: History / Memories / Preferences. Vorbereitet, NICHT
 * aktiv -- siehe lib/lumi-core-data/README.md.
 */

export const preferenceCategories = createCrud('travel_preference_categories')
export const pastTrips = createCrud('travel_past_trips')
export const personCountryVisits = createCrud('travel_person_country_visits')
export const memories = createCrud('travel_memories')
export const memoryPhotos = createCrud('travel_memory_photos')
export const memoryVideos = createCrud('travel_memory_videos')

export async function listPreferenceCategoriesForHousehold(householdId: string) {
  return preferenceCategories.listBy('household_id', householdId)
}
export async function listPastTripsForHousehold(householdId: string) {
  return pastTrips.listBy('household_id', householdId, 'year')
}
export async function listCountryVisitsForHouseholdMember(householdMemberId: string) {
  return personCountryVisits.listBy('household_member_id', householdMemberId)
}
export async function listMemoriesForHousehold(householdId: string) {
  return memories.listBy('household_id', householdId)
}
export async function listMemoriesForTrip(tripId: string) {
  return memories.listBy('trip_id', tripId)
}
export async function listMemoryPhotosForTrip(tripId: string) {
  return memoryPhotos.listBy('trip_id', tripId, 'sort_order')
}
export async function listMemoryPhotosForPastTrip(pastTripId: string) {
  return memoryPhotos.listBy('past_trip_id', pastTripId, 'sort_order')
}
export async function listMemoryVideosForTrip(tripId: string) {
  return memoryVideos.listBy('trip_id', tripId)
}

// ── Tabelle mit zusammengesetztem Primärschlüssel (kein `id`) ─────────────

export async function setPastTripTravelers(pastTripId: string, householdMemberIds: string[]): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error: deleteError } = await lumiCore.from('travel_past_trip_travelers').delete().eq('past_trip_id', pastTripId)
  if (deleteError) throw new Error(`setPastTripTravelers (delete): ${deleteError.message}`)
  if (householdMemberIds.length === 0) return
  const { error: insertError } = await lumiCore
    .from('travel_past_trip_travelers')
    .insert(householdMemberIds.map((householdMemberId) => ({ past_trip_id: pastTripId, household_member_id: householdMemberId })))
  if (insertError) throw new Error(`setPastTripTravelers (insert): ${insertError.message}`)
}

export async function listPastTripTravelers(pastTripId: string): Promise<Tables['travel_past_trip_travelers']['Row'][]> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_past_trip_travelers').select('*').eq('past_trip_id', pastTripId)
  if (error) throw new Error(`listPastTripTravelers: ${error.message}`)
  return data
}
