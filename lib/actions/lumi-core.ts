'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { PASSKEY_PENDING_LC_COOKIE } from '@/lib/passkey-lumi-core-gate'
import { redirectAfterLogin } from '@/lib/travel-return-to'

/**
 * FINALER CUTOVER: `connectLumiCore` (Phase 3A, "kontrollierter Re-Login"
 * für einen Travel-authentifizierten Nutzer, der die Travel-persons/
 * -families-Bridge-Spalten schrieb) wurde entfernt -- seit dem primären
 * Login-Umzug auf Lumi Core ist `getCurrentPerson()` selbst bereits
 * Lumi-Core-authentifiziert, ein solcher "Verbinden"-Schritt ist für jede
 * normal eingeloggte Person unerreichbar (isConnected in
 * LumiCoreConnectionCard.tsx ist dann immer true) und hätte nur noch in
 * Travels eigene persons/families-Tabellen geschrieben -- die letzte
 * verbliebene Travel-Datenbank-Schreibstelle außerhalb des expliziten
 * Passkey-Kompatibilitätsflows. Dieser bleibt unverändert:
 * `establishLumiCoreSession` unten ist die einzige noch verbleibende
 * Travel-Auth-Abhängigkeit (Travel-eigenes WebAuthn/Passkey, siehe
 * lib/passkey-lumi-core-gate.ts) und schreibt NICHTS in Travels Datenbank.
 */

/** Beendet ausschließlich die Lumi-Core-Session (lc-* Cookies) -- Travels
 *  eigene Session bleibt davon komplett unberührt. Löst NICHT die
 *  gespeicherte Verknüpfung (lumi_core_profile_id) auf. */
export async function disconnectLumiCoreSession() {
  const lumiCore = await createLumiCoreClient()
  await lumiCore.auth.signOut()
  revalidatePath('/family')
  redirect('/family')
}

/**
 * Passkey-Gate (siehe app/(auth)/connect-lumi-core/page.tsx, proxy.ts):
 * echte, vom Nutzer selbst eingegebene Lumi-Core-Anmeldung -- KEINE
 * automatische Übernahme von Travel-Zugangsdaten, KEIN Service-Role, KEINE
 * stille Hintergrund-Session. Bei Erfolg wird ausschließlich der
 * Passkey-Pending-Marker gelöscht -- keine anderen Cookies/Tabellen
 * angefasst.
 */
export async function establishLumiCoreSession(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = String(formData.get('redirectTo') ?? '/')
  const target = redirectTo.startsWith('/') ? redirectTo : '/'
  const gatePath = `/connect-lumi-core?redirectTo=${encodeURIComponent(target)}`

  if (!email || !password) {
    redirect(`${gatePath}&error=${encodeURIComponent('Bitte E-Mail und Passwort eingeben.')}`)
  }

  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.auth.signInWithPassword({ email, password })
  if (error) {
    redirect(`${gatePath}&error=${encodeURIComponent('Lumi-Core-Anmeldung fehlgeschlagen: E-Mail oder Passwort falsch.')}`)
  }

  const cookieStore = await cookies()
  cookieStore.delete(PASSKEY_PENDING_LC_COOKIE)

  await redirectAfterLogin(target)
}
