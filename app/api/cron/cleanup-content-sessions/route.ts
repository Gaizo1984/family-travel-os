import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredContentSessionPhotos } from '@/lib/content-session-cleanup'
import { cleanupExpiredReelVideos } from '@/lib/reel-video-cleanup'

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
 * §Bewusst UM den Reel-Video-Cleanup erweitert statt eines eigenen dritten
 * Cron-Eintrags (Vercel begrenzt die Anzahl der Cron-Jobs je nach Plan) --
 * beide räumen "temporäre Content-Studio-Dateien" auf, ein fehlgeschlagener
 * Teil blockiert den anderen nicht.
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

  const [photosResult, videosResult] = await Promise.allSettled([
    cleanupExpiredContentSessionPhotos(),
    cleanupExpiredReelVideos(),
  ])
  if (photosResult.status === 'rejected') console.error('[cron:cleanup-content-sessions] Foto-Cleanup fehlgeschlagen', photosResult.reason)
  if (videosResult.status === 'rejected') console.error('[cron:cleanup-content-sessions] Video-Cleanup fehlgeschlagen', videosResult.reason)

  return NextResponse.json({
    ok: photosResult.status === 'fulfilled' && videosResult.status === 'fulfilled',
    photos: photosResult.status === 'fulfilled' ? photosResult.value : null,
    videos: videosResult.status === 'fulfilled' ? videosResult.value : null,
  })
}
