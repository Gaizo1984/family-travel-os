import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { resolveHouseholdMemberId } from '@/lib/lumi-core-storage/paths'

export type TripMember = { tripId: string; householdMemberId: string; role: string | null }

export async function listTripMembers(tripId: string): Promise<TripMember[]> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_trip_members').select('*').eq('trip_id', tripId)
  if (error) throw new Error(`listTripMembers: ${error.message}`)
  return data.map((r) => ({ tripId: r.trip_id, householdMemberId: r.household_member_id, role: r.role }))
}

/**
 * Ersetzt die komplette Mitgliederliste einer Reise (gleiche Semantik wie
 * das bestehende Formular-Multiselect "members" in lib/actions/trips.ts).
 * Nimmt household_member_ids entgegen (native Form) -- solange
 * aufrufender Code noch travel_person_id kennt, siehe
 * resolveTravelPersonIdsToHouseholdMemberIds() unten als Uebergangshilfe.
 */
export async function setTripMembers(tripId: string, householdMemberIds: string[]): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error: deleteError } = await lumiCore.from('travel_trip_members').delete().eq('trip_id', tripId)
  if (deleteError) throw new Error(`setTripMembers (delete): ${deleteError.message}`)
  if (householdMemberIds.length === 0) return
  const { error: insertError } = await lumiCore
    .from('travel_trip_members')
    .insert(householdMemberIds.map((householdMemberId) => ({ trip_id: tripId, household_member_id: householdMemberId })))
  if (insertError) throw new Error(`setTripMembers (insert): ${insertError.message}`)
}

export async function addTripMember(tripId: string, householdMemberId: string, role: string | null = null): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_trip_members').upsert({ trip_id: tripId, household_member_id: householdMemberId, role })
  if (error) throw new Error(`addTripMember: ${error.message}`)
}

export async function removeTripMember(tripId: string, householdMemberId: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_trip_members').delete().eq('trip_id', tripId).eq('household_member_id', householdMemberId)
  if (error) throw new Error(`removeTripMember: ${error.message}`)
}

/** Uebergangshilfe: solange Formulare noch travel_person_id liefern (vor dem finalen Cutover), hier auf household_member_id abbilden. */
export async function resolveTravelPersonIdsToHouseholdMemberIds(travelPersonIds: string[]): Promise<string[]> {
  const resolved = await Promise.all(travelPersonIds.map((id) => resolveHouseholdMemberId(id)))
  return resolved.filter((id): id is string => id !== null)
}
