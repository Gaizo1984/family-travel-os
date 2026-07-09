'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BOOKING_TYPE_CONFIG, combineDateTime } from '@/lib/bookings'
import type { BookingType, BookingStatus, PaymentStatus } from '@/lib/supabase/types'

function readCommonFields(formData: FormData) {
  const type = String(formData.get('type') ?? '') as BookingType
  const config = BOOKING_TYPE_CONFIG[type]

  const title             = String(formData.get('title') ?? '').trim()
  const provider          = String(formData.get('provider') ?? '').trim()
  const stageId            = String(formData.get('stage_id') ?? '').trim()
  const bookingReference  = String(formData.get('booking_reference') ?? '').trim()
  const status            = String(formData.get('status') ?? 'pending') as BookingStatus
  const paymentStatus     = String(formData.get('payment_status') ?? 'unpaid') as PaymentStatus
  const amountRaw         = String(formData.get('amount') ?? '').trim()
  const currency          = String(formData.get('currency') ?? '').trim() || 'EUR'
  const notes             = String(formData.get('notes') ?? '').trim()

  const startDate = String(formData.get('start_date') ?? '').trim()
  const startTime = String(formData.get('start_time') ?? '').trim()
  const endDate   = String(formData.get('end_date') ?? '').trim()
  const endTime   = String(formData.get('end_time') ?? '').trim()

  const details: Record<string, string> = {}
  for (const field of config?.detailFields ?? []) {
    const value = String(formData.get(field.key) ?? '').trim()
    if (value) details[field.key] = value
  }

  return {
    type, config, title, provider, stageId, bookingReference, status, paymentStatus,
    amountRaw, currency, notes, startDate, startTime, endDate, endTime, details,
  }
}

export async function createBooking(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug   = String(formData.get('slug') ?? '')
  const f = readCommonFields(formData)

  const newPath = `/trips/${slug}/bookings/new?type=${f.type}`

  if (!f.config)
    redirect(`/trips/${slug}?error=${encodeURIComponent('Ungültiger Buchungstyp')}`)
  if (f.title.length < 2)
    redirect(`${newPath}&error=${encodeURIComponent(`${f.config.titleLabel}: mindestens 2 Zeichen erforderlich`)}`)
  if (!f.startDate)
    redirect(`${newPath}&error=${encodeURIComponent(`${f.config.startLabel}: Datum ist erforderlich`)}`)

  const supabase = await createClient()

  const { error } = await supabase.from('bookings').insert({
    trip_id: tripId,
    stage_id: f.stageId || null,
    type: f.type,
    title: f.title,
    provider: f.provider || null,
    booking_reference: f.bookingReference || null,
    status: f.status,
    payment_status: f.paymentStatus,
    amount: f.amountRaw ? Number(f.amountRaw) : null,
    currency: f.currency,
    start_datetime: combineDateTime(f.startDate, f.startTime),
    end_datetime: f.config.showEnd ? combineDateTime(f.endDate, f.endTime) : null,
    details: Object.keys(f.details).length > 0 ? f.details : null,
    notes: f.notes || null,
  })

  if (error)
    redirect(`${newPath}&error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}

export async function updateBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const f = readCommonFields(formData)

  const editPath = `/trips/${slug}/bookings/${bookingId}/edit`

  if (!f.config)
    redirect(`/trips/${slug}?error=${encodeURIComponent('Ungültiger Buchungstyp')}`)
  if (f.title.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent(`${f.config.titleLabel}: mindestens 2 Zeichen erforderlich`)}`)
  if (!f.startDate)
    redirect(`${editPath}?error=${encodeURIComponent(`${f.config.startLabel}: Datum ist erforderlich`)}`)

  const supabase = await createClient()

  const { error } = await supabase
    .from('bookings')
    .update({
      stage_id: f.stageId || null,
      title: f.title,
      provider: f.provider || null,
      booking_reference: f.bookingReference || null,
      status: f.status,
      payment_status: f.paymentStatus,
      amount: f.amountRaw ? Number(f.amountRaw) : null,
      currency: f.currency,
      start_datetime: combineDateTime(f.startDate, f.startTime),
      end_datetime: f.config.showEnd ? combineDateTime(f.endDate, f.endTime) : null,
      details: Object.keys(f.details).length > 0 ? f.details : null,
      notes: f.notes || null,
    })
    .eq('id', bookingId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/trips/${slug}/bookings/${bookingId}`)
}

export async function deleteBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const supabase = await createClient()

  const { error } = await supabase.from('bookings').delete().eq('id', bookingId)

  if (error)
    redirect(`/trips/${slug}/bookings/${bookingId}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}
