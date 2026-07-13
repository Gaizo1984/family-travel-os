'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation } from '@/lib/providers/places-provider'
import { ProviderConfigError, ProviderRequestError, describeProviderError } from '@/lib/providers/provider-errors'
import { recordTestRun } from '@/lib/dev-test-runs'

export type GeocodingTestResult = { query: string; lat: number; lng: number; formattedAddress: string }

export async function runGeocodingTest(formData: FormData) {
  const query = String(formData.get('query') ?? '').trim()
  if (!query) redirect('/mehr/developer')

  let geo: Awaited<ReturnType<typeof geocodeLocation>>
  try {
    geo = await geocodeLocation(query)
  } catch (e) {
    if (!(e instanceof ProviderConfigError || e instanceof ProviderRequestError)) throw e
    await recordTestRun('geocoding', { success: false, errorMessage: describeProviderError(e) })
    redirect('/mehr/developer')
  }
  if (!geo) {
    await recordTestRun('geocoding', { success: false, errorMessage: `Ort "${query}" konnte nicht geokodiert werden.` })
    redirect('/mehr/developer')
  }

  const result: GeocodingTestResult = { query, lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress }
  await recordTestRun('geocoding', { success: true, summary: `"${query}" → ${geo.formattedAddress}`, result })
  redirect('/mehr/developer')
}
