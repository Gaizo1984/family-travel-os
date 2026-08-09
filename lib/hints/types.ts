import type { BookingType, BookingStatus, PaymentStatus } from '@/lib/supabase/types'
import type { TravelRequirement } from '@/lib/travel-requirements'

export type HintPriority = 'critical' | 'upcoming' | 'recommendation'

export type HintBookingRow = {
  id: string
  type: BookingType
  title: string
  status: BookingStatus
  payment_status: PaymentStatus
  booking_reference: string | null
  start_datetime: string | null
  end_datetime: string | null
  stage_id: string | null
  details: Record<string, string> | null
  participant_household_member_ids: string[] | null
}

export type HintDocumentRow = {
  id: string
  booking_id: string | null
  doc_type: string
}

export type HintJourneyEventRow = {
  id: string
  date: string
  time: string | null
  category: string
  title: string
  status: string
  participant_household_member_ids: string[] | null
}

/**
 * §Einmal pro Reise geladen (gleiches Muster wie RequirementContext in
 * lib/travel-requirements.ts) -- jede Regel bekommt denselben Kontext, statt
 * eigene Datenbank-Abfragen zu duplizieren.
 */
export type HintContext = {
  tripId: string
  tripSlug: string
  familyId: string
  now: Date
  bookings: HintBookingRow[]
  documents: HintDocumentRow[]
  journeyEvents: HintJourneyEventRow[]
  travelRequirements: TravelRequirement[]
}

/**
 * §"LUMI darf keine Buchungen, Fristen oder Wetterinformationen erfinden"
 * (Nutzervorgabe, wörtlich): `contentHashInput` enthält bewusst NUR die
 * Felder, die für DIESEN Hinweistyp inhaltlich entscheidend sind (z. B. bei
 * Check-in: Buchungs-ID + Abflugzeit) -- niemals die ganze Buchungszeile,
 * sonst würde jede unabhängige Bearbeitung (z. B. eine Notiz) bereits
 * ausgeblendete Hinweise fälschlich reaktivieren (siehe Migration
 * 20260802000001_trip_hints.sql).
 */
export type HintDraft = {
  hintType: string
  priority: HintPriority
  title: string
  reasoning: string
  relevantAt: string | null
  actionLabel: string
  actionHref: string
  bookingId: string | null
  documentId: string | null
  journeyEventId: string | null
  dedupeKey: string
  contentHashInput: string
}

export type HintRule = {
  type: string
  evaluate(ctx: HintContext): HintDraft[]
}
