import { cache } from 'react'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

export type TravelModuleAccess = 'available' | 'unavailable' | 'unknown'

/**
 * Rein informative Prüfung (Master-Prompt §9) -- ersetzt niemals Travels
 * eigene Absicherung (proxy.ts/RLS bleiben die einzige echte Zugriffsgrenze).
 * Lenient wie im Lumi Launcher: fehlt eine aktive Lumi-Core-Sitzung im
 * Browser (z.B. abgelaufenes Token, andere Browser-Session -- siehe
 * bekannte Einschränkung ohne eigene Middleware) oder fehlt ein expliziter
 * Eintrag, wird NIE blockiert. Nur ein explizites access_level='none' für
 * Modul 'travel' führt zu 'unavailable', und selbst das sperrt hier nichts,
 * sondern wird nur angezeigt.
 *
 * §Performance-Audit: `knownHouseholdMemberId` ist optional -- der einzige
 * bestehende Aufrufer (components/LumiCoreConnectionCard.tsx) kennt die ID
 * bereits aus getCurrentPerson() (bereits cache()-dedupliziert) und kann sie
 * direkt durchreichen, statt hier nochmal komplett eigenständig
 * auth.getUser() + eine überlappende household_members-Abfrage
 * auszuführen. Ohne Parameter bleibt das bisherige eigenständige Verhalten
 * für künftige Aufrufer ohne bekannte Identität vollständig erhalten.
 */
export const getTravelModuleAccess = cache(async (knownHouseholdMemberId?: string): Promise<TravelModuleAccess> => {
  const lumiCore = await createLumiCoreClient()

  let memberIds: string[]
  if (knownHouseholdMemberId) {
    memberIds = [knownHouseholdMemberId]
  } else {
    const {
      data: { user },
    } = await lumiCore.auth.getUser()
    if (!user) return 'unknown'

    const { data: members } = await lumiCore
      .from('household_members')
      .select('id')
      .eq('profile_id', user.id)
      .is('deleted_at', null)

    memberIds = (members ?? []).map((m) => m.id)
    if (memberIds.length === 0) return 'available'
  }

  const { data: access } = await lumiCore
    .from('household_member_app_access')
    .select('module')
    .in('household_member_id', memberIds)
    .eq('module', 'travel')
    .eq('access_level', 'none')

  return (access ?? []).length > 0 ? 'unavailable' : 'available'
})
