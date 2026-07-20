'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OfflineDocumentViewer } from './OfflineDocumentViewer'

export type BoardingPassCarouselItem = {
  id: string
  url: string | null
  isPdf: boolean
  fileName: string
  altText: string
  /** Personenname + ggf. Flugabschnitt, z. B. "Marcel · Hinflug 1/2 · FRA → IST" -- dient sowohl der Kopfzeile als auch dem Offline-Dokumente-Tab-Titel. */
  label: string
}

/**
 * §Live-Test-Feedback "Swipe statt Scrollen bei mehreren Boardingpässen":
 * ersetzt den bisherigen vertikalen Scroll-Stapel (ein `min-height:100vh`-
 * Abschnitt je Pass in normalem Dokumentfluss) durch echte Seiten-Navigation
 * -- ein Pass gleichzeitig, wechselbar per Touch-Swipe (Muster aus
 * WorldMapCarousel.tsx), Pfeil-Buttons und Tastatur-Pfeilen (Muster aus
 * PhotoLightbox.tsx). Datenladen bleibt server-seitig in der aufrufenden
 * Seite -- diese Komponente bekommt nur die fertig aufbereitete Liste.
 * Bewusst kein Wraparound (anders als PhotoLightbox) -- am Anfang/Ende
 * einfach deaktivierte Pfeile, kein Rundlauf nötig für einen linearen Stapel.
 */
export function BoardingPassCarousel({
  passes, referenceDateIso, tripId,
}: {
  passes: BoardingPassCarouselItem[]
  referenceDateIso: string
  tripId: string
}) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(passes.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [passes.length])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    const threshold = 40
    if (deltaX > threshold) setIndex((i) => Math.max(0, i - 1))
    else if (deltaX < -threshold) setIndex((i) => Math.min(passes.length - 1, i + 1))
  }

  const current = passes[Math.min(index, passes.length - 1)]
  if (!current) return null

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        touchAction: 'pan-y', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 24px',
      }}
    >
      <div
        style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '16px', textTransform: 'uppercase' }}
      >
        {index + 1} von {passes.length} · {current.label}
      </div>

      <OfflineDocumentViewer
        documentId={current.id}
        sourceUrl={current.url}
        fileName={current.fileName}
        mimeType={current.isPdf ? 'application/pdf' : 'image/jpeg'}
        isPdf={current.isPdf}
        referenceDateIso={referenceDateIso}
        altText={current.altText}
        tripId={tripId}
        docType="boarding_pass"
        label={current.label}
      />

      {passes.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Vorheriger Boardingpass"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            style={{
              position: 'fixed', left: 'max(8px, env(safe-area-inset-left))', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} style={{ color: '#fff' }} />
          </button>
          <button
            type="button"
            aria-label="Nächster Boardingpass"
            disabled={index === passes.length - 1}
            onClick={() => setIndex((i) => Math.min(passes.length - 1, i + 1))}
            style={{
              position: 'fixed', right: 'max(8px, env(safe-area-inset-right))', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: index === passes.length - 1 ? 'default' : 'pointer', opacity: index === passes.length - 1 ? 0.3 : 1,
            }}
          >
            <ChevronRight size={20} strokeWidth={1.8} style={{ color: '#fff' }} />
          </button>
        </>
      )}
    </div>
  )
}
