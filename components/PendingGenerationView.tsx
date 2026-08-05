'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { loadJob } from '@/lib/ai-generation-jobs'

const POLL_INTERVAL_MS = 2500

/**
 * Gemeinsamer Wartezustand für alle auf `ai_generation_jobs` umgestellten
 * Server Actions (§"KI-Aufrufe hintergrundfest machen"). Pollt den Job per
 * einfachem Intervall (kein SSE/Websocket-Unterbau vorhanden) und navigiert
 * per `router.replace` weiter, sobald das Ergebnis feststeht -- funktioniert
 * unabhängig davon, ob der Nutzer die Seite während des Wartens verlassen
 * und wieder geöffnet hat, weil der Job serverseitig weiterläuft.
 */
export function PendingGenerationView({
  jobId,
  pendingLabel,
  fallbackPath,
}: {
  jobId: string
  pendingLabel: string
  fallbackPath: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const job = await loadJob(jobId)
        if (cancelled || !job) return
        if (job.status === 'completed') {
          router.replace(job.redirectPath ?? fallbackPath)
        } else if (job.status === 'failed') {
          setError(job.errorMessage ?? 'Etwas ist schiefgelaufen. Bitte erneut versuchen.')
        }
      } catch {
        // Netzwerkfehler beim Poll -- nächster Versuch folgt automatisch.
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId, router, fallbackPath])

  if (error) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid rgba(181,98,74,0.3)' }}>
        <p className="mb-4" style={{ color: '#B5624A', fontSize: '0.85rem', lineHeight: 1.6 }}>{error}</p>
        <a href={fallbackPath} style={{ color: 'var(--accent)', fontSize: '0.7rem', letterSpacing: '0.08em', textDecoration: 'none' }}>
          Zurück
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-10 flex flex-col items-center gap-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <Loader2 size={22} strokeWidth={1.8} className="animate-spin" style={{ color: 'var(--accent)' }} />
      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.6 }}>{pendingLabel}</p>
    </div>
  )
}
