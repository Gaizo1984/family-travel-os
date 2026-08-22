import type { SupabaseClient } from '@supabase/supabase-js'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { listHouseholdMembers, deriveInitials } from '@/lib/household-members'
import type { BookingParticipantOption } from '@/app/(app)/trips/[id]/bookings/BookingForm'

/**
 * §"Teilnehmerauswahl nur bei Aktivitätsbuchungen" (Nutzervorgabe): Quelle
 * für die Checkbox-Optionen -- `travel_trip_members` ist die bereits
 * etablierte "wer ist auf dieser Reise dabei"-Verknüpfung (siehe
 * app/(app)/trips/[id]/page.tsx). Fallback auf alle Mitglieder des
 * Haushalts, falls für die Reise keine `travel_trip_members` gepflegt sind
 * (kein leerer Picker).
 *
 * FINALER CUTOVER: `supabase`/`familyId` bleiben in der Signatur erhalten
 * (Kompatibilität zu den bestehenden Aufrufern in app/(app)/trips/[id]/...),
 * werden aber nicht mehr für die eigentliche Abfrage genutzt -- diese läuft
 * jetzt ausschließlich gegen Lumi Core (`travel_trip_members` +
 * `listHouseholdMembers()`, bereits household-gescoped).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- _familyId bleibt in der Signatur für Aufrufer-Kompatibilität erhalten (s. Kommentar oben, FINALER CUTOVER), kein totes Argument.
export async function loadTripParticipantOptions(_supabase: SupabaseClient, tripId: string, _familyId: string): Promise<BookingParticipantOption[]> {
  const lumiCore = await createLumiCoreClient()
  const { data: tripMemberRows } = await lumiCore
    .from('travel_trip_members')
    .select('household_member_id')
    .eq('trip_id', tripId)

  const allMembers = await listHouseholdMembers()
  const byId = new Map(allMembers.map((m) => [m.id, m]))

  const fromMembers = (tripMemberRows ?? [])
    .map((m) => byId.get(m.household_member_id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({ id: m.id, name: m.name, initials: deriveInitials(m.name), color: m.color }))

  if (fromMembers.length > 0) return fromMembers

  return allMembers.map((m) => ({ id: m.id, name: m.name, initials: deriveInitials(m.name), color: m.color }))
}
