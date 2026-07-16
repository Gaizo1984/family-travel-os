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
          {result.balancedPickNames.length > 0 && (
            <div style={{ marginBottom: '0.75rem', color: '#4ade80' }}>
              Ausgewogene Shortlist-Auswahl (bis zu 2 Iconic + 3 Ultra Luxury + 3 Premium Luxury + 3 Gehobene 5 Sterne): {result.balancedPickNames.join(', ')}
            </div>
          )}
          <ul className="flex flex-col gap-1.5">
            {result.candidates.map((c, i) => (
              <li key={i} className="flex flex-col gap-0.5" style={{ borderTop: i > 0 ? '1px solid #1f2937' : undefined, paddingTop: i > 0 ? '0.35rem' : undefined }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ flex: 1, color: c.qualifies ? '#4ade80' : '#9ca3af' }}>{c.name}{c.isIconic ? ' ✦' : ''}</span>
                  <span style={{ color: '#6b7280' }}>{c.rating != null ? `★ ${c.rating} (${c.userRatingCount ?? 0})` : 'kein Rating'}</span>
                  <span style={{ color: '#6b7280' }}>{c.priceLevel ?? 'kein priceLevel'}</span>
                  <span style={{ color: c.qualifies ? '#4ade80' : '#f87171' }}>
                    {!c.hasLodgingType ? 'kein lodging-Typ' : c.qualifies ? `${c.tier} (${c.tierBasis === 'brand' ? 'Marke' : 'Heuristik'})` : 'nicht qualifiziert'}
                  </span>
                </div>
                {!c.hasLodgingType && (
                  <div style={{ color: '#f87171', fontSize: '0.65rem' }}>
                    Von der Produktivsuche ausgeschlossen -- Google-Typen: {c.types.join(', ') || '(keine)'}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DevTestCard>
  )
}
