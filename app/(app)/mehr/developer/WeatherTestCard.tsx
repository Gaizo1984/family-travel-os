import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runWeatherTest, type WeatherTestResult } from '@/lib/actions/dev-tests/weather-test'
import { describeWeatherCode } from '@/lib/weather'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function WeatherTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as WeatherTestResult | undefined

  return (
    <DevTestCard
      title="Wetter (Open-Meteo, koordinatenbasiert)"
      description="Ort wird zuerst über Google Geocoding aufgelöst, Open-Meteo bekommt nur noch Koordinaten -- kein eigenes Geocoding mehr."
      lastRun={lastRun}
    >
      <form action={runWeatherTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ort</div>
          <input name="query" defaultValue="Playa Conchal, Costa Rica" style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>Testen</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div>Eingegebener Ort: <strong>{result.query}</strong></div>
          <div>Aufgelöster Ort (Google): <strong>{result.resolvedLocationName}</strong></div>
          <div style={{ color: '#9ca3af' }}>Verwendete Koordinaten: {result.lat.toFixed(5)}, {result.lng.toFixed(5)}</div>
          <div style={{ marginTop: '0.3rem' }}>
            Aktuell: {result.currentTemp}°C, {describeWeatherCode(result.currentCode).label}
          </div>
          <div className="flex gap-3 flex-wrap" style={{ marginTop: '0.5rem' }}>
            {result.daily.map((d) => (
              <div key={d.date} style={{ color: '#9ca3af' }}>
                {d.date.slice(5)}: {d.tempMin}°/{d.tempMax}° {describeWeatherCode(d.code).label}
              </div>
            ))}
          </div>
        </div>
      )}
    </DevTestCard>
  )
}
