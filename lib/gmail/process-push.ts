import 'server-only'
import type { gmail_v1 } from '@googleapis/gmail'
import { createGmailClient } from './gmail-client'
import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'
import { extractSenderEmail, findHeader, listValidAttachments, extractPlainTextBody, decodeBase64Url } from './gmail-message'
import { applyLabelAndArchive, trashMessage } from './gmail-labels'
import { EMAIL_BOOKING_SCHEMA, buildAutoDetectBookingPrompt, callBookingExtractionModel, type ExtractionResult, type ExtractionInput } from '@/lib/booking-extraction-core'

/**
 * §Reise-Postfach, Implementierungsschritt "Mail-Verarbeitung" (Nutzervorgabe,
 * wörtlich): "Beim Gmail-Push niemals sofort vollständigen Mailinhalt oder
 * Anhänge laden und niemals OpenAI aufrufen. Zuerst ausschließlich minimale
 * Gmail-Metadaten/Header laden... Nicht erlaubte Absender sofort in den
 * Papierkorb... Erst für erlaubte Absender vollständige Nachricht und
 * Anhänge abrufen und die bestehende Booking-Extraction starten."
 *
 * §Standing Nutzervorgabe (unverändert bindend, aus einem früheren Schritt):
 * "Bei mittlerer oder niedriger Reisezuordnung niemals automatisch eine
 * Buchung erzeugen." Eine Reisezuordnungs-Logik (Datum/Ort/Reisende-
 * Scoring) existiert noch nicht -- jede erfolgreiche Extraktion landet
 * deshalb bewusst IMMER in travel_email_imports mit status='needs_review',
 * NIE als automatisch angelegte travel_bookings-Zeile. Das Anlegen der
 * eigentlichen Buchung (nach Reisezuordnung + Bestätigung) ist ein
 * bewusst separater, noch nicht gebauter nächster Schritt.
 *
 * Läuft ausschließlich mit dem Lumi-Core-Service-Role-Client (kein Cookie/
 * keine Session in diesem Kontext vorhanden) -- exakt dasselbe Muster wie
 * lib/booking-document-cleanup.ts für andere sitzungslose Cron-/Webhook-
 * Kontexte.
 */
const MAX_MESSAGES_PER_RUN = 15

export type ProcessPushResult = { processed: number; rejected: number; errored: number }

