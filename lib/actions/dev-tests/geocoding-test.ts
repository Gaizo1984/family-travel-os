'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation } from '@/lib/providers/places-provider'
import { recordTestRun } from '@/lib/dev-test-runs'

export type GeocodingTestResult = { query: string; lat: number; lng: number; formattedAddress: string }

export async function runGeocodingTest(formData: FormData) {
  const query = String(formData.get('query') ?? '').trim()
  if (!query) redirect('/mehr/developer')

  const geo = await geocodeLocation(query)
  if (!geo) {
    await recordTestRun('geocoding', { success: false, errorMessage: `Ort "${query}" konnte nicht geokodiert werden.` })
    redirect('/mehr/developer')
  }

  const result: GeocodingTestResult = { query, lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress }
  await recordTestRun('geocoding', { success: true, summary: `"${query}" → ${geo.formattedAddress}`, result })
  redirect('/mehr/developer')
}
