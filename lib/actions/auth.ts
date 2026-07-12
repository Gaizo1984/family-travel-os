'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Security Foundation 1A: Login/Logout/Passwort-Reset über Supabase Auth.
 * Bewusst minimal (nur die vom Auftrag geforderten vier Aktionen) -- keine
 * Rollen-/Berechtigungslogik, keine Profil-/Familien-Zuordnung hier (das
 * bleibt in persons.auth_user_id, nicht in diesen Actions).
 */

/** Muss mit der in Supabase Auth konfigurierten Mindestpasswortlänge übereinstimmen. */
const MIN_PASSWORD_LENGTH = 10

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Bitte E-Mail und Passwort eingeben.')}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent('Anmeldung fehlgeschlagen: E-Mail oder Passwort falsch.')}`)
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
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

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?type=recovery&next=/reset-password`,
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

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(`${resetPath}?error=${encodeURIComponent('Das Passwort konnte nicht geändert werden. Bitte fordere einen neuen Link an.')}`)
  }

  // §Nur die aktuelle Recovery-Session beenden (scope: 'local') -- ein
  // globales signOut() würde unnötig auch andere, bereits bestehende
  // Sitzungen desselben Nutzers auf anderen Geräten mit beenden.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
  if (signOutError) {
    console.error('[Auth][DIAGNOSTIC] signOut nach Passwort-Reset fehlgeschlagen', signOutError)
  }

  redirect('/login?reset=1')
}
