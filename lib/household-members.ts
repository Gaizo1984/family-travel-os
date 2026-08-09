import { cache } from 'react'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'

export type HouseholdMemberSummary = {
  id: string
  name: string
  role: 'adult' | 'child' | 'assistant'
  isMinor: boolean
  color: string
  avatarEmoji: string | null
  avatarStoragePath: string | null
  birthDate: string | null
}

/**
 * FINALER CUTOVER: Ersatz für die bisherigen `.from('persons').select(...)`-
 * Aufrufe an allen Stellen, die eine Mitgliederliste für Auswahl/Anzeige
 * brauchen (Reiseanlage, Reisende-Auswahl, Packlisten-Zuordnung, etc.).
 * Request-scoped gecacht wie getFamily()/getCurrentPerson().
 */
export const listHouseholdMembers = cache(async (): Promise<HouseholdMemberSummary[]> => {
  const { id: householdId } = await getFamily()
  if (!householdId) return []

  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore
    .from('household_members')
    .select('id, name, role, is_minor, color, avatar_emoji, avatar_storage_path, birth_date')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(`listHouseholdMembers: ${error.message}`)

  return data.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    isMinor: m.is_minor,
    color: m.color,
    avatarEmoji: m.avatar_emoji,
    avatarStoragePath: m.avatar_storage_path,
    birthDate: m.birth_date,
  }))
})

/**
 * Rückrichtung zu lib/lumi-core-storage/paths.ts::resolveHouseholdMemberId --
 * gebraucht überall dort, wo aus bereits Lumi-Core-gelieferten Daten heraus
 * ein Link in die (bewusst noch auf Travel verbliebenen, siehe
 * lib/actions/persons.ts-Kommentar zur Schema-Lücke) `/family/[personId]/...`-
 * Seiten gebaut wird -- diese Seiten erwarten weiterhin Travels
 * legacy person_id, nicht household_member_id.
 */
export async function resolveLegacyTravelPersonId(householdMemberId: string): Promise<string | null> {
  const lumiCore = await createLumiCoreClient()
  const { data } = await lumiCore
    .from('travel_person_migration_map')
    .select('travel_person_id')
    .eq('household_member_id', householdMemberId)
    .maybeSingle()
  return data?.travel_person_id ?? null
}

export async function getHouseholdMemberById(householdMemberId: string): Promise<HouseholdMemberSummary | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore
    .from('household_members')
    .select('id, name, role, is_minor, color, avatar_emoji, avatar_storage_path, birth_date')
    .eq('id', householdMemberId)
    .maybeSingle()
  if (error) throw new Error(`getHouseholdMemberById: ${error.message}`)
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    role: data.role,
    isMinor: data.is_minor,
    color: data.color,
    avatarEmoji: data.avatar_emoji,
    avatarStoragePath: data.avatar_storage_path,
    birthDate: data.birth_date,
  }
}
