import 'server-only'
import { gmail, auth } from '@googleapis/gmail'
import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'

/**
 * §Reise-Postfach, Implementierungsschritt "Server-seitiger Gmail-Client"
 * (Nutzervorgabe, wörtlich): Client-Konstruktion auf Basis der drei
 * serverseitigen Secrets GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/
 * GMAIL_REFRESH_TOKEN -- ausschließlich aus process.env gelesen, nie
 * hartkodiert, nie an Client-Code durchgereicht ('server-only' erzwingt das
 * bereits beim Build, s. lib/actions/booking-extraction.ts für dasselbe
 * Prinzip bei OPENAI_API_KEY).
 *
 * §Bugfix (vor Auslieferung gefunden): bewusst `@googleapis/gmail` (nur der
 * Gmail-Teil) statt des vollen `googleapis`-Pakets -- letzteres bündelt die
 * TypeScript-Typen für praktisch alle Google-APIs in einem Paket und ließ
 * `tsc --noEmit` in diesem bereits großen Projekt mit "JavaScript heap out
 * of memory" abbrechen. Gleiche Laufzeit-API (`googleapis-common`
 * darunter), nur ohne den unnötigen Typ-Ballast.
 *
 * §OAuth-Verbindungsfluss (Nutzervorgabe, wörtlich): "serverseitige sichere
 * Speicherung der Tokens, familienbezogen" -- der Refresh Token kommt jetzt
 * bevorzugt aus travel_gmail_connections (per In-App-"Gmail verbinden"-Flow
 * gespeichert, s. lib/gmail/oauth-client.ts + app/api/auth/gmail/*), NICHT
 * mehr primär aus der Env-Var. GMAIL_REFRESH_TOKEN bleibt als Fallback
 * bestehen -- rein additiv, damit die bereits produktiv laufende Pipeline
 * (Webhook/Watch-Renewal) durch diese Umstellung nicht unterbrochen wird,
 * solange noch niemand über den neuen Button verbunden hat. Es gibt
 * realistisch genau EINE Verbindung (ein dediziertes Postfach für die ganze
 * Familie) -- deshalb hier bewusst ohne householdId-Parameter, anders als
 * lib/calendar/google/client.ts::getAccessTokenForHousehold in Lumi
 * Assistance (dort mehrere Haushalte mit je eigenem Kalender denkbar).
 */
function requireGmailEnv(name: 'GMAIL_CLIENT_ID' | 'GMAIL_CLIENT_SECRET' | 'GMAIL_REFRESH_TOKEN'): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} ist nicht konfiguriert.`)
  return value
}

async function loadRefreshToken(): Promise<string> {
  try {
    const lumiCore = createLumiCoreServiceClient()
    const { data } = await lumiCore.from('travel_gmail_connections').select('refresh_token').limit(1).maybeSingle()
    if (data?.refresh_token) return data.refresh_token
  } catch {
    // z. B. lokal ohne LUMI_CORE_SERVICE_ROLE_KEY -- Fallback unten greift trotzdem.
  }
  return requireGmailEnv('GMAIL_REFRESH_TOKEN')
}

/** Neuer OAuth2-Client pro Aufruf (kein Modul-Singleton) -- gleiche Vorsicht wie bei anderen server-only-Clients in diesem Projekt (z. B. createLumiCoreClient()), keine versteckte, aufrufübergreifend geteilte Instanz mit Nebenwirkungen. */
export async function createGmailOAuthClient() {
  const oauth2Client = new auth.OAuth2(
    requireGmailEnv('GMAIL_CLIENT_ID'),
    requireGmailEnv('GMAIL_CLIENT_SECRET'),
  )
  oauth2Client.setCredentials({ refresh_token: await loadRefreshToken() })
  return oauth2Client
}

/** Typisierter Gmail-API-Client (v1) für das dedizierte LUMI-Travel-Postfach. */
export async function createGmailClient() {
  return gmail({ version: 'v1', auth: await createGmailOAuthClient() })
}
