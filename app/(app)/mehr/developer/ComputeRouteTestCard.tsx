import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runComputeRouteTest, type ComputeRouteTestResult } from '@/lib/actions/dev-tests/routes-compute-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function ComputeRouteTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as ComputeRouteTestResult | undefined

  return (
    <DevTestCard
      title="Routes API – Compute Routes"
      description="Eine konkrete Route mit optionalen Wegpunkten (Routes API New, nicht Directions Legacy)."
      lastRun={lastRun}
    >
      <form action={runComputeRouteTest} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Start</div>
            <input name="origin" defaultValue="Westin Reserva Conchal, Costa Rica" style={inputStyle} />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ziel</div>
            <input name="destination" defaultValue="Playa Conchal, Costa Rica" style={inputStyle} />
          </label>
        </div>
        <label>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Zwischenstopps (optional, ein Ort pro Zeile)</div>
          <textarea name="waypoints" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <button type="submit" style={{ ...buttonStyle, alignSelf: 'flex-start' }}>Testen</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
            Ausgangspunkt: {result.originSource === 'hotel' ? 'Hotel' : 'Urlaubsort'} · {result.isRoundTrip ? 'Rundroute' : 'Einfache Route'}
          </div>
          <div>
            {result.origin} → {result.destination}
            {result.waypoints.length > 0 && ` (über ${result.waypoints.join(', ')})`}
          </div>
          <div style={{ marginTop: '0.3rem' }}>
            Gesamt: <strong>{result.durationMinutes} Min</strong>, <strong>{result.distanceKm} km</strong>
          </div>
          {result.legs.length > 1 && (
            <ul style={{ marginTop: '0.4rem', color: '#9ca3af' }}>
              {result.legs.map((leg, i) => (
                <li key={i}>Etappe {i + 1}: {leg.durationMinutes} Min, {leg.distanceKm} km</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DevTestCard>
  )
}
