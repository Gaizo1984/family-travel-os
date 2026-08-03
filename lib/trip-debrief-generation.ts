import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { todayIsoInFamilyTimezone } from '@/lib/time'
import { addDaysIso } from '@/lib/date-utils'

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
