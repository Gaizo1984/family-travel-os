import 'server-only'
import type { gmail_v1 } from '@googleapis/gmail'

/**
 * §Reise-Postfach, Gmail-Status (Nutzervorgabe): "LUMI/Verarbeitet" /
 * "LUMI/Prüfen" / "LUMI/Fehler" -- Gmail bildet die Hierarchie aus dem "/"
 * im Namen automatisch. Prozess-lokaler Cache (kein Persistieren) spart
 * innerhalb EINES Push-Durchlaufs mit mehreren Nachrichten wiederholte
 * labels.list-Aufrufe -- bei einem Cold-Start einfach neu aufgebaut, kein
 * Korrektheitsrisiko.
 */
const labelIdCache = new Map<string, string>()

export async function ensureLabelId(gmail: gmail_v1.Gmail, name: string): Promise<string> {
  const cached = labelIdCache.get(name)
  if (cached) return cached

  const { data } = await gmail.users.labels.list({ userId: 'me' })
  const existing = data.labels?.find((l) => l.name === name)
  if (existing?.id) {
    labelIdCache.set(name, existing.id)
    return existing.id
  }

  const { data: created } = await gmail.users.labels.create({
    userId: 'me',
    requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
  })
  if (!created.id) throw new Error(`Gmail-Label "${name}" konnte nicht angelegt werden.`)
  labelIdCache.set(name, created.id)
  return created.id
}

/** Setzt das Ziel-Label und entfernt INBOX (§Nutzervorgabe "archivieren") -- eine bereits archivierte Mail löst dank labelIds:['INBOX'] in renewGmailWatch keine erneute Push-Benachrichtigung mehr aus. */
export async function applyLabelAndArchive(gmail: gmail_v1.Gmail, messageId: string, labelName: string): Promise<void> {
  const labelId = await ensureLabelId(gmail, labelName)
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds: [labelId], removeLabelIds: ['INBOX'] },
  })
}

/** §Nutzervorgabe ("nicht erlaubte Absender: direkt in Gmail-Papierkorb verschieben"): Gmail räumt den Papierkorb standardmäßig nach 30 Tagen automatisch -- akzeptiert, kein eigener Hard-Delete-Job. */
export async function trashMessage(gmail: gmail_v1.Gmail, messageId: string): Promise<void> {
  await gmail.users.messages.trash({ userId: 'me', id: messageId })
}
