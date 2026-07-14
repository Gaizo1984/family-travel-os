import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * §Nur für serverseitige, sitzungslose Hintergrundaufgaben (Cron-Cleanup):
 * der Service-Role-Key umgeht RLS vollständig -- niemals im Client
 * verwenden, niemals an den Browser senden, nur in serverseitigen
 * Route-Handlern/Funktionen importieren. Ein Vercel-Cron-Aufruf hat keine
 * Nutzer-Session/Cookies (`auth.uid()` wäre NULL) -- der normale
 * cookie-basierte Client (lib/supabase/server.ts) würde durch die
 * bestehende `authenticated_only`-RLS-Policy jede Abfrage still auf 0
 * Zeilen filtern (kein Fehler, nur ein wirkungsloser Cleanup-Lauf).
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
