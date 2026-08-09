import type { SupabaseClient } from '@supabase/supabase-js'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'
import { computeTripRequirements } from '@/lib/travel-requirements'
import type { HintContext } from './types'

/**
 * §Einmal pro Reise geladen, gleiches Muster wie buildRequirementContext
 * (lib/travel-requirements.ts) -- läuft unter dem Lumi-Core-Service-Role-
 * Client des Generierungs-Crons (lib/hints/registry.ts / lib/hint-generation.ts),
 * deshalb kein cookie-basierter Default-Client hier.
 *
 * FINALER CUTOVER: `bookings`/`documents`/`journey_events` -> `travel_bookings`/
 * `travel_documents`/`travel_journey_events`, `participant_person_ids` ->
 * `participant_household_member_ids` (siehe lib/hints/types.ts).
 */
export async function buildHintContext(lumiCore: SupabaseClient<LumiCoreDatabase>, tripId: string, familyId: string, tripSlug: string): Promise<HintContext> {
  const [{ data: bookingsRaw }, { data: documentsRaw }, { data: journeyEventsRaw }, travelRequirements] = await Promise.all([
    lumiCore
      .from('travel_bookings')
      .select('id, type, title, status, payment_status, booking_reference, start_datetime, end_datetime, stage_id, details, participant_household_member_ids')
      .eq('trip_id', tripId)
      .neq('status', 'cancelled'),
    lumiCore.from('travel_documents').select('id, booking_id, doc_type').eq('trip_id', tripId),
    lumiCore
      .from('travel_journey_events')
      .select('id, date, time, category, title, status, participant_household_member_ids')
      .eq('trip_id', tripId),
    computeTripRequirements(tripId, `/trips/${tripSlug}/ready-to-travel`, lumiCore),
  ])

  return {
    tripId,
    tripSlug,
    familyId,
    now: new Date(),
    bookings: (bookingsRaw ?? []) as HintContext['bookings'],
    documents: (documentsRaw ?? []) as HintContext['documents'],
    journeyEvents: (journeyEventsRaw ?? []) as HintContext['journeyEvents'],
    travelRequirements,
  }
}
