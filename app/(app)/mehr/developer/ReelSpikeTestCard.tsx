import { DevTestCard, buttonStyle } from './DevTestCard'
import { runReelSpikeTest, type ReelSpikeTestResult } from '@/lib/actions/dev-tests/reel-spike-test'
import { getCachedSignedUrl } from '@/lib/signed-storage-url'
import type { DevTestRun } from '@/lib/dev-test-runs'

/**
 * §Content Studio 3.0, Sprint 0b -- Infrastruktur-Spike. Zeigt das Ergebnis
 * NIE über eine dauerhaft gespeicherte URL an (die würde ein Zugriffs-Token
 * enthalten) -- stattdessen wird bei jedem Seitenaufruf über den
 * gemeinsamen Signed-URL-Cache (lib/signed-storage-url.ts) frisch signiert,
 * genau wie an jeder anderen Stelle der App, die Storage-Inhalte anzeigt.
 */
export async function ReelSpikeTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as ReelSpikeTestResult | undefined
  const signedUrl = result?.storagePath
    ? await getCachedSignedUrl('content-reels-spike', result.storagePath)
    : null

  return (
    <DevTestCard
      title="Content Studio 3.0 -- Remotion + Vercel Sandbox (Spike)"
      description="Isolierter Infrastruktur-Test: bundelt eine minimale 9:16/15s-Komposition (zwei synthetische Testbilder, kein echtes Familienfoto), rendert sie in einer Vercel Sandbox und überträgt das Ergebnis in privaten Supabase Storage."
      lastRun={lastRun}
    >
      <form action={runReelSpikeTest}>
        <button type="submit" style={buttonStyle}>Testrender starten</button>
      </form>

      {result && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#d1d5db', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div>Gesamtdauer: <strong>{(result.totalMs / 1000).toFixed(1)}s</strong></div>
          <div style={{ color: '#9ca3af' }}>
            davon Sandbox-Setup {(result.sandboxSetupMs / 1000).toFixed(1)}s · Bundle-Übertragung {(result.addBundleMs / 1000).toFixed(1)}s ·
            {' '}Rendering {(result.renderMs / 1000).toFixed(1)}s · Datei-Rückgabe {(result.readFileMs / 1000).toFixed(1)}s · Upload {(result.uploadMs / 1000).toFixed(1)}s
          </div>
          <div style={{ color: '#9ca3af' }}>
            Aktive CPU-Zeit: {result.activeCpuUsageMs !== null ? `${(result.activeCpuUsageMs / 1000).toFixed(1)}s` : 'nicht verfügbar'}
            {' '}· vCPUs: {result.vcpus ?? '–'} · Speicher: {result.memoryMb !== null ? `${result.memoryMb} MB` : '–'} · Region: {result.region ?? '–'}
            {' '}· Persistent: {result.persistent === null ? '–' : result.persistent ? 'ja' : 'nein'}
          </div>
          <div style={{ color: '#9ca3af' }}>
            Dateigröße: {(result.fileSizeBytes / 1024).toFixed(0)} KB · Typ: {result.contentType}
          </div>
          {signedUrl && (
            <video controls src={signedUrl} style={{ marginTop: '0.5rem', maxWidth: '220px', borderRadius: '8px', border: '1px solid #1f2937' }} />
          )}
        </div>
      )}
    </DevTestCard>
  )
}
