'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { BASE_PATH } from '@/lib/base-path'
import { redirectAfterLogin } from '@/lib/travel-return-to'

/**
 * FINALER CUTOVER: normales E-Mail/Passwort-Login läuft primär über
 * Lumi Core (nicht mehr Travel) -- Marcel und Sarah haben beide bereits
 * echte, funktionierende Lumi-Core-Konten (siehe Phase 1). Passkey bleibt
 * unverändert Travel-basiert, siehe PasskeyLoginButton.tsx +
 * app/(auth)/connect-lumi-core (eigener Zwischenschritt für diesen Fall) --
 * das ist die einzige noch erlaubte Travel-Auth-Abhängigkeit. Passwort-Reset
 * lief bisher noch gegen Travels eigene Auth (vestigial aus der Zeit vor dem
 * Login-Umzug) -- das war falsch, seit Lumi Core primär ist: ein zurück-
 * gesetztes Travel-Passwort hätte gar nicht das tatsächlich genutzte Konto
 * betroffen. Jetzt konsequent auf Lumi Core umgestellt (identische
 * Supabase-Auth-API, nur anderes Projekt).
 */

/** Muss mit der in Supabase Auth konfigurierten Mindestpasswortlänge übereinstimmen. */
const MIN_PASSWORD_LENGTH = 10

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Bitte E-Mail und Passwort eingeben.')}`)
  }

  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent('Anmeldung fehlgeschlagen: E-Mail oder Passwort falsch.')}`)
  }

  await redirectAfterLogin('/')
}

export async function logout() {
  const lumiCore = await createLumiCoreClient()
  await lumiCore.auth.signOut()
  redirect('/login')
}

/** §Auth-Callback (app/auth/confirm/route.ts) tauscht den E-Mail-Link-Token
 *  ein und leitet danach auf /reset-password -- dort existiert bereits eine
 *  (Recovery-)Session, updatePassword baut direkt darauf auf. */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const requestPath = '/login/reset'

  if (!email) {
    redirect(`${requestPath}?error=${encodeURIComponent('Bitte E-Mail-Adresse eingeben.')}`)
  }

  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const origin = headersList.get('origin') ?? (host ? `${protocol}://${host}` : '')

  // §"App-like Lumi Travel": `origin` wird aus dem eingehenden Request-Header
  // ermittelt und kennt daher hinter dem Multi-Zones-Proxy nur die
  // Lumi-Launcher-Origin, nicht das eigene basePath-Präfix -- ohne den
  // manuellen BASE_PATH-Zusatz würde der Link in der Reset-Mail ins Leere
  // laufen (Next.js hängt basePath nur bei intern generierten Pfaden an,
  // nicht bei so zusammengesetzten Strings).
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}${BASE_PATH}/auth/confirm?type=recovery&next=${encodeURIComponent(`${BASE_PATH}/reset-password`)}`,
  })

  if (error) {
    redirect(`${requestPath}?error=${encodeURIComponent('Anfrage fehlgeschlagen: ' + error.message)}`)
  }

  redirect(`${requestPath}?sent=1`)
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('password_confirm') ?? '')
  const resetPath = '/reset-password'

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(`${resetPath}?error=${encodeURIComponent(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`)}`)
  }

  if (password !== passwordConfirm) {
    redirect(`${resetPath}?error=${encodeURIComponent('Die Passwörter stimmen nicht überein.')}`)
  }

  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.auth.updateUser({ password })

  if (error) {
    redirect(`${resetPath}?error=${encodeURIComponent('Das Passwort konnte nicht geändert werden. Bitte fordere einen neuen Link an.')}`)
  }

  // §Nur die aktuelle Recovery-Session beenden (scope: 'local') -- ein
  // globales signOut() würde unnötig auch andere, bereits bestehende
  // Sitzungen desselben Nutzers auf anderen Geräten mit beenden.
  const { error: signOutError } = await lumiCore.auth.signOut({ scope: 'local' })
  if (signOutError) {
    console.error('[Auth][DIAGNOSTIC] signOut nach Passwort-Reset fehlgeschlagen', signOutError)
  }

  redirect('/login?reset=1')
}
