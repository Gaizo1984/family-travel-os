import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentPerson } from '@/lib/current-person'
import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'
import { exchangeCodeForGmailRefreshToken } from '@/lib/gmail/oauth-client'

const REISE_POSTFACH_PATH = '/mehr/reise-postfach'

function redirectWithError(request: Request, message: string) {
  const url = new URL(REISE_POSTFACH_PATH, request.url)
  url.searchParams.set('gmail_error', message)
  return NextResponse.redirect(url)
}

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss -- tauscht den Code gegen ein
 * Refresh Token und legt die Verbindung an. Exakt nach dem Muster von
 * app/api/auth/google-calendar/callback/route.ts in Lumi Assistance:
 * Household kommt bewusst NICHT aus dem `state`-Parameter, sondern aus
 * einer frisch geladenen Session (state dient nur der CSRF-Prüfung, siehe
 * start/route.ts) -- verhindert, dass ein manipulierter state-Wert die
 * Verbindung einem falschen Haushalt zuordnen könnte.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) return redirectWithError(request, `Google hat den Zugriff verweigert (${oauthError}).`)

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gmail_oauth_state')?.value
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError(request, 'Sicherheitsprüfung fehlgeschlagen (state), bitte erneut versuchen.')
  }
  if (!code) return redirectWithError(request, 'Kein Autorisierungscode von Google erhalten.')

  const person = await getCurrentPerson()
  if (!person) return redirectWithError(request, 'Nicht eingeloggt.')

  let refreshToken: string
  let email: string
  try {
    ;({ refreshToken, email } = await exchangeCodeForGmailRefreshToken(code))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unbekannter Fehler'
    console.error('[gmail-oauth/callback] Token-Tausch fehlgeschlagen:', message)
    return redirectWithError(request, message)
  }

  const lumiCore = createLumiCoreServiceClient()
  const { error: connectionError } = await lumiCore.from('travel_gmail_connections').upsert(
    {
      household_id: person.familyId,
      gmail_account_email: email,
      refresh_token: refreshToken,
      connected_by: person.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'household_id' },
  )
  if (connectionError) {
    console.error('[gmail-oauth/callback] Verbindung konnte nicht gespeichert werden:', connectionError.message)
    return redirectWithError(request, 'Verbindung konnte nicht gespeichert werden.')
  }

  const response = NextResponse.redirect(new URL(`${REISE_POSTFACH_PATH}?gmail_connected=1`, request.url))
  response.cookies.delete('gmail_oauth_state')
  return response
}
