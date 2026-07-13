'use server'

import { redirect } from 'next/navigation'
import { getWeatherForLocation } from '@/lib/weather'
import { recordTestRun } from '@/lib/dev-test-runs'

export type WeatherTestResult = {
  query: string; resolvedLocationName: string
  currentTemp: number; currentCode: number
  daily: Array<{ date: string; tempMax: number; tempMin: number; code: number }>
}

export async function runWeatherTest(formData: FormData) {
  const query = String(formData.get('query') ?? '').trim()
  if (!query) redirect('/mehr/developer')

  const weather = await getWeatherForLocation([{ query }])
  if (!weather) {
    await recordTestRun('weather', { success: false, errorMessage: `Für "${query}" konnten keine Wetterdaten ermittelt werden.` })
    redirect('/mehr/developer')
  }

  const result: WeatherTestResult = {
    query, resolvedLocationName: weather.locationName,
    currentTemp: weather.currentTemp, currentCode: weather.currentCode,
    daily: weather.daily.map((d) => ({ date: d.date, tempMax: d.tempMax, tempMin: d.tempMin, code: d.code })),
  }
  await recordTestRun('weather', { success: true, summary: `"${query}" → ${weather.locationName}, ${weather.currentTemp}°C`, result })
  redirect('/mehr/developer')
}
