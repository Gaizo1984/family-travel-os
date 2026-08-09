import { cache } from 'react'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

/**
 * FINALER CUTOVER: primäre Identität kommt jetzt aus Lumi Core
 * (household_members), nicht mehr aus Travels eigener persons-Tabelle.
 * `id`/`familyId` im Rückgabewert sind jetzt household_member_id/
 * household_id -- die Feldnamen bleiben aus Kompatibilitätsgründen
 * gleich benannt (alle bestehenden Konsumenten erwarten `id`/`familyId`),
 * ihre BEDEUTUNG hat sich aber geändert (Lumi-Core-IDs statt
 * Travel-Person-IDs). `legacyTravelPersonId` steht für die verbleibenden,
 * noch nicht umgestellten Stellen zur Verfügung (siehe
 * travel_person_migration_map).
 */
export const getCurrentPerson = cache(async (): Promise<{
  id: string
  name: string
  familyId: string
  lumiCoreProfileId: string | null
  legacyTravelPersonId: string | null
} | null> => {
  const lumiCore = await createLumiCoreClient()
  const {
    data: { user },
  } = await lumiCore.auth.getUser()
  if (!user) return null

  const { data: member } = await lumiCore
    .from('household_members')
    .select('id, household_id, name')
    .eq('profile_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!member) return null

  const { data: mapping } = await lumiCore
    .from('travel_person_migration_map')
    .select('travel_person_id')
    .eq('household_member_id', member.id)
    .maybeSingle()

  return {
    id: member.id,
    name: member.name,
    familyId: member.household_id,
    lumiCoreProfileId: user.id,
    legacyTravelPersonId: mapping?.travel_person_id ?? null,
  }
})
