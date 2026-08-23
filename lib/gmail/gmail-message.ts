import 'server-only'
import type { gmail_v1 } from '@googleapis/gmail'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE } from '@/lib/documents'

/**
 * §Reise-Postfach: reine, Gmail-API-freie Hilfsfunktionen zum Auswerten
 * einer bereits geladenen Nachricht (Header/MIME-Struktur) -- kein eigener
 * API-Aufruf hier, nur Parsing der von der Gmail API gelieferten Struktur.
 */

/** Gmail liefert Base64url (RFC 4648 §5) -- '-'/'_' statt '+'/'/' , kein Padding garantiert. */
export function decodeBase64Url(data: string): Buffer {
  const standard = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(standard, 'base64')
}

/**
 * Extrahiert die reine E-Mail-Adresse aus einem RFC-2822-`From`-Header
 * (z. B. `"Marcel Mustermann" <marcel@privat.de>` oder blank `marcel@privat.de`).
 * Gibt null zurück, wenn kein Header vorhanden ist oder sich keine
 * plausible Adresse herauslesen lässt -- niemals raten.
 */
export function extractSenderEmail(fromHeaderValue: string | null | undefined): string | null {
  if (!fromHeaderValue) return null
  const angleMatch = fromHeaderValue.match(/<([^<>]+)>/)
  const candidate = (angleMatch ? angleMatch[1] : fromHeaderValue).trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate.toLowerCase() : null
}

export function findHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  const lower = name.toLowerCase()
  return headers?.find((h) => h.name?.toLowerCase() === lower)?.value ?? null
}

export type ParsedAttachment = { attachmentId: string; filename: string; mimeType: string; size: number }

/**
 * Läuft die MIME-Baumstruktur rekursiv ab und sammelt Anhänge, die für die
 * bestehende Booking-Extraction überhaupt in Frage kommen -- dieselben
 * Grenzen wie beim Browser-Upload (lib/documents.ts:
 * ALLOWED_DOCUMENT_MIME_TYPES/MAX_DOCUMENT_FILE_SIZE), damit ein per Mail
 * eintreffender Anhang keine großzügigeren Regeln bekommt als ein manuell
 * hochgeladener.
 */
export function listValidAttachments(part: gmail_v1.Schema$MessagePart | undefined): ParsedAttachment[] {
  if (!part) return []
  const results: ParsedAttachment[] = []

  function walk(p: gmail_v1.Schema$MessagePart): void {
    const attachmentId = p.body?.attachmentId
    if (attachmentId && p.filename && p.mimeType) {
      const size = p.body?.size ?? 0
      if (ALLOWED_DOCUMENT_MIME_TYPES.includes(p.mimeType) && size > 0 && size <= MAX_DOCUMENT_FILE_SIZE) {
        results.push({ attachmentId, filename: p.filename, mimeType: p.mimeType, size })
      }
    }
    for (const child of p.parts ?? []) walk(child)
  }

  walk(part)
  return results
}

/** Sehr einfache Tag-Entfernung für den HTML-Fallback -- die extrahierte KI-Auslesung selbst bewertet ohnehin nur, was tatsächlich lesbar ist, hier muss kein sauberes Rendering entstehen, nur lesbarer Fließtext für das Sprachmodell. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Liefert den Textkörper der Nachricht, bevorzugt `text/plain`, sonst grob
 * von HTML befreiter `text/html`-Inhalt -- Fallback für Buchungsbestätigungen,
 * die keinen (unterstützten) Anhang haben und deren eigentlicher Inhalt die
 * Mail selbst ist. Auf 20.000 Zeichen begrenzt (mehr als genug für eine
 * Buchungsbestätigung, verhindert unnötig große KI-Eingaben bei sehr langen
 * Signatur-/Werbeblöcken).
 */
export function extractPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined): string | null {
  if (!part) return null
  let plain: string | null = null
  let html: string | null = null

  function walk(p: gmail_v1.Schema$MessagePart): void {
    if (p.mimeType === 'text/plain' && p.body?.data && !plain) plain = decodeBase64Url(p.body.data).toString('utf-8')
    if (p.mimeType === 'text/html' && p.body?.data && !html) html = decodeBase64Url(p.body.data).toString('utf-8')
    for (const child of p.parts ?? []) walk(child)
  }

  walk(part)
  const text = plain ?? (html ? stripHtml(html) : null)
  return text ? text.slice(0, 20000) : null
}
