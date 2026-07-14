import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredContentSessionPhotos } from '@/lib/content-session-cleanup'

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

  try {
    const result = await cleanupExpiredContentSessionPhotos()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron:cleanup-content-sessions] Lauf fehlgeschlagen', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
