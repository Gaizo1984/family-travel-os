import { DevTestCard, inputStyle } from './DevTestCard'
import { runFlightSearchTest, type FlightSearchTestResult } from '@/lib/actions/dev-tests/flight-search-test'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function FlightSearchTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as FlightSearchTestResult | undefined

  return (
    <DevTestCard
      title="Duffel – Flugsuche"
      description="Direkter Provider-Aufruf (Airport-Auflösung + Angebotssuche), unabhängig von Cache/monatlichem Limit."
      lastRun={lastRun}
    >
      <form action={runFlightSearchTest} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Abflugort</div>
            <input name="origin" defaultValue="Frankfurt" style={inputStyle} />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Zielort</div>
            <input name="destination" defaultValue="London" style={inputStyle} />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Hinflugdatum (leer = in 30 Tagen)</div>
            <input name="departure_date" placeholder="YYYY-MM-DD" style={inputStyle} />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Rückflugdatum (optional)</div>
            <input name="return_date" placeholder="YYYY-MM-DD" style={inputStyle} />
          </label>
        </div>
        <SubmitButtonWithProgress
          label="Testen"
          pendingLabel="Fragt Duffel an … (kann bis zu 25s dauern)"
          style={{
            alignSelf: 'flex-start', background: '#312e81', color: '#e0e7ff', border: '1px solid #4338ca',
            borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.75rem', fontFamily: 'inherit',
            textTransform: 'none', letterSpacing: 'normal',
          }}
        />
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
            {result.providerName} · {result.isSandbox ? 'Testmodus' : 'Live'}
          </div>
          <div>
            {result.originQuery} ({result.originCode ?? '?'}) → {result.destinationQuery} ({result.destinationCode ?? '?'})
          </div>
          <div style={{ marginTop: '0.3rem' }}>
            {result.departureDate}{result.returnDate ? ` – ${result.returnDate}` : ' (nur Hinflug)'}
          </div>
          <div style={{ marginTop: '0.3rem' }}>
            <strong>{result.offerCount}</strong> Angebote{result.cheapestPrice != null ? `, ab ${result.cheapestPrice} ${result.cheapestCurrency}` : ''}
          </div>
        </div>
      )}
    </DevTestCard>
  )
}
