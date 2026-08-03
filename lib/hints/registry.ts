import type { SupabaseClient } from '@supabase/supabase-js'
import { buildHintContext } from './context'
import type { HintDraft, HintRule } from './types'
import { missingReferenceOrDocumentRule } from './rules/missing-reference-or-document'
import { unpaidUnconfirmedBookingRule } from './rules/unpaid-unconfirmed-booking'
import { documentExpiringRule } from './rules/document-expiring'
import { checkinOpensSoonRule } from './rules/checkin-opens-soon'
import { tightLayoverRule } from './rules/tight-layover'
import { bookingOverlapRule } from './rules/booking-overlap'
import { rentalCarVsFlightRule } from './rules/rental-car-vs-flight'

/**
 * §Registry-Pattern wie REGISTERED_RULES in lib/travel-requirements.ts --
 * eine neue Hinweisregel ist ein neues Modul unter rules/ plus ein Eintrag
 * hier, ohne generateHintsForTrip/den Cron anzufassen.
 */
const REGISTERED_HINT_RULES: HintRule[] = [
  missingReferenceOrDocumentRule,
  unpaidUnconfirmedBookingRule,
  documentExpiringRule,
  checkinOpensSoonRule,
  tightLayoverRule,
  bookingOverlapRule,
  rentalCarVsFlightRule,
]

export async function generateHintsForTrip(supabase: SupabaseClient, tripId: string, familyId: string, tripSlug: string): Promise<HintDraft[]> {
  const ctx = await buildHintContext(supabase, tripId, familyId, tripSlug)
  return REGISTERED_HINT_RULES.flatMap((rule) => rule.evaluate(ctx))
}
