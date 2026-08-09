import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { addDaysIso } from '@/lib/date-utils'
import { todayIsoInFamilyTimezone } from '@/lib/time'

export type BookingDocumentCleanupResult = { deleted: number; failed: number }

const DELETE_AFTER_TRIP_END_DAYS = 2

/**
 * §"Buchungsbestätigungen (u. a. Aktivitäts-Tickets) sollen sich 2 Tage nach
 * Reiseende automatisch löschen" (Nutzervorgabe, wörtlich, Vorschlag des
 * Nutzers übernommen): löscht ALLE `documents`-Zeilen mit
 * `doc_type = 'booking_document'` einer Reise, deren `end_date` (nur das
 * manuell gepflegte Feld -- bewusst nicht über deriveTripDateRange
 * hergeleitet, siehe Kommentar in lib/trip-dates.ts) mindestens
 * `DELETE_AFTER_TRIP_END_DAYS` Tage in der Vergangenheit liegt. Andere
 * `doc_type`-Werte (Pass, Visa, Versicherung, Boardingpass, Gepäckbeleg,
 * ...) werden NIE angefasst. Gehärtetes Löschmuster wie
 * lib/content-session-cleanup.ts: Storage-Datei zuerst, DB-Zeile nur bei
 * Erfolg, ein Fehlschlag bricht den Batch nicht ab.
 */
export async function cleanupExpiredBookingDocuments(): Promise<BookingDocumentCleanupResult> {
  const supabase = createServiceRoleClient()
  // Hinweis: es existiert (noch) kein Service-Role-Äquivalent für Lumi Core --
  // createLumiCoreClient() ist cookie-/session-basiert (siehe
  // lib/supabase/lumi-core-server.ts) und liefert in diesem sitzungslosen
  // Cron-Kontext keine authentifizierte Lumi-Core-Session, wodurch RLS jede
  // Abfrage still auf 0 Zeilen filtert (gleiches Muster wie beim Fehlen des
  // Service-Role-Keys, siehe Kommentar in lib/supabase/service-role.ts).
  // Ohne einen künftigen Lumi-Core-Service-Role-Client bleibt dieser Cleanup
  // für travel_documents wirkungslos.
  const lumiCore = await createLumiCoreClient()
  const cutoff = addDaysIso(todayIsoInFamilyTimezone(), -DELETE_AFTER_TRIP_END_DAYS)

  const { data: expiredTripsRaw } = await supabase
    .from('trips')
    .select('id')
    .not('end_date', 'is', null)
    .lte('end_date', cutoff)

  const tripIds = (expiredTripsRaw ?? []).map((t) => t.id)
  if (tripIds.length === 0) return { deleted: 0, failed: 0 }

  const { data: docsRaw } = await lumiCore
    .from('travel_documents')
    .select('id, storage_path')
    .eq('doc_type', 'booking_document')
    .in('trip_id', tripIds)

  const docs = docsRaw ?? []
  let deleted = 0
  let failed = 0

  for (const doc of docs) {
    if (!doc.storage_path) { failed++; continue }
    const { error: storageError } = await lumiCore.storage.from('travel-documents').remove([doc.storage_path])
    if (storageError) {
      // Nur Dokument-ID loggen -- kein Pfad/Inhalt.
      console.error('[booking-document-cleanup] storage delete failed', { documentId: doc.id })
      failed++
      continue
    }
    const { error: dbError } = await lumiCore.from('travel_documents').delete().eq('id', doc.id)
    if (dbError) {
      console.error('[booking-document-cleanup] db delete failed', { documentId: doc.id })
      failed++
      continue
    }
    deleted++
  }

  return { deleted, failed }
}
