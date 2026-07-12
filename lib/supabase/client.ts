import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Security Foundation 1B: Opt-in für Supabase Auths experimentelle
    // Passkey/WebAuthn-API (registerPasskey/signInWithPasskey/passkey.*).
    { auth: { experimental: { passkey: true } } }
  )
}
