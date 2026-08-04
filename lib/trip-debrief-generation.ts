import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { todayIsoInFamilyTimezone } from '@/lib/time'
import { addDaysIso } from '@/lib/date-utils'
import { buildTripDigest } from '@/lib/trip-digest'
import {
  curateVacationPostSelection, computeVacationPostExpiresAt, type VacationPostCandidate,
} from '@/lib/vacation-post-curation'

/**
 * §"1-3 Tage nach Reiseende soll LUMI EINMALIG einen kompakten Rückblick
 * anbieten" (Nutzervorgabe, wörtlich): gleiches `trips.end_date`-Muster wie
 * lib/booking-document-cleanup.ts (bewusst das rohe Feld, nicht
 * deriveTripDateRange -- siehe dortiger Kommentar). "Einmalig" heißt: pro
 * Reise wird höchstens EIN trip_debriefs-Datensatz jemals angelegt,
 * unabhängig von seinem späteren Status (aktiv/abgeschlossen/übersprungen/
 * geschlossen) -- ein bereits übersprungener Dialog wird nie erneut erzeugt.
 */
const TRIGGER_WINDOW_START_DAYS_AFTER_END = 1
const TRIGGER_WINDOW_END_DAYS_AFTER_END = 3

export type TripDebriefTriggerResult = { tripsChecked: number; created: number }

export async function triggerDueTripDebriefs(): Promise<TripDebriefTriggerResult> {
  const supabase = createServiceRoleClient()
  const today = todayIsoInFamilyTimezone()
  const windowStart = addDaysIso(today, -TRIGGER_WINDOW_END_DAYS_AFTER_END)
  const windowEnd = addDaysIso(today, -TRIGGER_WINDOW_START_DAYS_AFTER_END)

  const { data: dueTripsRaw } = await supabase
    .from('trips')
    .select('id, family_id')
    .not('end_date', 'is', null)
    .gte('end_date', windowStart)
    .lte('end_date', windowEnd)
    .neq('status', 'archived')

  const dueTrips = dueTripsRaw ?? []
  let created = 0

  for (const trip of dueTrips) {
    const { data: existing } = await supabase.from('trip_debriefs').select('id').eq('trip_id', trip.id).limit(1)
    if ((existing?.length ?? 0) > 0) continue

    const { error } = await supabase.from('trip_debriefs').insert({
      family_id: trip.family_id, trip_id: trip.id, status: 'active', current_step: 'intro', answers: {},
    })
    if (!error) created++
  }

  return { tripsChecked: dueTrips.length, created }
}

/**
 * §"Nach Ende der Reise soll LUMI aus allen geeigneten analysierten und
 * vorgemerkten Bildern maximal 15 Bilder... vorschlagen" (Nutzervorgabe,
 * wörtlich): gleiches Datumsfenster-/Einmaligkeits-Muster wie
 * `triggerDueTripDebriefs` oben, absichtlich im selben Modul (kein neuer
 * Cron-Eintrag, siehe app/api/cron/trigger-trip-debriefs/route.ts) -- bei
 * Vercel Hobby-Plan-Cron-Limits wird Bestehendes erweitert statt ein neuer
 * Cron angelegt. "Einmalig" wird hier NICHT über eine eigene Marker-Tabelle
 * geprüft (es gibt bewusst keine neue Tabelle, siehe
 * lib/vacation-post-curation.ts), sondern darüber, ob unter den
 * vorgemerkten Fotos dieser Reise bereits IRGENDEIN `vacation_post_rank`
 * gesetzt ist -- ein manueller "Neu kuratieren"-Klick (eigene Server Action)
 * bleibt davon unberührt, da der NICHT über diese Funktion läuft.
 */
export type VacationPostCurationTriggerResult = { tripsChecked: number; curated: number }

export async function triggerDueVacationPostCuration(): Promise<VacationPostCurationTriggerResult> {
  const supabase = createServiceRoleClient()
  const today = todayIsoInFamilyTimezone()
  const windowStart = addDaysIso(today, -TRIGGER_WINDOW_END_DAYS_AFTER_END)
  const windowEnd = addDaysIso(today, -TRIGGER_WINDOW_START_DAYS_AFTER_END)

  const { data: dueTripsRaw } = await supabase
    .from('trips')
    .select('id, end_date')
    .not('end_date', 'is', null)
    .gte('end_date', windowStart)
    .lte('end_date', windowEnd)
    .neq('status', 'archived')

  const dueTrips = dueTripsRaw ?? []
  let curated = 0

  for (const trip of dueTrips) {
    const { data: projectRows } = await supabase
      .from('content_projects').select('id').eq('trip_id', trip.id).eq('project_type', 'image_check')
    const projectIds = (projectRows ?? []).map((p) => p.id)
    if (projectIds.length === 0) continue

    const { data: candidateRows } = await supabase
      .from('content_project_photos')
      .select('id, vacation_post_score, vacation_post_reasoning, vacation_post_rank, vacation_post_pinned')
      .in('project_id', projectIds)
      .not('vacation_post_marked_at', 'is', null)

    const candidates = candidateRows ?? []
    if (candidates.length === 0) continue
    if (candidates.some((c) => c.vacation_post_rank !== null)) continue // bereits kuratiert

    const tripDigest = await buildTripDigest(trip.id, supabase)
    const vacationPostCandidates: VacationPostCandidate[] = candidates.map((c) => ({
      photoId: c.id, score: c.vacation_post_score, reasoning: c.vacation_post_reasoning,
      pinned: c.vacation_post_pinned, existingRank: c.vacation_post_rank,
    }))
    const selection = await curateVacationPostSelection(vacationPostCandidates, tripDigest)
    if (!selection) continue

    const rankByPhotoId = new Map(selection.map((s) => [s.photoId, s.rank]))
    const expiresAt = computeVacationPostExpiresAt(trip.end_date)

    await Promise.all(candidates.map((c) =>
      supabase.from('content_project_photos').update({
        vacation_post_rank: rankByPhotoId.get(c.id) ?? null,
        expires_at: expiresAt,
      }).eq('id', c.id),
    ))

    curated++
  }

  return { tripsChecked: dueTrips.length, curated }
}
