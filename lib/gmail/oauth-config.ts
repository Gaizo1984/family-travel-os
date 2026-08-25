import 'server-only'

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss (Nutzervorgabe, wörtlich):
 * "Scope bevorzugt https://www.googleapis.com/auth/gmail.modify" -- bewusst
 * NUR dieser eine Scope, kein zusätzliches openid/email (anders als beim
 * Google-Calendar-Connect-Flow in Lumi Assistance, dessen Vorbild dieser
 * Flow sonst folgt) -- die verbundene E-Mail-Adresse wird stattdessen direkt
 * über die Gmail API selbst ermittelt (users.getProfile, bereits im
 * gmail.modify-Scope enthalten), kein zusätzlicher Scope dafür nötig.
 */
export const GMAIL_OAUTH_SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
export const GMAIL_OAUTH_CALLBACK_PATH = '/travel/api/auth/gmail/callback'

/**
 * Fest verdrahtet statt aus dem Request-Host abgeleitet -- exakt dasselbe
 * Vorgehen wie lib/calendar/google/config.ts::getGoogleOAuthRedirectUri in
 * Lumi Assistance: läuft potenziell hinter dem Multi-Zones-Rewrite-Proxy
 * von Lumi Launcher, der beim Request sichtbare Host wäre kein
 * vertrauenswürdiger Wert für eine sicherheitsrelevante Redirect-URI. Nutzt
 * bewusst die DIREKTE Vercel-Domain, nicht den Launcher-Host -- dieselbe,
 * bereits für den Pub/Sub-Webhook gewählte Domain (siehe
 * app/api/gmail/webhook), da diese ohne das separate Login-Gate des
 * Launchers erreichbar ist.
 */
export function getGmailOAuthRedirectUri(): string {
  const origin = process.env.VERCEL ? 'https://family-travel-os-xi.vercel.app' : 'http://localhost:3001'
  return `${origin}${GMAIL_OAUTH_CALLBACK_PATH}`
}

/** Dieselben Zugangsdaten wie der bereits bestehende, env-var-basierte Zugriff (lib/gmail/gmail-client.ts) -- keine neuen Secrets. */
export function getGmailOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET sind nicht gesetzt.')
  }
  return { clientId, clientSecret }
}
