import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

type BookingRow = LumiCoreDatabase['public']['Tables']['travel_bookings']['Row']
type BookingInsert = LumiCoreDatabase['public']['Tables']['travel_bookings']['Insert']

export async function listBookingsForTrip(tripId: string): Promise<BookingRow[]> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_bookings').select('*').eq('trip_id', tripId).order('start_datetime')
  if (error) throw new Error(`listBookingsForTrip: ${error.message}`)
  return data
}

export async function getBookingById(bookingId: string): Promise<BookingRow | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_bookings').select('*').eq('id', bookingId).maybeSingle()
  if (error) throw new Error(`getBookingById: ${error.message}`)
  return data
}

export async function createBooking(input: BookingInsert): Promise<BookingRow> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_bookings').insert(input).select('*').single()
  if (error || !data) throw new Error(`createBooking: ${error?.message ?? 'kein Ergebnis'}`)
  return data
}

export async function updateBooking(bookingId: string, patch: Partial<BookingInsert>): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_bookings').update(patch).eq('id', bookingId)
  if (error) throw new Error(`updateBooking: ${error.message}`)
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_bookings').delete().eq('id', bookingId)
  if (error) throw new Error(`deleteBooking: ${error.message}`)
}
