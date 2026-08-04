'use client'

import { useState } from 'react'
import { AlertCircle, Sparkles } from 'lucide-react'
import type { ImageCheckResultItem, ImageCheckResult } from '@/lib/actions/image-check'

type AdoptAction = (formData: FormData) => void | Promise<void>
type Photo = { id: string; url: string }

const SUB_SCORE_LABELS: Array<{ key: keyof ImageCheckResultItem; label: string }> = [
  { key: 'technicalQuality', label: 'Technik' },
  { key: 'composition', label: 'Komposition' },
  { key: 'lightAndColor', label: 'Licht & Farbe' },
  { key: 'subjectImpact', label: 'Motivwirkung' },
  { key: 'emotionality', label: 'Emotionalität' },
  { key: 'socialMediaFit', label: 'Social-Media-Eignung' },
]

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg shrink-0" style={{ width: 56, height: 56, background: 'var(--accent-subtle)' }}>
      <span style={{ color: 'var(--accent)', fontSize: '1.1rem', fontWeight: 400, lineHeight: 1 }}>{score.toFixed(1)}</span>
      <span style={{ color: 'var(--muted)', fontSize: '0.52rem', letterSpacing: '0.06em' }}>/ 10</span>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '0.6rem', padding: '3px 9px', letterSpacing: '0.02em' }}
    >
      {children}
    </span>
  )
}

/**
 * §"Bild-Check" (Nutzervorgabe): Analyse ausschließlich auf Klick, Ergebnis
 * lebt nur im Client-State (keine DB-Persistenz, siehe lib/actions/image-check.ts).
 * Muster wie ReelRenderPanel.tsx: Server Actions als typisierte Props,
 * try/catch als zweite Absicherungsebene neben der serverseitigen Kapselung.
 */
export function ImageCheckPanel({
  projectId, photos, runAnalysis, adoptToSession, adoptToReel, markForVacationPost, hasTrip, alreadyMarkedPhotoIds,
}: {
  projectId: string
  photos: Photo[]
  runAnalysis: (projectId: string) => Promise<ImageCheckResult>
  adoptToSession: AdoptAction
  adoptToReel: AdoptAction
  /** §"Vormerkung muss immer einer konkreten Reise zugeordnet sein" (Nutzervorgabe): Button entfällt ganz, wenn das Bild-Check-Projekt keine trip_id hat. */
  markForVacationPost?: AdoptAction
  hasTrip?: boolean
  alreadyMarkedPhotoIds?: Set<string>
}) {
  const [results, setResults] = useState<ImageCheckResultItem[] | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urlByPhotoId = new Map(photos.map((p) => [p.id, p.url]))
  const showRanking = photos.length > 1

  async function handleAnalyze() {
    setAnalyzing(true)
    setError(null)
    try {
      const result = await runAnalysis(projectId)
      if (!result.ok || !result.results) {
        setError(result.error ?? 'Analyse fehlgeschlagen.')
      } else {
        setResults([...result.results].sort((a, b) => a.rank - b.rank))
      }
    } catch {
      setError('Analyse fehlgeschlagen (Verbindungsfehler). Bitte gleich noch einmal versuchen.')
    }
    setAnalyzing(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={analyzing}
        className="flex items-center justify-center gap-2"
        style={{
          background: 'var(--foreground)', color: 'var(--surface)', border: 'none', borderRadius: '6px',
          padding: '12px 20px', fontSize: '0.65rem', letterSpacing: '0.16em', textTransform: 'uppercase',
          cursor: analyzing ? 'default' : 'pointer', opacity: analyzing ? 0.6 : 1, WebkitAppearance: 'none', appearance: 'none',
        }}
      >
        <Sparkles size={13} strokeWidth={1.6} />
        {analyzing ? 'LUMI bewertet die Fotos …' : results ? 'Erneut analysieren' : 'Analyse starten'}
      </button>

      {error && (
        <p className="flex items-center gap-2" style={{ color: '#c0392b', fontSize: '0.75rem' }}>
          <AlertCircle size={14} strokeWidth={1.8} /> {error}
        </p>
      )}

      {results && (
        <div className="flex flex-col gap-4">
          {results.map((r) => {
            const url = urlByPhotoId.get(r.photoId)
            return (
              <div key={r.photoId} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start gap-4 mb-4">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="rounded-lg object-cover shrink-0" style={{ width: 72, height: 72 }} />
                  )}
                  <ScoreBadge score={r.overallScore} />
                  <div className="flex-1 min-w-0">
                    {showRanking && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge>Rang {r.rank}</Badge>
                        {r.isBestOverall && <Badge>Bestes Gesamtbild</Badge>}
                        {r.isBestForPost && <Badge>Bestes Beitragsbild</Badge>}
                        {r.isBestForStory && <Badge>Bestes Story-Bild</Badge>}
                        {r.isBestReelCover && <Badge>Bestes Reel-Cover</Badge>}
                      </div>
                    )}
                    {showRanking && r.isSimilarOrWeaker && (
                      <p style={{ color: 'var(--muted)', fontSize: '0.68rem', fontStyle: 'italic' }}>
                        Ähnlich zu einem anderen Foto oder schwächer als die übrige Auswahl.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {SUB_SCORE_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between" style={{ fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{label}</span>
                      <span style={{ color: 'var(--foreground)' }}>{(r[key] as number).toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                <p className="mb-3" style={{ color: 'var(--foreground)', fontSize: '0.78rem', lineHeight: 1.5 }}>{r.reasoning}</p>

                {r.improvementTips.length > 0 && (
                  <ul className="mb-4 space-y-1">
                    {r.improvementTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2" style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Übernehmen:</span>
                  <form action={adoptToSession}>
                    <input type="hidden" name="photo_id" value={r.photoId} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="format" value="carousel" />
                    <button type="submit" style={adoptButtonStyle}>→ Beitrag</button>
                  </form>
                  <form action={adoptToSession}>
                    <input type="hidden" name="photo_id" value={r.photoId} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="format" value="story" />
                    <button type="submit" style={adoptButtonStyle}>→ Story</button>
                  </form>
                  <form action={adoptToReel}>
                    <input type="hidden" name="photo_id" value={r.photoId} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <button type="submit" style={adoptButtonStyle}>→ Reel</button>
                  </form>
                  {markForVacationPost && hasTrip && (
                    alreadyMarkedPhotoIds?.has(r.photoId) ? (
                      <span style={{ ...adoptButtonStyle, border: '1px solid rgba(76,122,93,0.4)', color: '#4C7A5D', cursor: 'default' }}>
                        ✓ Für Urlaubsbeitrag vorgemerkt
                      </span>
                    ) : (
                      <form action={markForVacationPost}>
                        <input type="hidden" name="photo_id" value={r.photoId} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="score" value={Math.round(r.socialMediaFit)} />
                        <input type="hidden" name="reasoning" value={r.reasoning} />
                        <input type="hidden" name="is_similar_or_weaker" value={String(r.isSimilarOrWeaker)} />
                        <button type="submit" style={adoptButtonStyle}>★ Für Urlaubsbeitrag vormerken</button>
                      </form>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const adoptButtonStyle: React.CSSProperties = {
  background: 'transparent', color: 'var(--accent)', border: '1px solid rgba(184,154,94,0.4)',
  borderRadius: '20px', padding: '6px 12px', fontSize: '0.66rem', cursor: 'pointer',
  WebkitAppearance: 'none', appearance: 'none',
}
