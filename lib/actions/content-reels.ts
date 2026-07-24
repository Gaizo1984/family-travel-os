'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { REEL_STYLE_OPTIONS } from '@/lib/ai-style-guidelines'

/**
 * §Content Studio 3.0, Sprint 1: legt den Reel-Projekt-Container an
 * (content_projects, project_type='reel') -- exakt dasselbe Anlage-Muster
 * wie `startContentSession` (lib/actions/content-sessions.ts), inkl.
 * Wiederverwendung des status-Feldes als Fortschritts-State-Machine
 * ("uploading" als generischer Anfangszustand, unabhängig davon, ob als
 * nächstes wirklich hochgeladen oder -- wie hier -- aus vorhandenen Medien
 * ausgewählt wird, siehe Sprint 2).
 *
 * §"Noch keine KI-Analyse, Timeline oder produktives Rendering" (Sprint-1-
 * Abgrenzung): nach dem Anlegen geht es auf die bereits bestehende,
 * generische Projektübersicht (/content-studio/projects/[projectId]) --
 * keine neue Detailseite in diesem Schritt, echte Wiederverwendung statt
 * einer weiteren, noch leeren Seite.
 */
export async function startReelProject(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const reelStyle = String(formData.get('reel_style') ?? '')
  const reelDurationRaw = String(formData.get('reel_duration_seconds') ?? '')
  const newPath = '/content-studio/reel/new'

  if (!tripId) redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const validStyle = REEL_STYLE_OPTIONS.some((o) => o.value === reelStyle)
  if (!validStyle) redirect(`${newPath}?error=${encodeURIComponent('Bitte einen Stil auswählen.')}`)

  const reelDurationSeconds = Number(reelDurationRaw)
  if (reelDurationSeconds !== 15 && reelDurationSeconds !== 30) {
    redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Dauer auswählen (15 oder 30 Sekunden).')}`)
  }

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const { data: trip } = await supabase.from('trips').select('title').eq('id', tripId).maybeSingle()

  const { data: project, error } = await supabase.from('content_projects').insert({
    family_id: familyId,
    trip_id: tripId,
    title: trip?.title ? `Reel · ${trip.title}` : 'Reel',
    status: 'uploading',
    project_type: 'reel',
    reel_style: reelStyle,
    reel_duration_seconds: reelDurationSeconds,
  }).select('id').single()

  if (error || !project) {
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)
  }

  redirect(`/content-studio/projects/${project.id}`)
}
