import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { createCrud } from './_generic'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

type Tables = LumiCoreDatabase['public']['Tables']

/**
 * Phase 3, Gruppe 1: Documents / Insurance / Journey / Packing.
 * Vorbereitet, NICHT aktiv -- siehe lib/lumi-core-data/README.md und
 * lib/lumi-core-storage/README.md fuer die Begruendung (RLS braucht eine
 * zuverlaessige Lumi-Core-Session, die erst mit dem finalen Login-Cutover
 * besteht). Person-Referenzen sind bereits beim urspruenglichen Copy auf
 * household_member_id umgeschrieben (siehe 02_copy_engine.js) -- diese
 * Funktionen arbeiten daher direkt mit household_member_id, keine erneute
 * Uebersetzung noetig (anders als bei NEUEN Eingaben aus noch nicht
 * umgestellten Formularen, siehe trip-members.ts::resolveTravelPersonIdsToHouseholdMemberIds
 * als Vorbild fuer den Uebergang).
 */

export const tripDays = createCrud('travel_trip_days')
export const budgetItems = createCrud('travel_budget_items')
export const documents = createCrud('travel_documents')
export const journeyEvents = createCrud('travel_journey_events')
export const insurancePolicies = createCrud('travel_insurance_policies')
export const packingLuggage = createCrud('travel_packing_luggage')
export const packingItems = createCrud('travel_packing_items')
export const packingListDrafts = createCrud('travel_packing_list_drafts')
export const journalEntries = createCrud('travel_journal_entries')
export const tripDebriefs = createCrud('travel_trip_debriefs')

export async function listTripDaysForTrip(tripId: string) {
  return tripDays.listBy('trip_id', tripId, 'date')
}
export async function listBudgetItemsForTrip(tripId: string) {
  return budgetItems.listBy('trip_id', tripId)
}
export async function listDocumentsForTrip(tripId: string) {
  return documents.listBy('trip_id', tripId)
}
export async function listDocumentsForHouseholdMember(householdMemberId: string) {
  return documents.listBy('household_member_id', householdMemberId)
}
export async function listJourneyEventsForTrip(tripId: string) {
  return journeyEvents.listBy('trip_id', tripId, 'date')
}
export async function getInsurancePolicyById(policyId: string) {
  return insurancePolicies.getById(policyId)
}
export async function listPackingLuggageForTrip(tripId: string) {
  return packingLuggage.listBy('trip_id', tripId, 'sort_order')
}
export async function listPackingItemsForTrip(tripId: string) {
  return packingItems.listBy('trip_id', tripId, 'sort_order')
}
export async function listJournalEntriesForTrip(tripId: string) {
  return journalEntries.listBy('trip_id', tripId, 'date')
}
export async function getTripDebriefForTrip(tripId: string): Promise<Tables['travel_trip_debriefs']['Row'] | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_trip_debriefs').select('*').eq('trip_id', tripId).maybeSingle()
  if (error) throw new Error(`getTripDebriefForTrip: ${error.message}`)
  return data
}

// ── Tabellen mit zusammengesetztem Primärschlüssel (kein `id`) ────────────

export async function setDocumentTrips(documentId: string, tripIds: string[]): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error: deleteError } = await lumiCore.from('travel_document_trips').delete().eq('document_id', documentId)
  if (deleteError) throw new Error(`setDocumentTrips (delete): ${deleteError.message}`)
  if (tripIds.length === 0) return
  const { error: insertError } = await lumiCore.from('travel_document_trips').insert(tripIds.map((tripId) => ({ document_id: documentId, trip_id: tripId })))
  if (insertError) throw new Error(`setDocumentTrips (insert): ${insertError.message}`)
}

export async function setInsurancePolicyPersons(policyId: string, householdMemberIds: string[]): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error: deleteError } = await lumiCore.from('travel_insurance_policy_persons').delete().eq('policy_id', policyId)
  if (deleteError) throw new Error(`setInsurancePolicyPersons (delete): ${deleteError.message}`)
  if (householdMemberIds.length === 0) return
  const { error: insertError } = await lumiCore
    .from('travel_insurance_policy_persons')
    .insert(householdMemberIds.map((householdMemberId) => ({ policy_id: policyId, household_member_id: householdMemberId })))
  if (insertError) throw new Error(`setInsurancePolicyPersons (insert): ${insertError.message}`)
}

export async function setInsurancePolicyTrips(policyId: string, tripIds: string[]): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error: deleteError } = await lumiCore.from('travel_insurance_policy_trips').delete().eq('policy_id', policyId)
  if (deleteError) throw new Error(`setInsurancePolicyTrips (delete): ${deleteError.message}`)
  if (tripIds.length === 0) return
  const { error: insertError } = await lumiCore.from('travel_insurance_policy_trips').insert(tripIds.map((tripId) => ({ policy_id: policyId, trip_id: tripId })))
  if (insertError) throw new Error(`setInsurancePolicyTrips (insert): ${insertError.message}`)
}

export async function upsertTripExchangeRate(input: Tables['travel_trip_exchange_rates']['Insert']): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_trip_exchange_rates').upsert(input, { onConflict: 'trip_id,currency' })
  if (error) throw new Error(`upsertTripExchangeRate: ${error.message}`)
}

export async function listTripExchangeRates(tripId: string): Promise<Tables['travel_trip_exchange_rates']['Row'][]> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_trip_exchange_rates').select('*').eq('trip_id', tripId)
  if (error) throw new Error(`listTripExchangeRates: ${error.message}`)
  return data
}
