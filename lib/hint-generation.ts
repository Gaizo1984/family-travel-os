import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'
import { isTripHistorical } from '@/lib/trip-status'
import { generateHintsForTrip } from '@/lib/hints/registry'
import type { HintDraft } from '@/lib/hints/types'

type LumiCoreServiceClient = SupabaseClient<LumiCoreDatabase>

export type HintGenerationResult = { tripsProcessed: number; created: number; updated: number; reactivated: number; deleted: number; unchanged: number }

function hashInput(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

type ExistingHintRow = { id: string; dedupe_key: string; status: string; content_hash: string }

/**
 * §"Cron erzeugt + persistiert, Seite liest nur" (Architekturplan): pro
 * aktiver (nicht-historischer) Reise die komplette Regel-Registry
 * ausführen und auf `(trip_id, dedupe_key)` upserten -- bereits verworfene/
 * erledigte Hinweise bleiben verworfen, solange sich ihr `content_hash`
 * (nur die inhaltlich relevanten Eingabefelder, siehe lib/hints/types.ts)
 * nicht geändert hat. Das ist der konkrete Mechanismus für "nicht erneut
 * anzeigen, solange sich die zugrunde liegenden Daten nicht relevant
 * geändert haben".
 *
 * FINALER CUTOVER: läuft jetzt über den Lumi-Core-Service-Role-Client
 * (lib/supabase/lumi-core-service.ts) gegen `travel_trips`/`travel_trip_hints`.
 */
export async function generateAllTripHints(): Promise<HintGenerationResult> {
  const lumiCore = createLumiCoreServiceClient()
  const result: HintGenerationResult = { tripsProcessed: 0, created: 0, updated: 0, reactivated: 0, deleted: 0, unchanged: 0 }

  const { data: tripsRaw } = await lumiCore
    .from('travel_trips')
    .select('id, slug, household_id, status, start_date, end_date')
    .neq('status', 'archived')

  const trips = (tripsRaw ?? []).filter((t) => !isTripHistorical(t))

  for (const trip of trips) {
    const drafts = await generateHintsForTrip(lumiCore, trip.id, trip.household_id, trip.slug)
    await upsertHintsForTrip(lumiCore, trip.id, trip.household_id, drafts, result)
    result.tripsProcessed++
  }

  return result
}

async function upsertHintsForTrip(
  lumiCore: LumiCoreServiceClient,
  tripId: string,
  familyId: string,
  drafts: HintDraft[],
  result: HintGenerationResult,
): Promise<void> {
  const { data: existingRaw } = await lumiCore
    .from('travel_trip_hints')
    .select('id, dedupe_key, status, content_hash')
    .eq('trip_id', tripId)
  const existingByKey = new Map<string, ExistingHintRow>((existingRaw ?? []).map((r) => [r.dedupe_key, r as ExistingHintRow]))

  const seenKeys = new Set<string>()
  const nowIso = new Date().toISOString()

  for (const draft of drafts) {
    seenKeys.add(draft.dedupeKey)
    const contentHash = hashInput(draft.contentHashInput)
    const existing = existingByKey.get(draft.dedupeKey)

    if (!existing) {
      await lumiCore.from('travel_trip_hints').insert({
        household_id: familyId, trip_id: tripId,
        booking_id: draft.bookingId, document_id: draft.documentId, journey_event_id: draft.journeyEventId,
        hint_type: draft.hintType, priority: draft.priority, title: draft.title, reasoning: draft.reasoning,
        relevant_at: draft.relevantAt, action_label: draft.actionLabel, action_href: draft.actionHref,
        status: 'active', content_hash: contentHash, dedupe_key: draft.dedupeKey,
      })
      result.created++
      continue
    }

    if (existing.status !== 'active' && existing.content_hash === contentHash) {
      // §Nutzerentscheidung respektieren -- unveränderte Daten reaktivieren einen ausgeblendeten/erledigten Hinweis nicht.
      result.unchanged++
      continue
    }

    const wasReactivated = existing.status !== 'active'
    await lumiCore.from('travel_trip_hints').update({
      priority: draft.priority, title: draft.title, reasoning: draft.reasoning,
      relevant_at: draft.relevantAt, action_label: draft.actionLabel, action_href: draft.actionHref,
      booking_id: draft.bookingId, document_id: draft.documentId, journey_event_id: draft.journeyEventId,
      status: 'active', content_hash: contentHash, updated_at: nowIso, dismissed_at: null,
    }).eq('id', existing.id)
    if (wasReactivated) result.reactivated++
    else result.updated++
  }

  // §Vormals aktive Hinweise, deren Bedingung nicht mehr erfüllt ist (z. B.
  // Buchung wurde bestätigt), werden gelöscht -- dismissed/completed-Zeilen
  // ohne aktuelle Entsprechung ebenso, sie sind ohnehin nie sichtbar und
  // würden die Tabelle nur unbegrenzt wachsen lassen.
  const staleIds = [...existingByKey.values()].filter((r) => !seenKeys.has(r.dedupe_key)).map((r) => r.id)
  if (staleIds.length > 0) {
    await lumiCore.from('travel_trip_hints').delete().in('id', staleIds)
    result.deleted += staleIds.length
  }
}
