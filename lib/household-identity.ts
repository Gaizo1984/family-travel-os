import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getCurrentPerson } from '@/lib/current-person'

export type HouseholdMemberProfile = {
  householdMemberId: string
  householdId: string
  name: string
  role: 'adult' | 'child' | 'assistant'
  avatarEmoji: string | null
  avatarStoragePath: string | null
}

/**
 * Identity-Vorbereitung (Phase 1, Cutover): Travels eigener Login/
 * getCurrentPerson() bleibt bis auf Weiteres die primäre, aktive
 * Identitätsquelle (siehe proxy.ts/lib/actions/auth.ts -- unverändert).
 * Diese Funktion legt NUR die künftige household_members-Sicht auf
 * dieselbe Person darüber, für Aufrufer, die sich schrittweise auf die
 * neue Struktur vorbereiten wollen, ohne dass sich am aktiven Login
 * heute etwas ändert.
 *
 * Bewusst lenient (gleiches Muster wie getTravelModuleAccess() in
 * lib/lumi-core-identity.ts): liefert null, wenn keine aktive
 * Lumi-Core-Sitzung im Browser vorliegt (z.B. noch nie verbunden,
 * Sitzung abgelaufen) oder keine Verknüpfung existiert -- blockiert nie,
 * ersetzt getCurrentPerson() nicht.
 */
export async function getHouseholdMemberProfile(): Promise<HouseholdMemberProfile | null> {
  const person = await getCurrentPerson()
  if (!person) return null

  const lumiCore = await createLumiCoreClient()
  const {
    data: { user },
  } = await lumiCore.auth.getUser()
  if (!user) return null

  const { data: mapping } = await lumiCore
    .from('travel_person_migration_map')
    .select('household_member_id')
    .eq('travel_person_id', person.id)
    .maybeSingle()
  if (!mapping) return null

  const { data: member } = await lumiCore
    .from('household_members')
    .select('id, household_id, name, role, avatar_emoji, avatar_storage_path')
    .eq('id', mapping.household_member_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!member) return null

  return {
    householdMemberId: member.id,
    householdId: member.household_id,
    name: member.name,
    role: member.role,
    avatarEmoji: member.avatar_emoji,
    avatarStoragePath: member.avatar_storage_path,
  }
}
