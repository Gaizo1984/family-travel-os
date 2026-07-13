import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runComputeRouteMatrixTest, type ComputeRouteMatrixTestResult } from '@/lib/actions/dev-tests/routes-matrix-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function ComputeRouteMatrixTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as ComputeRouteMatrixTestResult | undefined

  return (
    <DevTestCard
      title="Routes API – Compute Route Matrix"
      description="Fahrzeiten/Entfernungen zwischen Hotel/Urlaubsort und mehreren Zielen (maßgebliche Distanzquelle)."
      lastRun={lastRun}
    >
      <form action={runComputeRouteMatrixTest} className="flex flex-col gap-2">
        <label>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ursprung (Hotel/Urlaubsort)</div>
          <input name="origin" defaultValue="Westin Reserva Conchal, Costa Rica" style={inputStyle} />
        </label>
        <label>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ziele (ein Ort pro Zeile)</div>
          <textarea
            name="destinations"
            rows={3}
            defaultValue={'Playa Conchal, Costa Rica\nTamarindo, Costa Rica\nRincón de la Vieja, Costa Rica'}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>
        <button type="submit" style={{ ...buttonStyle, alignSelf: 'flex-start' }}>Testen</button>
      </form>

      {result && (
        <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginTop: '0.85rem' }}>
          Ausgangspunkt ({result.originSource === 'hotel' ? 'Hotel' : 'Urlaubsort'}): {result.origin}
        </div>
      )}
      {result && (
        <table style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#d1d5db', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
              <th style={{ padding: '0.2rem 0.4rem 0.2rem 0' }}>Ziel</th>
              <th style={{ padding: '0.2rem 0.4rem' }}>Fahrzeit</th>
              <th style={{ padding: '0.2rem 0.4rem' }}>Entfernung</th>
            </tr>
          </thead>
          <tbody>
            {result.destinations.map((d) => (
              <tr key={d.name} style={{ borderTop: '1px solid #1f2937' }}>
                <td style={{ padding: '0.3rem 0.4rem 0.3rem 0' }}>{d.name}</td>
                <td style={{ padding: '0.3rem 0.4rem' }}>{d.reachable && d.durationMinutes != null ? `${d.durationMinutes} Min` : '—'}</td>
                <td style={{ padding: '0.3rem 0.4rem' }}>{d.reachable && d.distanceKm != null ? `${d.distanceKm} km` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DevTestCard>
  )
}
