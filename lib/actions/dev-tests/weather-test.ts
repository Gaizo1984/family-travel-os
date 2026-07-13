'use server'

import { redirect } from 'next/navigation'
import { geocodeLocation } from '@/lib/providers/places-provider'
import { ProviderConfigError, ProviderRequestError, describeProviderError } from '@/lib/providers/provider-errors'
import { getWeatherForCoordinates } from '@/lib/weather'
import { recordTestRun } from '@/lib/dev-test-runs'

export type WeatherTestResult = {
  query: string; resolvedLocationName: string
  lat: number; lng: number
  currentTemp: number; currentCode: number
  daily: Array<{ date: string; tempMax: number; tempMin: number; code: number }>
}

/**
 * §"Ortsnamen immer zuerst über die bestehende Geocoding-Funktion auflösen,
 * Open-Meteo anschließend ausschließlich mit Koordinaten aufrufen": vorher
 * ließ dieses Modul Open-Meteo den Ortsnamen selbst geokodieren (bekannt
 * unzuverlässig für kleine Orte, z. B. "Playa Conchal") -- jetzt läuft die
 * Geokodierung einmalig über Google (`geocodeLocation`, dieselbe Funktion
 * wie bei allen anderen Developer-Modulen), Open-Meteo bekommt nur noch
 * `lat`/`lon`. Nutzt weiterhin ausschließlich den bestehenden produktiven
 * Wetter-Provider (`getWeatherForCoordinates`), keine zweite Wetterlogik.
 */
export async function runWeatherTest(formData: FormData) {
  const query = String(formData.get('query') ?? '').trim()
  if (!query) redirect('/mehr/developer')

  let geo: Awaited<ReturnType<typeof geocodeLocation>>
  try {
    geo = await geocodeLocation(query)
  } catch (e) {
    if (!(e instanceof ProviderConfigError || e instanceof ProviderRequestError)) throw e
    await recordTestRun('weather', { success: false, errorMessage: describeProviderError(e) })
    redirect('/mehr/developer')
  }
  if (!geo) {
    await recordTestRun('weather', { success: false, errorMessage: `Ort "${query}" konnte nicht geokodiert werden.` })
    redirect('/mehr/developer')
  }

  const weather = await getWeatherForCoordinates(geo.lat, geo.lng, geo.formattedAddress)
  if (!weather) {
    await recordTestRun('weather', { success: false, errorMessage: `Für "${query}" (${geo.lat}, ${geo.lng}) konnten keine Wetterdaten ermittelt werden.` })
    redirect('/mehr/developer')
  }

  const result: WeatherTestResult = {
    query, resolvedLocationName: weather.locationName, lat: geo.lat, lng: geo.lng,
    currentTemp: weather.currentTemp, currentCode: weather.currentCode,
    daily: weather.daily.map((d) => ({ date: d.date, tempMax: d.tempMax, tempMin: d.tempMin, code: d.code })),
  }
  await recordTestRun('weather', { success: true, summary: `"${query}" → ${weather.locationName}, ${weather.currentTemp}°C`, result })
  redirect('/mehr/developer')
}
