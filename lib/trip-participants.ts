import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingParticipantOption } from '@/app/(app)/trips/[id]/bookings/BookingForm'

/**
 * §"Teilnehmerauswahl nur bei Aktivitätsbuchungen" (Nutzervorgabe): Quelle
 * für die Checkbox-Optionen -- `trip_members` ist die bereits etablierte
 * "wer ist auf dieser Reise dabei"-Verknüpfung (siehe app/(app)/trips/[id]/page.tsx).
 * Fallback auf alle Personen der Familie, falls für die Reise keine
 * `trip_members` gepflegt sind (kein leerer Picker).
 */
export async function loadTripParticipantOptions(supabase: SupabaseClient, tripId: string, familyId: string): Promise<BookingParticipantOption[]> {
  const { data: members } = await supabase
    .from('trip_members')
    .select('persons ( id, name, initials, color )')
    .eq('trip_id', tripId)

  const fromMembers = (members ?? [])
    .map((m) => m.persons as unknown as BookingParticipantOption | null)
    .filter((p): p is BookingParticipantOption => Boolean(p))

  if (fromMembers.length > 0) return fromMembers

  const { data: allPersons } = await supabase
    .from('persons')
    .select('id, name, initials, color')
    .eq('family_id', familyId)
    .order('name')

  return allPersons ?? []
}
