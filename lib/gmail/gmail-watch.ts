import 'server-only'
import { createGmailClient } from './gmail-client'

/**
 * §Reise-Postfach, Implementierungsschritt "users.watch() produktiv"
 * (Nutzervorgabe, wörtlich): fester Pub/Sub-Topic-Pfad für das dedizierte
 * LUMI-Travel-Gmail-Postfach. Bewusst als Konstante statt Env-Var -- ein
 * Topic-Wechsel wäre ohnehin eine bewusste, seltene Infrastruktur-
 * entscheidung (und würde auch die bestehende Push-Subscription betreffen),
 * kein Fall für eine weitere Konfigurationsoption.
 */
const GMAIL_PUBSUB_TOPIC = 'projects/lumi-travel-mail/topics/lumi-travel-gmail'

export type GmailWatchResult = { historyId: string; expiration: string }

/**
 * Registriert/erneuert die Gmail-Push-Benachrichtigung für userId "me"
 * (das per GMAIL_REFRESH_TOKEN authentifizierte, dedizierte LUMI-Travel-
 * Postfach). Ein Gmail-Watch läuft laut Google spätestens nach 7 Tagen ab
 * -- Erneuerung übernimmt der tägliche Cron-Job
 * app/api/cron/renew-gmail-watch/route.ts, reichlich Sicherheitsabstand.
 *
 * `labelIds: ['INBOX']` + `labelFilterAction: 'include'`: benachrichtigt
 * bewusst NUR bei Änderungen an eingehenden Mails, nicht bei jeder
 * beliebigen Label-Änderung. Wichtig für den späteren
 * Verarbeitungs-Schritt (Gmail-Status-Vorgabe "verarbeitet/geprüft/Fehler
 * -> Label setzen + archivieren", d. h. INBOX-Label wird beim Archivieren
 * entfernt): eine bereits verarbeitete, aus INBOX entfernte Mail löst dann
 * KEINE erneute Benachrichtigung mehr aus -- kein Verarbeitungs-Loop durch
 * die eigenen, späteren Label-/Archivierungs-Schreibvorgänge.
 *
 * Wirft bei einem Gmail-API-Fehler -- der Aufrufer (Cron-Route) entscheidet
 * über Logging/Statuscode, hier keine stille Fehlerbehandlung.
 */
export async function renewGmailWatch(): Promise<GmailWatchResult> {
  const gmail = await createGmailClient()
  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: GMAIL_PUBSUB_TOPIC,
      labelIds: ['INBOX'],
      labelFilterAction: 'include',
    },
  })

  const { historyId, expiration } = response.data
  if (!historyId || !expiration) throw new Error('Gmail users.watch() lieferte weder historyId noch expiration.')

  return { historyId, expiration }
}
