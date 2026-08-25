import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getCurrentPerson } from '@/lib/current-person'
import { buildGmailAuthUrl } from '@/lib/gmail/oauth-client'

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss -- startet den User-Consent-Flow
 * für das dedizierte Gmail-Postfach. Exakt nach dem Muster von
 * app/api/auth/google-calendar/start/route.ts in Lumi Assistance:
 * State-Token als CSRF-Schutz in einem httpOnly-Cookie gespiegelt -- der
 * Callback vertraut NICHT dem state-Wert selbst für die Haushaltszuordnung
 * (state dient ausschließlich der CSRF-Prüfung), sondern lädt die aktuelle
 * Session neu.
 */
export async function GET() {
  const person = await getCurrentPerson()
  if (!person) return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })

  const state = randomBytes(24).toString('hex')
  const authUrl = buildGmailAuthUrl(state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 Minuten reichen für den Consent-Flow
    path: '/',
  })
  return response
}
