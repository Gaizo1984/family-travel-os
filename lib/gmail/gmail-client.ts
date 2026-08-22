import 'server-only'
import { gmail, auth } from '@googleapis/gmail'

/**
 * §Reise-Postfach, Implementierungsschritt "Server-seitiger Gmail-Client"
 * (Nutzervorgabe, wörtlich): Client-Konstruktion auf Basis der drei
 * serverseitigen Secrets GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/
 * GMAIL_REFRESH_TOKEN -- ausschließlich aus process.env gelesen, nie
 * hartkodiert, nie an Client-Code durchgereicht ('server-only' erzwingt das
 * bereits beim Build, s. lib/actions/booking-extraction.ts für dasselbe
 * Prinzip bei OPENAI_API_KEY).
 *
 * Der Refresh-Token stammt aus dem einmaligen, bereits durchgeführten
 * OAuth-Consent-Flow für das dedizierte LUMI-Travel-Gmail-Postfach (Scope
 * gmail.modify) -- keine erneute interaktive Anmeldung nötig, der
 * OAuth2-Client erneuert Access-Tokens im Hintergrund selbst.
 *
 * NOCH UNGENUTZT (bewusst): diese Datei wird aktuell von keinem Aufrufer
 * importiert. Der Webhook (app/api/gmail/webhook/route.ts) nimmt Pub/Sub-
 * Push-Nachrichten bislang nur entgegen und quittiert sie -- er ruft die
 * Gmail API noch nicht auf (§Nutzervorgabe "noch keine echte
 * Mailverarbeitung aktivieren"). Diese Datei ist vorbereitete
 * Infrastruktur für den nächsten Schritt.
 *
 * §Bugfix (vor Auslieferung gefunden): bewusst `@googleapis/gmail` (nur der
 * Gmail-Teil) statt des vollen `googleapis`-Pakets -- letzteres bündelt die
 * TypeScript-Typen für praktisch alle Google-APIs in einem Paket und ließ
 * `tsc --noEmit` in diesem bereits großen Projekt mit "JavaScript heap out
 * of memory" abbrechen. Gleiche Laufzeit-API (`googleapis-common`
 * darunter), nur ohne den unnötigen Typ-Ballast.
 */
function requireGmailEnv(name: 'GMAIL_CLIENT_ID' | 'GMAIL_CLIENT_SECRET' | 'GMAIL_REFRESH_TOKEN'): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} ist nicht konfiguriert.`)
  return value
}

/** Neuer OAuth2-Client pro Aufruf (kein Modul-Singleton) -- gleiche Vorsicht wie bei anderen server-only-Clients in diesem Projekt (z. B. createLumiCoreClient()), keine versteckte, aufrufübergreifend geteilte Instanz mit Nebenwirkungen. */
export function createGmailOAuthClient() {
  const oauth2Client = new auth.OAuth2(
    requireGmailEnv('GMAIL_CLIENT_ID'),
    requireGmailEnv('GMAIL_CLIENT_SECRET'),
  )
  oauth2Client.setCredentials({ refresh_token: requireGmailEnv('GMAIL_REFRESH_TOKEN') })
  return oauth2Client
}

/** Typisierter Gmail-API-Client (v1) für das dedizierte LUMI-Travel-Postfach. */
export function createGmailClient() {
  return gmail({ version: 'v1', auth: createGmailOAuthClient() })
}
