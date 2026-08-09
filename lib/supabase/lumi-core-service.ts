import 'server-only'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import type { LumiCoreDatabase } from './lumi-core-types'

/**
 * Service-Role-Gegenstück zu `lib/supabase/lumi-core-server.ts`, exakt nach
 * dem Muster von `lib/supabase/admin.ts` (Travels eigener Service-Role-
 * Client). Ausschließlich für sitzungslose Server-/Cron-Kontexte (Vercel
 * Cron, keine `lc-*`-Cookies vorhanden) -- der cookie-basierte
 * `createLumiCoreClient()` liefert dort mangels Session durch RLS nur leere
 * Ergebnisse, nie einen Fehler, was Cron-Jobs bisher lautlos wirkungslos
 * gemacht hat (siehe Kommentare in lib/hint-generation.ts u.a. vor diesem
 * Client).
 *
 * `import 'server-only'` lässt den Next.js-Build hart fehlschlagen, falls
 * dieses Modul je (auch nur transitiv) in ein Client-Bundle gerät --
 * `LUMI_CORE_SERVICE_ROLE_KEY` ist NICHT NEXT_PUBLIC-präfigiert und wird
 * nirgends sonst gelesen. Umgeht RLS vollständig -- niemals für normale,
 * nutzerausgelöste Zugriffe verwenden, dafür bleibt `createLumiCoreClient()`
 * (cookie-/session-basiert) die einzig zulässige Quelle.
 */
export function createLumiCoreServiceClient() {
  const serviceRoleKey = process.env.LUMI_CORE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('LUMI_CORE_SERVICE_ROLE_KEY ist nicht gesetzt -- Cron/Service-Zugriff auf Lumi Core bleibt gesperrt.')
  }

  return createSupabaseJsClient<LumiCoreDatabase>(
    process.env.NEXT_PUBLIC_LUMI_CORE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
