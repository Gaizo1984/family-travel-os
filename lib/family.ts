import { cache } from 'react'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getCurrentPerson } from '@/lib/current-person'

/**
 * FINALER CUTOVER: `id` ist jetzt die Lumi-Core household_id (nicht mehr
 * Travels families.id). Request-scoped via React cache(), wie zuvor.
 * Ermittelt den Household ausschließlich über die aktuell eingeloggte
 * Person (getCurrentPerson(), jetzt Lumi-Core-authentifiziert) statt über
 * ein blindes `.limit(1)` auf Travels einziger families-Zeile.
 */
export const getFamily = cache(async (): Promise<{ id: string; name: string | null }> => {
  const person = await getCurrentPerson()
  if (!person) return { id: '', name: null }

  const lumiCore = await createLumiCoreClient()
  const { data } = await lumiCore.from('households').select('id, name').eq('id', person.familyId).maybeSingle()
  return { id: data?.id ?? person.familyId, name: data?.name ?? null }
})
