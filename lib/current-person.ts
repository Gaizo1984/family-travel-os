import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Phase 3A: bisher gab es im gesamten Code keine Stelle, die "welche Person
 * ist gerade eingeloggt" auflöst (siehe persons.auth_user_id) -- proxy.ts
 * prüft nur, OB überhaupt eine Session existiert. Für die Lumi-Core-Brücke
 * wird das erstmals gebraucht (welche persons-Zeile bekommt
 * lumi_core_profile_id). Request-scoped via React cache(), wie lib/family.ts.
 */
export const getCurrentPerson = cache(async (): Promise<{
  id: string
  name: string
  familyId: string
  lumiCoreProfileId: string | null
} | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('persons')
    .select('id, name, family_id, lumi_core_profile_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, name: data.name, familyId: data.family_id, lumiCoreProfileId: data.lumi_core_profile_id }
})
