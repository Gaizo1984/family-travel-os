import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredContentSessionPhotos } from '@/lib/content-session-cleanup'
import { cleanupExpiredReelVideos } from '@/lib/reel-video-cleanup'
import { cleanupExpiredBookingDocuments } from '@/lib/booking-document-cleanup'
import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'

export const maxDuration = 60

/**
 * §"Cleanup darf nur temporäre, abgelaufene Bilder löschen, geschützte
 * Route, kein Secret im Client": Vercel Cron sendet bei konfiguriertem
 * `CRON_SECRET` automatisch `Authorization: Bearer <CRON_SECRET>` mit --
 * diese Route prüft nur den Server-seitigen Umgebungsvariablen-Wert dagegen,
 * es wird nirgends ein Secret erzeugt oder in Client-Code referenziert.
 * Ohne gesetztes CRON_SECRET wird die Route sicherheitshalber abgelehnt
 * (kein Fallback auf "offen"), damit ein vergessenes Setup nicht zu einem
 * unbeabsichtigt öffentlichen Lösch-Endpunkt wird.
 *
 * §Bewusst UM Reel-Video- UND Buchungsbeleg-Cleanup erweitert statt eigener
 * weiterer Cron-Einträge (Vercel begrenzt die Anzahl der Cron-Jobs je nach
 * Plan) -- alle drei räumen "temporäre/nach Ablauf nicht mehr benötigte
 * Dateien" auf (Content-Studio-Fotos/-Videos bzw. Buchungsbelege 2 Tage
 * nach Reiseende), ein fehlgeschlagener Teil blockiert die anderen nicht.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    console.error('[cron:cleanup-content-sessions] CRON_SECRET ist nicht gesetzt -- Route bleibt gesperrt.')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const lumiCore = createLumiCoreServiceClient()
  const [photosResult, videosResult, bookingDocumentsResult] = await Promise.allSettled([
    cleanupExpiredContentSessionPhotos(lumiCore),
    cleanupExpiredReelVideos(lumiCore),
    cleanupExpiredBookingDocuments(),
  ])
  if (photosResult.status === 'rejected') console.error('[cron:cleanup-content-sessions] Foto-Cleanup fehlgeschlagen', photosResult.reason)
  if (videosResult.status === 'rejected') console.error('[cron:cleanup-content-sessions] Video-Cleanup fehlgeschlagen', videosResult.reason)
  if (bookingDocumentsResult.status === 'rejected') console.error('[cron:cleanup-content-sessions] Buchungsbeleg-Cleanup fehlgeschlagen', bookingDocumentsResult.reason)

  return NextResponse.json({
    ok: photosResult.status === 'fulfilled' && videosResult.status === 'fulfilled' && bookingDocumentsResult.status === 'fulfilled',
    photos: photosResult.status === 'fulfilled' ? photosResult.value : null,
    videos: videosResult.status === 'fulfilled' ? videosResult.value : null,
    bookingDocuments: bookingDocumentsResult.status === 'fulfilled' ? bookingDocumentsResult.value : null,
  })
}
