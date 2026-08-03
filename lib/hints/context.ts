import type { SupabaseClient } from '@supabase/supabase-js'
import { computeTripRequirements } from '@/lib/travel-requirements'
import type { HintContext } from './types'

/**
 * §Einmal pro Reise geladen, gleiches Muster wie buildRequirementContext
 * (lib/travel-requirements.ts) -- läuft unter dem Service-Role-Client des
 * Generierungs-Crons (lib/hints/registry.ts), deshalb KEIN cookie-basierter
 * Default-Client hier (siehe Kommentar in lib/supabase/service-role.ts).
 */
export async function buildHintContext(supabase: SupabaseClient, tripId: string, familyId: string, tripSlug: string): Promise<HintContext> {
  const [{ data: bookingsRaw }, { data: documentsRaw }, { data: journeyEventsRaw }, travelRequirements] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, type, title, status, payment_status, booking_reference, start_datetime, end_datetime, stage_id, details, participant_person_ids')
      .eq('trip_id', tripId)
      .neq('status', 'cancelled'),
    supabase.from('documents').select('id, booking_id, doc_type').eq('trip_id', tripId),
    supabase
      .from('journey_events')
      .select('id, date, time, category, title, status, participant_person_ids')
      .eq('trip_id', tripId),
    computeTripRequirements(tripId, `/trips/${tripSlug}/ready-to-travel`, supabase),
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
