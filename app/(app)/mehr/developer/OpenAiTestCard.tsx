import { DevTestCard, buttonStyle } from './DevTestCard'
import { runOpenAiRecommendationTest, type OpenAiRecommendationTestResult } from '@/lib/actions/dev-tests/openai-recommendation-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

export function OpenAiTestCard({ lastRun, placesAvailable }: { lastRun: DevTestRun | null; placesAvailable: boolean }) {
  const result = lastRun?.result as unknown as OpenAiRecommendationTestResult | undefined

  return (
    <DevTestCard
      title="OpenAI-Empfehlungen"
      description="Übergibt die zuletzt getesteten Places-Ergebnisse an OpenAI, erzeugt 5 familienpassende Empfehlungen. Nur auf Klick."
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
        <ul style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {result.recommendations.map((r, i) => (
            <li key={i} style={{ fontSize: '0.72rem', color: '#d1d5db' }}>
              <strong>{r.title}</strong> — <span style={{ color: '#9ca3af' }}>{r.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </DevTestCard>
  )
}
