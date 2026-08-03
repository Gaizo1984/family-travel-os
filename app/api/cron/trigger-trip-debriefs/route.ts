import { NextRequest, NextResponse } from 'next/server'
import { triggerDueTripDebriefs } from '@/lib/trip-debrief-generation'

export const maxDuration = 30

/**
 * §"Nachreise-Dialog" (Nutzervorgabe): gleiches Schutzmuster wie die
 * übrigen Cron-Routen (CRON_SECRET-Bearer, keine Öffnung ohne gesetztes
 * Secret). Täglicher Takt reicht -- die Auslösefenster (1-3 Tage nach
 * Reiseende) sind tagesgenau, kein stündlicher Bedarf wie beim
 * Hinweis-Cron.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    console.error('[cron:trigger-trip-debriefs] CRON_SECRET ist nicht gesetzt -- Route bleibt gesperrt.')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await triggerDueTripDebriefs()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron:trigger-trip-debriefs] Lauf fehlgeschlagen', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
