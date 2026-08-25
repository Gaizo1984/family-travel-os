import 'server-only'
import { gmail as buildGmailApi, auth } from '@googleapis/gmail'
import { GMAIL_OAUTH_SCOPES, getGmailOAuthCredentials, getGmailOAuthRedirectUri } from './oauth-config'

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss -- exakt nach dem Muster von
 * lib/calendar/google/client.ts in Lumi Assistance (buildGoogleOAuthClient/
 * buildGoogleAuthUrl/exchangeCodeForRefreshToken).
 *
 * §Bugfix (vor Auslieferung gefunden): bewusst `auth.OAuth2` aus
 * `@googleapis/gmail` statt `OAuth2Client` direkt aus dem separaten
 * `google-auth-library`-Paket (das lib/gmail/gmail-client.ts/pubsub-auth.ts
 * nutzen) -- `@googleapis/gmail` bringt über `googleapis-common` eine eigene,
 * verschachtelte Kopie von `google-auth-library` mit. Beide `OAuth2Client`-
 * Klassen heißen zwar gleich, sind für TypeScript aber unterschiedliche,
 * inkompatible Typen (`tsc --noEmit` schlug fehl: "Types have separate
 * declarations of a private property 'redirectUri'") -- der hier per
 * `gmail({version:'v1', auth: client})` erzeugte Gmail-Client erwartet exakt
 * die Variante aus `@googleapis/gmail` selbst.
 */

export function buildGmailOAuthClient() {
  const { clientId, clientSecret } = getGmailOAuthCredentials()
  return new auth.OAuth2(clientId, clientSecret, getGmailOAuthRedirectUri())
}

export function buildGmailAuthUrl(state: string): string {
  const client = buildGmailOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline', // nötig, um überhaupt ein Refresh Token zu erhalten
    prompt: 'consent', // erzwingt erneute Zustimmung -- sonst liefert Google bei bereits erteiltem Zugriff kein neues Refresh Token
    scope: GMAIL_OAUTH_SCOPES,
    state,
  })
}

/**
 * Tauscht den Autorisierungscode gegen ein Refresh Token und ermittelt die
 * verbundene Adresse direkt über die Gmail API selbst (users.getProfile,
 * bereits im gmail.modify-Scope enthalten) -- kein zusätzlicher openid/
 * email-Scope nötig (anders als beim Calendar-Connect-Flow, dessen Vorbild
 * dieser Code sonst folgt).
 */
export async function exchangeCodeForGmailRefreshToken(code: string): Promise<{ refreshToken: string; email: string }> {
  const client = buildGmailOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      "Google hat kein Refresh Token geliefert -- meist weil der Zugriff bereits einmal ohne 'prompt=consent' erteilt wurde. Zugriff in https://myaccount.google.com/permissions widerrufen und erneut verbinden.",
    )
  }
  client.setCredentials(tokens)

  const gmail = buildGmailApi({ version: 'v1', auth: client })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const email = profile.data.emailAddress
  if (!email) throw new Error('Gmail-Profil enthielt keine E-Mail-Adresse.')

  return { refreshToken: tokens.refresh_token, email }
}
