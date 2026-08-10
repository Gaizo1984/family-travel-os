import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'

export const LUMI_CORE_DOCUMENTS_BUCKET = 'travel-documents'
export const LUMI_CORE_PROFILE_PHOTOS_BUCKET = 'profile-photos'

/**
 * FINALER CUTOVER: Lumi Core ist jetzt der primäre Login, `getFamily()`
 * liefert die household_id bereits direkt aus der aktuellen Session --
 * die frühere Phase-3A-Bridge-Spalte (`families.lumi_core_household_id`,
 * ein Travel-DB-Read) wird dafür nicht mehr gebraucht. `getFamily()` ist
 * selbst schon request-scoped gecacht (React `cache()`).
 */
export async function getLumiCoreHouseholdId(): Promise<string | null> {
  const { id } = await getFamily()
  return id || null
}

/**
 * `travel-documents`-Konvention (siehe 04_storage_migration.js /
 * 05_storage_db_reference_update.js): einfacher household_id-Präfix,
 * Rest des Original-Pfads unverändert.
 */
export async function toTravelDocumentsPath(originalPath: string): Promise<string | null> {
  const householdId = await getLumiCoreHouseholdId()
  if (!householdId) return null
  return `${householdId}/${originalPath}`
}

/**
 * `profile-photos`-Konvention (siehe phase3c_avatar_scripts): NICHT der
 * Travel-person_id-Ordner, sondern household_member_id -- muss über
 * `travel_person_migration_map` aufgelöst werden (Lumi-Core-Read,
 * benötigt aktive lc-*-Session, siehe README).
 */
export async function resolveHouseholdMemberId(travelPersonId: string): Promise<string | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore
    .from('travel_person_migration_map')
    .select('household_member_id')
    .eq('travel_person_id', travelPersonId)
    .maybeSingle()
  if (error || !data) return null
  return data.household_member_id
}

export async function toProfilePhotoPath(householdMemberId: string, filename: string): Promise<string | null> {
  const householdId = await getLumiCoreHouseholdId()
  if (!householdId) return null
  return `${householdId}/${householdMemberId}/${filename}`
}
