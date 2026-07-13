import { DevTestCard, buttonStyle } from './DevTestCard'
import { runOpenAiRecommendationTest, type OpenAiRecommendationTestResult } from '@/lib/actions/dev-tests/openai-recommendation-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function OpenAiTestCard({ lastRun, placesAvailable }: { lastRun: DevTestRun | null; placesAvailable: boolean }) {
  const result = lastRun?.result as unknown as OpenAiRecommendationTestResult | undefined

  return (
    <DevTestCard
      title="OpenAI-Empfehlungen"
      description="Wählt aus den zuletzt getesteten Places-Ergebnissen 5 familienpassende Empfehlungen -- Fakten (Fahrzeit, Bewertung, Öffnungsstatus) stammen ausschließlich aus den Places-/Routes-Daten, nie von der KI erfunden. Nur auf Klick."
      lastRun={lastRun}
    >
      {placesAvailable ? (
        <form action={runOpenAiRecommendationTest}>
          <button type="submit" style={buttonStyle}>5 Empfehlungen generieren</button>
        </form>
      ) : (
        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
          Bitte zuerst den Places-Test oben erfolgreich ausführen — die Empfehlungen bauen auf dessen Ergebnissen auf.
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {result.recommendations.map((r, i) => (
            <div key={i} style={{ fontSize: '0.72rem', color: '#d1d5db', borderTop: i > 0 ? '1px solid #1f2937' : undefined, paddingTop: i > 0 ? '0.6rem' : undefined }}>
              <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: '0.15rem' }}>{r.name} <span style={{ color: '#6b7280', fontWeight: 400 }}>· {r.category}</span></div>
              <div style={{ color: '#9ca3af', marginBottom: '0.3rem' }}>{r.why}</div>
              <div className="flex flex-wrap gap-2" style={{ color: '#6b7280', marginBottom: '0.3rem' }}>
                {r.travelTimeMinutes != null && <span>{r.travelTimeMinutes} Min · {r.distanceKm} km</span>}
                {r.rating != null && <span style={{ color: '#fbbf24' }}>★ {r.rating} ({r.reviewCount ?? 0})</span>}
                {r.openNow != null && <span style={{ color: r.openNow ? '#4ade80' : '#f87171' }}>{r.openNow ? 'geöffnet' : 'Jetzt geschlossen'}</span>}
                <span style={{ color: '#a5b4fc' }}>{r.tripLength}</span>
              </div>
              <div style={{ color: '#9ca3af' }}>Kinder-Eignung: {r.kinderEignung}</div>
              <div style={{ color: '#9ca3af' }}>Wetter-Eignung: {r.wetterEignung}</div>
              {r.besondereHinweise && <div style={{ color: '#f0abfc', marginTop: '0.15rem' }}>Hinweis: {r.besondereHinweise}</div>}
            </div>
          ))}
        </div>
      )}
    </DevTestCard>
  )
}
