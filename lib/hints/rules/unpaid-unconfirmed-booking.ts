import { BOOKING_TYPE_CONFIG, PAYMENT_STATUS_LABELS, BOOKING_STATUS_LABELS } from '@/lib/bookings'
import type { HintContext, HintDraft, HintRule, HintPriority } from '../types'

const CRITICAL_WITHIN_DAYS = 7
const MS_PER_DAY = 86_400_000

export const unpaidUnconfirmedBookingRule: HintRule = {
  type: 'unpaid_unconfirmed_booking',
  evaluate(ctx: HintContext): HintDraft[] {
    const drafts: HintDraft[] = []

    for (const booking of ctx.bookings) {
      if (!booking.start_datetime) continue
      const start = new Date(booking.start_datetime)
      // §Nur künftige/laufende Buchungen -- eine offene Zahlung für eine
      // bereits vergangene Buchung ist kein aktueller Hinweis mehr.
      if (start.getTime() < ctx.now.getTime()) continue

      const isUnpaid = booking.payment_status === 'unpaid' || booking.payment_status === 'partial'
      const isUnconfirmed = booking.status === 'pending'
      if (!isUnpaid && !isUnconfirmed) continue

      const daysUntil = (start.getTime() - ctx.now.getTime()) / MS_PER_DAY
      const priority: HintPriority = daysUntil <= CRITICAL_WITHIN_DAYS ? 'critical' : 'upcoming'

      const config = BOOKING_TYPE_CONFIG[booking.type]
      const label = booking.title || config.label
      const parts: string[] = []
      if (isUnconfirmed) parts.push(`Status: ${BOOKING_STATUS_LABELS[booking.status]}`)
      if (isUnpaid) parts.push(`Zahlung: ${PAYMENT_STATUS_LABELS[booking.payment_status]}`)

      drafts.push({
        hintType: 'unpaid_unconfirmed_booking',
        priority,
        title: `${label}: ${isUnpaid && isUnconfirmed ? 'offen & unbezahlt' : isUnpaid ? 'noch offene Zahlung' : 'noch nicht bestätigt'}`,
        reasoning: `${parts.join(' · ')}.`,
        relevantAt: booking.start_datetime,
        actionLabel: 'Zur Buchung',
        actionHref: `/trips/${ctx.tripSlug}/bookings/${booking.id}`,
        bookingId: booking.id,
        documentId: null,
        journeyEventId: null,
        dedupeKey: `unpaid-unconfirmed:${booking.id}`,
        contentHashInput: `${booking.status}:${booking.payment_status}`,
      })
    }

    return drafts
  },
}
