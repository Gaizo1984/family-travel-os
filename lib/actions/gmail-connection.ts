'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentPerson } from '@/lib/current-person'
import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'
import { createGmailClient } from '@/lib/gmail/gmail-client'
import { extractSenderEmail, findHeader } from '@/lib/gmail/gmail-message'

const REISE_POSTFACH_PATH = '/mehr/reise-postfach'

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss -- trennt die Verbindung. Exakt
 * nach dem Muster von lib/actions/google-calendar.ts::disconnectGoogleCalendar
 * in Lumi Assistance: löscht nur den Refresh Token, lässt bereits verarbeitete
 * travel_email_imports UNANGETASTET (kein Massenlöschen fremder Daten nur
 * weil die Verbindung getrennt wird). Der bestehende GMAIL_REFRESH_TOKEN-
 * Fallback in lib/gmail/gmail-client.ts greift danach wieder, falls gesetzt.
 */
export async function disconnectGmailConnection() {
  const person = await getCurrentPerson()
  if (!person) throw new Error('Nicht eingeloggt.')

  const lumiCore = createLumiCoreServiceClient()
  const { error } = await lumiCore.from('travel_gmail_connections').delete().eq('household_id', person.familyId)
  if (error) throw new Error(`Trennen fehlgeschlagen: ${error.message}`)

  revalidatePath(REISE_POSTFACH_PATH)
  redirect(REISE_POSTFACH_PATH)
}

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss (Nutzervorgabe, wörtlich):
 * "Verbindungstest mit users.messages.list... nur Mails von den bereits
 * hinterlegten erlaubten Absendern berücksichtigen." Bewusst rein lesend
 * und ohne Nebeneffekte -- kein Trash, kein Label, kein OpenAI-Aufruf,
 * keine travel_email_imports-Zeile. Die eigentliche Verarbeitung bleibt
 * ausschließlich lib/gmail/process-push.ts vorbehalten (läuft automatisch
 * über den Webhook) -- dieser Test soll nur zeigen, dass die Verbindung UND
 * die Whitelist-Prüfung grundsätzlich funktionieren, ohne echte Mails
 * anzufassen.
 */
export async function testGmailConnection() {
  const person = await getCurrentPerson()
  if (!person) throw new Error('Nicht eingeloggt.')

  const lumiCore = createLumiCoreServiceClient()

  // §Bugfix (vor Auslieferung gefunden): redirect() aus next/navigation wirft
  // intern (NEXT_REDIRECT), um die Umleitung umzusetzen -- ein redirect()
  // INNERHALB eines try-Blocks würde von dessen eigenem catch fälschlich als
  // Fehler abgefangen. Deshalb hier: Ergebnis im try/catch nur in Variablen
  // sammeln, beide redirect()-Aufrufe erst danach, außerhalb jedes try/catch.
  let checked = 0
  let allowedCount = 0
  let errorMessage: string | null = null

  try {
    const gmail = await createGmailClient()
    const { data: listData } = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], maxResults: 10 })
    const messageIds = (listData.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
    checked = messageIds.length

    for (const id of messageIds) {
      const meta = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From'] })
      const senderEmail = extractSenderEmail(findHeader(meta.data.payload?.headers ?? undefined, 'From'))
      if (!senderEmail) continue
      const { data: allowed } = await lumiCore
        .from('travel_email_allowed_senders')
        .select('id')
        .eq('email', senderEmail)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (allowed) allowedCount++
    }
  } catch (e) {
    // §"keine vollständigen Mailinhalte oder Tokens loggen": nur die
    // Fehlermeldung, nie Header-/Nachrichteninhalte oder das Token selbst.
    errorMessage = e instanceof Error ? e.message : 'unbekannter Fehler'
    console.error('[gmail-connection] Verbindungstest fehlgeschlagen:', errorMessage)
  }

  if (errorMessage) redirect(`${REISE_POSTFACH_PATH}?gmail_test_error=${encodeURIComponent(errorMessage)}`)
  const params = new URLSearchParams({ gmail_test_checked: String(checked), gmail_test_allowed: String(allowedCount) })
  redirect(`${REISE_POSTFACH_PATH}?${params.toString()}`)
}