export async function processGmailPush(): Promise<ProcessPushResult> {
  const gmail = await createGmailClient()
  const lumiCore = createLumiCoreServiceClient()

  const { data: listData } = await gmail.users.messages.list({ userId: 'me', labelIds: ['INBOX'], maxResults: MAX_MESSAGES_PER_RUN })
  const candidateIds = (listData.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
  if (candidateIds.length === 0) return { processed: 0, rejected: 0, errored: 0 }

  // §Dubletten (Nutzervorgabe aus einem früheren Schritt, "mindestens anhand
  // von Gmail Message-ID"): bereits bekannte Nachrichten werden gar nicht
  // erst erneut angefasst -- weder Header noch sonst irgendetwas geladen.
  const { data: knownRows } = await lumiCore.from('travel_email_imports').select('gmail_message_id').in('gmail_message_id', candidateIds)
  const known = new Set((knownRows ?? []).map((r) => r.gmail_message_id))
  const newIds = candidateIds.filter((id) => !known.has(id))

  const result: ProcessPushResult = { processed: 0, rejected: 0, errored: 0 }
  for (const messageId of newIds) {
    const outcome = await processOneMessage(gmail, lumiCore, messageId)
    result[outcome]++
  }
  return result
}

type LumiCoreServiceClient = ReturnType<typeof createLumiCoreServiceClient>

/**
 * §Bugfix (Nutzer-Feedback: "Mail landet unter LUMI/Fehler, aber es gibt
 * keine Zeile in travel_email_imports"): schlug der INSERT fehl, wurde das
 * bisher nur geloggt -- der Aufrufer archivierte/labelte die Mail trotzdem
 * weiter, als wäre alles wie vorgesehen gelaufen. Ergebnis: die Nachricht
 * verschwindet aus INBOX, obwohl es dafür GAR KEINEN Datensatz gibt --
 * unsichtbar für Nutzer UND für einen künftigen Retry (sie ist ja nicht mehr
 * "neu in INBOX"). Gibt jetzt zurück, ob der Schreibvorgang wirklich
 * geglückt ist -- der Aufrufer darf NUR bei true labeln/archivieren, bei
 * false bleibt die Mail bewusst unangetastet in INBOX liegen (wird beim
 * nächsten Push erneut versucht, da sie weiterhin "neu" ist).
 */
async function insertImportRow(
  lumiCore: LumiCoreServiceClient,
  args: {
    householdId: string; forwardedBy: string; messageId: string; threadId: string | null
    senderEmail: string; receivedAt: string | null; extractedData: ExtractionResult | null
    suggestedType: string | null; status: 'needs_review' | 'error'; errorMessage: string | null
  },
): Promise<boolean> {
  const { error } = await lumiCore.from('travel_email_imports').insert({
    household_id: args.householdId,
    gmail_message_id: args.messageId,
    gmail_thread_id: args.threadId,
    sender_email: args.senderEmail,
    forwarded_by_household_member_id: args.forwardedBy,
    received_at: args.receivedAt,
    extracted_data: args.extractedData ?? {},
    suggested_booking_type: args.suggestedType,
    import_status: args.status,
    error_message: args.errorMessage,
    processed_at: new Date().toISOString(),
  })
  if (!error) return true
  // §Idempotenz: eine erneute/gleichzeitige Zustellung derselben Nachricht
  // kann hier auf den bestehenden Unique-Index (household_id,
  // gmail_message_id) laufen -- erwarteter Dedupe-Fall, kein echter Fehler,
  // die Nachricht darf trotzdem als "schon erfasst" weiterbehandelt werden.
  if (error.code === '23505') return true
  console.error('[gmail-webhook] travel_email_imports-Insert fehlgeschlagen', error.message)
  return false
}

async function processOneMessage(
  gmail: gmail_v1.Gmail,
  lumiCore: LumiCoreServiceClient,
  messageId: string,
): Promise<'processed' | 'rejected' | 'errored'> {
  // 1. §Vorgabe "zuerst ausschließlich minimale Gmail-Metadaten/Header
  // laden" -- format:'metadata' liefert explizit KEINEN Body/Anhang.
  const meta = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'metadata', metadataHeaders: ['From'] })
  const senderEmail = extractSenderEmail(findHeader(meta.data.payload?.headers ?? undefined, 'From'))

  if (!senderEmail) {
    await trashMessage(gmail, messageId)
    console.log('[gmail-webhook] Absender nicht ermittelbar -- in Papierkorb verschoben')
    return 'rejected'
  }

  // 2. §Vorgabe "Absender gegen travel_email_allowed_senders prüfen" --
  // VOR jedem weiteren Laden, VOR jeder KI-Verarbeitung. email wurde beim
  // Anlegen des Whitelist-Eintrags bereits kleingeschrieben gespeichert
  // (lib/actions/email-allowed-senders.ts), extractSenderEmail liefert
  // ebenfalls kleingeschrieben -- einfacher, eindeutiger eq()-Vergleich.
  const { data: allowed, error: allowedError } = await lumiCore
    .from('travel_email_allowed_senders')
    .select('household_id, household_member_id')
    .eq('email', senderEmail)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  // §Bugfix (vor Auslieferung gefunden): ein echter Abfragefehler (z. B.
  // vorübergehende DB-Störung) darf NIE wie "nicht erlaubt" behandelt
  // werden -- sonst würde eine eigentlich erlaubte Mail fälschlich
  // getrasht. Bei Unsicherheit bleibt die Mail unangetastet in INBOX und
  // wird beim nächsten Push erneut versucht (`limit(1)` vor maybeSingle()
  // verhindert zusätzlich, dass maybeSingle() selbst bei einem
  // theoretischen Mehrfachtreffer -- z. B. dieselbe Adresse in zwei
  // Haushalten -- einen Fehler wirft).
  if (allowedError) {
    console.error('[gmail-webhook] Whitelist-Prüfung fehlgeschlagen', allowedError.message)
    return 'errored'
  }

  if (!allowed) {
    await trashMessage(gmail, messageId)
    console.log('[gmail-webhook] Absender nicht auf Whitelist -- in Papierkorb verschoben')
    return 'rejected'
  }

  // 3. Erst jetzt, für einen erlaubten Absender: vollständige Nachricht laden.
  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
  const threadId = full.data.threadId ?? null
  const receivedAt = full.data.internalDate ? new Date(Number(full.data.internalDate)).toISOString() : null

  const attachments = listValidAttachments(full.data.payload ?? undefined)
  let extractionInput: ExtractionInput | null = null

  if (attachments.length > 0) {
    const first = attachments[0]
    const { data: attachmentData } = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: first.attachmentId })
    if (attachmentData.data) {
      extractionInput = { kind: 'file', filename: first.filename, mimeType: first.mimeType, base64: decodeBase64Url(attachmentData.data).toString('base64') }
    }
  }
  if (!extractionInput) {
    const text = extractPlainTextBody(full.data.payload ?? undefined)
    if (text) extractionInput = { kind: 'text', text }
  }

  if (!extractionInput) {
    const saved = await insertImportRow(lumiCore, {
      householdId: allowed.household_id, forwardedBy: allowed.household_member_id,
      messageId, threadId, senderEmail, receivedAt,
      extractedData: null, suggestedType: null, status: 'error',
      errorMessage: 'Kein auswertbarer Inhalt gefunden (kein unterstützter Anhang, kein Textkörper).',
    })
    if (saved) await applyLabelAndArchive(gmail, messageId, 'LUMI/Fehler')
    return 'errored'
  }

  // 4. §Vorgabe "die bestehende Booking-Extraction starten" -- gemeinsamer
  // Kern mit dem Browser-Upload (lib/booking-extraction-core.ts), nur mit
  // Typ-Selbsterkennung statt vorab gewähltem Typ.
  let parsed: ExtractionResult
  try {
    parsed = await callBookingExtractionModel(extractionInput, EMAIL_BOOKING_SCHEMA, buildAutoDetectBookingPrompt())
  } catch (e) {
    console.error('[gmail-webhook] Extraktion fehlgeschlagen', e instanceof Error ? e.message : e)
    const saved = await insertImportRow(lumiCore, {
      householdId: allowed.household_id, forwardedBy: allowed.household_member_id,
      messageId, threadId, senderEmail, receivedAt,
      extractedData: null, suggestedType: null, status: 'error',
      errorMessage: 'KI-Auslesung nicht verfügbar (Fehler oder Zeitüberschreitung).',
    })
    if (saved) await applyLabelAndArchive(gmail, messageId, 'LUMI/Fehler')
    return 'errored'
  }

  if (!parsed.readable) {
    const saved = await insertImportRow(lumiCore, {
      householdId: allowed.household_id, forwardedBy: allowed.household_member_id,
      messageId, threadId, senderEmail, receivedAt,
      extractedData: parsed, suggestedType: null, status: 'error',
      errorMessage: 'Inhalt nicht zuverlässig lesbar.',
    })
    if (saved) await applyLabelAndArchive(gmail, messageId, 'LUMI/Fehler')
    return 'errored'
  }

  const saved = await insertImportRow(lumiCore, {
    householdId: allowed.household_id, forwardedBy: allowed.household_member_id,
    messageId, threadId, senderEmail, receivedAt,
    extractedData: parsed,
    suggestedType: typeof parsed.booking_type === 'string' ? parsed.booking_type : null,
    status: 'needs_review',
    errorMessage: null,
  })
  if (saved) await applyLabelAndArchive(gmail, messageId, 'LUMI/Prüfen')
  return saved ? 'processed' : 'errored'
}
