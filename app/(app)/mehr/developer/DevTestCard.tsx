import type { CSSProperties, ReactNode } from 'react'
import type { DevTestRun } from '@/lib/dev-test-runs'

export const inputStyle: CSSProperties = {
  width: '100%', background: '#0b0f19', border: '1px solid #1f2937', borderRadius: '6px',
  padding: '0.5rem 0.65rem', color: '#e5e7eb', fontSize: '0.78rem', fontFamily: 'inherit',
}

export const buttonStyle: CSSProperties = {
  background: '#312e81', color: '#e0e7ff', border: '1px solid #4338ca', borderRadius: '6px',
  padding: '0.5rem 1rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
}

function formatRanAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Gemeinsame Karten-Chrome für alle Developer-Testmodule: Titel, Status-Badge
 * (erreichbar/Fehler/noch nicht getestet), "zuletzt erfolgreich am",
 * lesbare Fehlermeldung, auf-/zuklappbares Rohergebnis. Jedes Modul bleibt
 * eine eigene Komponente/Datei -- die Ergebnisformen unterscheiden sich zu
 * stark für einen vollständig generischen Renderer.
 */
export function DevTestCard({
  title,
  description,
  lastRun,
  children,
}: {
  title: string
  description: string
  lastRun: DevTestRun | null
  children: ReactNode
}) {
  const status = !lastRun
    ? { label: 'Noch nicht getestet', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
    : lastRun.success
      ? { label: 'Erreichbar', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
      : { label: 'Fehler', color: '#f87171', bg: 'rgba(248,113,113,0.12)' }

  return (
    <section
      style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '10px',
        padding: '1.25rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 style={{ color: '#e5e7eb', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.01em' }}>{title}</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.15rem' }}>{description}</p>
        </div>
        <span
          style={{
            color: status.color, background: status.bg, borderRadius: '999px',
            padding: '0.2rem 0.65rem', fontSize: '0.68rem', letterSpacing: '0.04em', flexShrink: 0,
          }}
        >
          {status.label}
        </span>
      </div>

      {lastRun && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#6b7280' }}>
          {lastRun.success
            ? `Zuletzt erfolgreich am ${formatRanAt(lastRun.ranAt)}`
            : `Letzter Versuch am ${formatRanAt(lastRun.ranAt)}: ${lastRun.errorMessage ?? 'Unbekannter Fehler'}`}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>{children}</div>

      {lastRun?.result != null && (
        <details style={{ marginTop: '0.85rem' }}>
          <summary style={{ color: '#9ca3af', fontSize: '0.7rem', cursor: 'pointer' }}>Rohergebnis anzeigen</summary>
          <pre
            style={{
              marginTop: '0.5rem', background: '#0b0f19', color: '#a5b4fc', fontSize: '0.68rem',
              padding: '0.75rem', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(lastRun.result, null, 2)}
          </pre>
        </details>
      )}
    </section>
  )
}
