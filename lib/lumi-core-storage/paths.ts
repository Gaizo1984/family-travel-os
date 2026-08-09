import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

export const LUMI_CORE_DOCUMENTS_BUCKET = 'travel-documents'
export const LUMI_CORE_PROFILE_PHOTOS_BUCKET = 'profile-photos'

/**
 * Liest die household_id ausschließlich über die bereits bestehende,
 * additive Bridge-Spalte `families.lumi_core_household_id` (Phase 3A) --
 * reiner Read auf Travels eigener, unveränderter `families`-Tabelle.
 * Request-scoped gecacht wie `lib/family.ts`/`lib/current-person.ts`.
 */
export const getLumiCoreHouseholdId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('families').select('lumi_core_household_id').maybeSingle()
  if (error || !data?.lumi_core_household_id) return null
  return data.lumi_core_household_id
})

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

export async function toProfilePhotoPath(travelPersonId: string, filename: string): Promise<string | null> {
  const householdId = await getLumiCoreHouseholdId()
  if (!householdId) return null
  const householdMemberId = await resolveHouseholdMemberId(travelPersonId)
  if (!householdMemberId) return null
  return `${householdId}/${householdMemberId}/${filename}`
}
