import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runGeocodingTest, type GeocodingTestResult } from '@/lib/actions/dev-tests/geocoding-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function GeocodingTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as GeocodingTestResult | undefined

  return (
    <DevTestCard title="Geocoding API" description="Ortsname → Koordinaten + formatierter Ort." lastRun={lastRun}>
      <form action={runGeocodingTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ortsname</div>
          <input name="query" defaultValue="Playa Conchal, Costa Rica" style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>Testen</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div>Formatierter Ort: <strong>{result.formattedAddress}</strong></div>
          <div>Koordinaten: {result.lat.toFixed(5)}, {result.lng.toFixed(5)}</div>
        </div>
      )}
    </DevTestCard>
  )
}
