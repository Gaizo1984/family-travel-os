import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runHotelQualificationTest, type HotelQualificationTestResult } from '@/lib/actions/dev-tests/hotel-qualification-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function HotelQualificationTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as HotelQualificationTestResult | undefined

  return (
    <DevTestCard
      title="Places – Hotelqualifikation"
      description="Direkter Provider-Aufruf (Geocoding + Lodging-Suche + Qualifikation), unabhängig von Cache/KI-Auswahl."
      lastRun={lastRun}
    >
      <form action={runHotelQualificationTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ort</div>
          <input name="destination" defaultValue="Cancún, Mexiko" style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>Testen</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>{result.candidateCount}</strong> Kandidaten, <strong>{result.qualifiedCount}</strong> qualifiziert
            {result.belowStandardMode && <span style={{ color: '#fbbf24' }}> — Fallback-Modus (unterhalb Mindeststandard)</span>}
          </div>
          <ul className="flex flex-col gap-1.5">
            {result.candidates.map((c, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap" style={{ borderTop: i > 0 ? '1px solid #1f2937' : undefined, paddingTop: i > 0 ? '0.35rem' : undefined }}>
                <span style={{ flex: 1, color: c.qualifies ? '#4ade80' : '#9ca3af' }}>{c.name}</span>
                <span style={{ color: '#6b7280' }}>{c.rating != null ? `★ ${c.rating} (${c.userRatingCount ?? 0})` : 'kein Rating'}</span>
                <span style={{ color: '#6b7280' }}>{c.priceLevel ?? 'kein priceLevel'}</span>
                <span style={{ color: c.qualifies ? '#4ade80' : '#f87171' }}>
                  {c.qualifies ? `qualifiziert (${c.tierBasis === 'brand' ? 'Marke' : 'Heuristik'})` : 'nicht qualifiziert'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DevTestCard>
  )
}
