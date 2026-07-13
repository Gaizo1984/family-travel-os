import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runDaytripTest, type DaytripTestResult } from '@/lib/actions/dev-tests/daytrip-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function DaytripTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as DaytripTestResult | undefined

  return (
    <DevTestCard
      title="Tagestrip-Kandidaten mit mehreren Stopps"
      description="Kombiniert Places (Kandidaten-Stopps) und Compute Routes (Rundroute) zu einem Tagestrip-Vorschlag ab/bis Ausgangsort."
      lastRun={lastRun}
    >
      <form action={runDaytripTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ausgangsort (Hotel/Urlaubsort)</div>
          <input name="origin" defaultValue="Playa Conchal, Costa Rica" style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>Testen</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div>Ausgangsort: <strong>{result.formattedAddress}</strong></div>
          <div style={{ marginTop: '0.3rem' }}>Stopps: {result.stops.join(' → ')}</div>
          <div style={{ marginTop: '0.3rem' }}>
            Gesamte Rundroute: <strong>{result.durationMinutes} Min</strong>, <strong>{result.distanceKm} km</strong>
          </div>
        </div>
      )}
    </DevTestCard>
  )
}
