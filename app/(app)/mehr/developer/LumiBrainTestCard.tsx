import { DevTestCard, buttonStyle } from './DevTestCard'
import { runLumiBrainTest } from '@/lib/actions/dev-tests/lumi-brain-test'
import type { DevTestRun } from '@/lib/dev-test-runs'

type LumiBrainTestResult = { title: string; basisLabel: string; missingInfo: string | null }

export function LumiBrainTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as LumiBrainTestResult | undefined

  return (
    <DevTestCard
      title="Frag LUMI -- Intents & Beispielantwort"
      description="Prüft alle 5 Intent-Zuordnungen (Keyword-Matching, kostenlos) plus einen echten OpenAI-Rauchtest (Allgemein-Scope, 'inspiration')."
      lastRun={lastRun}
    >
      <form action={runLumiBrainTest}>
        <button type="submit" style={buttonStyle}>Testen</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db' }}>
          <div>Antwort-Titel: <strong>{result.title}</strong></div>
          <div style={{ color: '#9ca3af' }}>Basis-Label: {result.basisLabel}</div>
          {result.missingInfo && <div style={{ color: '#9ca3af' }}>Fehlende Angabe: {result.missingInfo}</div>}
        </div>
      )}
    </DevTestCard>
  )
}
