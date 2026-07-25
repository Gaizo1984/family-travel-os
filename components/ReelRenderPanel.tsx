'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Download, AlertCircle } from 'lucide-react'
import type { ReelRenderStatus } from '@/lib/actions/reel-render'

type StartFn = (projectId: string, quality: 'preview_lowres' | 'final') => Promise<{ ok: boolean; renderRowId?: string; error?: string }>
type PollFn = (projectId: string, renderRowId: string) => Promise<{ ok: boolean; render?: ReelRenderStatus; error?: string }>

const STATUS_LABELS: Record<string, string> = {
  queued: 'In Warteschlange', rendering: 'Wird gerendert', completed: 'Fertig', failed: 'Fehlgeschlagen',
}
const QUALITY_LABELS: Record<string, string> = { preview_lowres: 'Vorschau', final: 'Finalversion' }

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '–'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * §Content Studio 3.0, Sprint 5: "Status und Fortschritt per Polling
 * anzeigen" + "Fehlerstatus verständlich anzeigen und manuellen Neuversuch
 * erlauben" (Nutzervorgabe, wörtlich). Kein separater "Retry"-Mechanismus
 * in der Server-Action -- ein Neuversuch ist einfach ein neuer Aufruf von
 * `startRender` mit derselben Qualität, erscheint als neue Zeile in der
 * Liste (vollständige Nachvollziehbarkeit aller Versuche statt
 * In-Place-Überschreiben).
 */
export function ReelRenderPanel({
  projectId, reelDurationSeconds, initialRenders, startRender, pollStatus,
}: {
  projectId: string
  reelDurationSeconds: 15 | 30
  initialRenders: ReelRenderStatus[]
  startRender: StartFn
  pollStatus: PollFn
}) {
  const [renders, setRenders] = useState(initialRenders)
  const [busy, setBusy] = useState<'preview_lowres' | 'final' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasCompletedPreview = renders.some((r) => r.quality === 'preview_lowres' && r.status === 'completed')
  const activeIds = renders.filter((r) => r.status === 'queued' || r.status === 'rendering').map((r) => r.id)

  useEffect(() => {
    if (activeIds.length === 0) return
    const interval = setInterval(async () => {
      for (const id of activeIds) {
        const result = await pollStatus(projectId, id)
        if (result.ok && result.render) {
          const updated = result.render
          setRenders((prev) => prev.map((r) => (r.id === id ? updated : r)))
        }
      }
    }, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds.join(','), projectId])

  async function handleStart(quality: 'preview_lowres' | 'final') {
    setBusy(quality)
    setError(null)
    const result = await startRender(projectId, quality)
    setBusy(null)
    if (!result.ok) {
      setError(result.error ?? 'Render konnte nicht gestartet werden.')
      return
    }
    if (result.renderRowId) {
      setRenders((prev) => [
        {
          id: result.renderRowId!, quality, status: 'queued', progressPercent: 0, errorMessage: null,
          downloadUrl: null, costDisplay: null, outputSizeBytes: null, renderDurationSeconds: null,
          requestedAt: new Date().toISOString(),
        },
        ...prev,
      ])
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button" onClick={() => handleStart('preview_lowres')} disabled={busy !== null}
          style={buttonStyle(true)}
        >
          {busy === 'preview_lowres' ? 'Wird gestartet …' : 'Vorschau rendern'}
        </button>
        <button
          type="button" onClick={() => handleStart('final')} disabled={busy !== null || !hasCompletedPreview}
          style={buttonStyle(hasCompletedPreview)}
          title={hasCompletedPreview ? undefined : 'Bitte zuerst eine Vorschau erfolgreich rendern.'}
        >
          {busy === 'final' ? 'Wird gestartet …' : 'Finalversion rendern'}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-2" style={{ color: '#c0392b', fontSize: '0.75rem' }}>
          <AlertCircle size={14} strokeWidth={1.8} /> {error}
        </p>
      )}

      {!hasCompletedPreview && (
        <p style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
          Die Finalversion wird erst freigeschaltet, sobald eine Vorschau erfolgreich fertig ist.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {renders.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>Noch kein Render gestartet.</p>
        )}
        {renders.map((r) => (
          <div key={r.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--foreground)', fontSize: '0.8rem' }}>{QUALITY_LABELS[r.quality] ?? r.quality}</span>
              <span style={{ color: r.status === 'failed' ? '#c0392b' : 'var(--accent)', fontSize: '0.7rem' }}>
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
            </div>

            {(r.status === 'queued' || r.status === 'rendering') && (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--background)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.progressPercent ?? 0}%`, background: 'var(--accent)', transition: 'width 0.4s' }} />
              </div>
            )}

            {r.status === 'failed' && (
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: '#c0392b', fontSize: '0.72rem' }}>{r.errorMessage ?? 'Unbekannter Fehler.'}</span>
                <button
                  type="button" onClick={() => handleStart(r.quality)} disabled={busy !== null}
                  className="flex items-center gap-1"
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}
                >
                  <RefreshCw size={12} strokeWidth={1.8} /> Erneut versuchen
                </button>
              </div>
            )}

            {r.status === 'completed' && (
              <div className="flex flex-col gap-3">
                {r.downloadUrl && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video controls src={r.downloadUrl} style={{ width: '100%', maxWidth: 220, borderRadius: 10, alignSelf: 'center', aspectRatio: '9/16', background: '#000' }} />
                )}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>
                    {reelDurationSeconds}s · {formatBytes(r.outputSizeBytes)}
                    {r.renderDurationSeconds != null ? ` · ${Math.round(r.renderDurationSeconds)}s Renderzeit` : ''}
                    {r.costDisplay ? ` · ${r.costDisplay}` : ''}
                  </span>
                  {r.downloadUrl && (
                    <a
                      href={r.downloadUrl} download
                      className="flex items-center gap-1.5"
                      style={{ background: 'var(--accent)', color: 'var(--surface)', borderRadius: '999px', padding: '6px 14px', fontSize: '0.7rem', textDecoration: 'none' }}
                    >
                      <Download size={12} strokeWidth={1.8} /> Herunterladen
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function buttonStyle(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? 'var(--accent)' : 'var(--border)', color: enabled ? 'var(--surface)' : 'var(--muted)',
    border: 'none', borderRadius: '999px', padding: '12px 22px', fontSize: '0.78rem', cursor: enabled ? 'pointer' : 'default',
  }
}
