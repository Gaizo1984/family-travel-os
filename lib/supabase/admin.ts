import 'server-only'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { getSupabaseServiceRoleKey } from '@/lib/server-env'
import type { Database } from './types'

/**
 * §"SUPABASE_SERVICE_ROLE_KEY niemals in Client-Bundles, Logs oder
 * öffentlichen Responses" (Nutzervorgabe, wörtlich): einziger Ort im
 * Projekt, der diesen Schlüssel liest (über `lib/server-env.ts`, das ihn
 * wiederum nie in eine Fehlermeldung schreibt). `import 'server-only'`
 * lässt den Next.js-Build hart fehlschlagen, falls dieses Modul je (auch
 * nur transitiv) in ein Client-Bundle gerät.
 *
 * Umgeht RLS vollständig (Service Role) -- ausschließlich für
 * serverseitige Hintergrund-/Systemvorgänge OHNE Nutzer-Session (z. B. den
 * künftigen Render-Abschluss-Schritt, der von einer Remotion-Lambda-
 * Rückmeldung statt einem eingeloggten Request ausgelöst wird). NIE für
 * normale, nutzerausgelöste Datenzugriffe -- dafür weiterhin
 * `lib/supabase/server.ts`, das RLS über die echte Nutzer-Session
 * durchsetzt. Kein Cookie-Handling nötig (anders als `server.ts`), da der
 * Service-Role-Key selbst die Authentifizierung ist, keine Nutzer-Session.
 *
 * §Noch ungenutzt in dieser Etappe: wird erst mit dem tatsächlichen
 * Render-Trigger (spätere Etappe) aufgerufen -- hier nur vorbereitet, wie
 * von der Nutzervorgabe für Etappe 1 verlangt ("Konfigurationsdateien
 * vorbereiten"), noch nichts produktiv angebunden.
 */
export function createAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey()

  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
