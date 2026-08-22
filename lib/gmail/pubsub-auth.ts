import 'server-only'
import { OAuth2Client, type TokenPayload } from 'google-auth-library'

/**
 * §Reise-Postfach, Implementierungsschritt "Webhook-Grundgerüst"
 * (Nutzervorgabe, wörtlich): "Pub/Sub-OIDC-JWT serverseitig validieren:
 * Signatur, Audience und erwartete Service-Account-Identität."
 *
 * Nutzt Googles eigene google-auth-library statt einer selbst gebauten
 * JWKS-/RS256-Prüfung -- das ist der von Google selbst dokumentierte Weg,
 * von Google signierte ID-Tokens (inkl. Pub/Sub-Push-OIDC-Tokens) zu
 * verifizieren. `verifyIdToken` prüft dabei bereits automatisch:
 * Signatur (gegen Googles öffentliche, laufend rotierende Zertifikate,
 * intern von der Bibliothek geladen/gecacht), Aussteller (accounts.google.com)
 * und Ablauf. Was die Bibliothek NICHT prüft: WESSEN Token es ist -- das
 * `email`-Claim wird deshalb zusätzlich explizit gegen die erwartete,
 * dedizierte Service-Account-Adresse abgeglichen (§"erwartete
 * Service-Account-Identität").
 *
 * `audience` wird an verifyIdToken durchgereicht und muss exakt der beim
 * Erstellen der Push-Subscription hinterlegten Audience entsprechen
 * (empfohlen: die Webhook-URL selbst, s. GMAIL_PUBSUB_OIDC_AUDIENCE) --
 * ein gültig signiertes Google-Token für eine ANDERE Audience wird von
 * verifyIdToken selbst bereits abgelehnt.
 */
const oauthClient = new OAuth2Client()

export type PubSubAuthFailureReason =
  | 'missing_bearer'
  | 'empty_token'
  | 'not_configured'
  | 'signature_or_audience_invalid'
  | 'empty_payload'
  | 'unexpected_identity'

export type PubSubAuthResult = { ok: true } | { ok: false; reason: PubSubAuthFailureReason }

/**
 * §Vorgabe ("keine ... vollständigen KI-Responses oder Anhänge in Logs
 * schreiben", sinngemäß auf alles Sicherheitskritische übertragen): nimmt
 * den Header-Wert entgegen, gibt aber nie das Token selbst oder Teile davon
 * zurück -- nur ein grober, loggbarer Fehlgrund.
 */
export async function verifyPubSubPushRequest(authorizationHeader: string | null): Promise<PubSubAuthResult> {
  if (!authorizationHeader?.startsWith('Bearer ')) return { ok: false, reason: 'missing_bearer' }

  const idToken = authorizationHeader.slice('Bearer '.length).trim()
  if (!idToken) return { ok: false, reason: 'empty_token' }

  const audience = process.env.GMAIL_PUBSUB_OIDC_AUDIENCE
  const expectedServiceAccount = process.env.GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL
  if (!audience || !expectedServiceAccount) return { ok: false, reason: 'not_configured' }

  let payload: TokenPayload | undefined
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience })
    payload = ticket.getPayload()
  } catch {
    return { ok: false, reason: 'signature_or_audience_invalid' }
  }

  if (!payload) return { ok: false, reason: 'empty_payload' }
  // §"erwartete Service-Account-Identität": email_verified ist bei
  // Google-Service-Account-Tokens immer gesetzt -- defensiv trotzdem geprüft,
  // statt sich blind auf einen einzelnen Claim zu verlassen.
  if (payload.email !== expectedServiceAccount || payload.email_verified !== true)
    return { ok: false, reason: 'unexpected_identity' }

  return { ok: true }
}
