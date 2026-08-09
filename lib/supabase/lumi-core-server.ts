import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { LumiCoreDatabase } from './lumi-core-types'

// Zweiter, komplett unabhängiger Supabase-Client für Phase 3A -- zeigt auf
// Lumi Core, NICHT auf Travels eigenes Projekt (siehe lib/supabase/server.ts).
// Eigene Env-Vars (NEXT_PUBLIC_LUMI_CORE_*), keine Service Role.
//
// Session-Trennung ist explizit erzwungen, nicht dem Zufall überlassen:
// @supabase/ssr würde die Session-Cookies zwar ohnehin unter einem aus der
// Projekt-Referenz der URL abgeleiteten Namen ablegen (der sich technisch
// bereits von Travels eigenem Cookie-Namen unterscheidet) -- hier wird
// zusätzlich ein eigener "lc-"-Präfix über einen eigenen Cookie-Adapter
// erzwungen, damit die beiden Sessions unter GARANTIERT unterschiedlichen
// Keys liegen, unabhängig von der internen Namensableitung von @supabase/ssr.
const COOKIE_PREFIX = 'lc-'

export async function createLumiCoreClient() {
  const cookieStore = await cookies()

  return createServerClient<LumiCoreDatabase>(
    process.env.NEXT_PUBLIC_LUMI_CORE_URL!,
    process.env.NEXT_PUBLIC_LUMI_CORE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore
            .getAll()
            .filter((cookie) => cookie.name.startsWith(COOKIE_PREFIX))
            .map((cookie) => ({ name: cookie.name.slice(COOKIE_PREFIX.length), value: cookie.value }))
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(`${COOKIE_PREFIX}${name}`, value, options)
            )
          } catch {
            // Server Component — cookies können hier nicht gesetzt werden
          }
        },
      },
    }
  )
}
