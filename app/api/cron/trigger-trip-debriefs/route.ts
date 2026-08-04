import { NextRequest, NextResponse } from 'next/server'
import { triggerDueTripDebriefs, triggerDueVacationPostCuration } from '@/lib/trip-debrief-generation'

export const maxDuration = 60

/**
 * §"Nachreise-Dialog" (Nutzervorgabe): gleiches Schutzmuster wie die
 * übrigen Cron-Routen (CRON_SECRET-Bearer, keine Öffnung ohne gesetztes
 * Secret). Täglicher Takt reicht -- die Auslösefenster (1-3 Tage nach
 * Reiseende) sind tagesgenau, kein stündlicher Bedarf wie beim
 * Hinweis-Cron.
 *
 * §"Urlaubsbeitrag aus dem Bild-Check" (Nutzervorgabe): die automatische
 * Foto-Kuration teilt sich bewusst diese Route statt eines eigenen Cron-
 * Eintrags (Vercel-Cron-Anzahl-Limit, siehe cleanup-content-sessions für
 * dasselbe Bündelungsmuster) -- `Promise.allSettled`, damit ein langsamer/
 * fehlschlagender KI-Kurationslauf den schnellen, unabhängigen Debrief-
 * Trigger nicht blockiert oder mitreißt. `maxDuration` deshalb von 30 auf
 * 60 angehoben (OpenAI-Aufrufe pro fälliger Reise).
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

  const [debriefs, vacationPostCuration] = await Promise.allSettled([
    triggerDueTripDebriefs(),
    triggerDueVacationPostCuration(),
  ])

  if (debriefs.status === 'rejected') console.error('[cron:trigger-trip-debriefs] Debrief-Trigger fehlgeschlagen', debriefs.reason)
  if (vacationPostCuration.status === 'rejected') console.error('[cron:trigger-trip-debriefs] Urlaubsbeitrag-Kuration fehlgeschlagen', vacationPostCuration.reason)

  return NextResponse.json({
    ok: debriefs.status === 'fulfilled' || vacationPostCuration.status === 'fulfilled',
    debriefs: debriefs.status === 'fulfilled' ? debriefs.value : { error: true },
    vacationPostCuration: vacationPostCuration.status === 'fulfilled' ? vacationPostCuration.value : { error: true },
  })
}
