import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { LumiCoreDatabase } from './lumi-core-types'

// §Zentraler Lumi-Login (Masterprompt §6): Client für Lumi Core, komplett
// unabhängig von Travels eigenem Supabase-Projekt (siehe lib/supabase/server.ts).
//
// §Bugfix/Vereinheitlichung: bis hierhin erzwang dieser Client über einen
// eigenen Cookie-Adapter ein "lc-"-Präfix, um während der Cutover-
// Übergangszeit zwei GLEICHZEITIGE Sessions (Travels eigene + Lumi Core)
// unter garantiert unterschiedlichen Keys zu halten. Lumi Launcher und Lumi
// Assistance haben für ihre jeweilige Lumi-Core-Session nie ein Präfix
// gebraucht (@supabase/ssr leitet den Cookie-Namen ohnehin schon aus der
// Projekt-Referenz der URL ab -- Travels eigenes Projekt hat eine andere
// Referenz als Lumi Core, es gab also nie ein echtes Kollisionsrisiko).
// Jetzt, wo der zentrale Login alle drei Apps auf dieselbe Session bringen
// soll (§6 "gemeinsame Lumi-Core-Session"), muss auch Travel denselben
// Standard-Namespace verwenden wie Launcher/Assistance, sonst funktioniert
// SSO über die gemeinsame Browser-Origin nicht (unterschiedliche
// Cookie-Namen für dieselbe Session). Reiner Pass-through-Adapter, exakt
// dasselbe Muster wie lib/supabase/server.ts und lumi-assistance/lib/
// supabase/server.ts.
export async function createLumiCoreClient() {
  const cookieStore = await cookies()

  return createServerClient<LumiCoreDatabase>(
    process.env.NEXT_PUBLIC_LUMI_CORE_URL!,
    process.env.NEXT_PUBLIC_LUMI_CORE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies können hier nicht gesetzt werden
          }
        },
      },
    }
  )
}
