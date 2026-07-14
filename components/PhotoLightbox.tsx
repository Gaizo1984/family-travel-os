'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export type LightboxPhoto = { url: string; alt: string }

/**
 * Macht ein Foto-Tile per Klick zum Großbild aufklappbar (Lightbox) — statt
 * dauerhaft kleine Vorschaubilder als einzige Ansicht zu haben. Umschließt
 * den bestehenden Tile-Inhalt (Bild + evtl. Overlay-Buttons), ohne dessen
 * Markup zu verändern; öffnet ein Vollbild-Overlay mit der großen Version
 * desselben Fotos.
 *
 * §"Vor-/Zurück-Navigation zwischen Bildern" (Reise-Galerie): optionale
 * `photos`/`index`-Props schalten eine Pfeil-Navigation (Klick + Pfeiltasten)
 * frei, die innerhalb der übergebenen Foto-Liste blättert -- ohne `photos`
 * bleibt das Verhalten unverändert ein einzelnes Großbild (bestehende
 * Aufrufer wie Profilseite/Jahresrückblick funktionieren unverändert weiter).
 */
export function PhotoLightbox({
  url,
  alt,
  children,
  photos,
  index,
}: {
  url: string
  alt: string
  children: React.ReactNode
  photos?: LightboxPhoto[]
  index?: number
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(index ?? 0)

  const hasNavigation = Boolean(photos && photos.length > 1)
  const current = hasNavigation ? photos![activeIndex] : { url, alt }

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
      if (!hasNavigation) return
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i - 1 + photos!.length) % photos!.length)
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i + 1) % photos!.length)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasNavigation])

  function handleOpen() {
    setActiveIndex(index ?? 0)
    setOpen(true)
  }

  return (
    <>
      <div
        onClick={handleOpen}
        style={{ position: 'absolute', inset: 0, cursor: 'zoom-in', zIndex: 1 }}
        aria-hidden="true"
      />
      {children}
      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(10,9,7,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'clamp(16px, 5vw, 48px)', cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', top: 'max(16px, env(safe-area-inset-top))', right: '16px',
              background: 'rgba(240,235,227,0.12)', border: 'none', borderRadius: '50%',
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              zIndex: 1,
            }}
          >
            <X size={18} strokeWidth={1.8} style={{ color: '#F0EBE3' }} />
          </button>

          {hasNavigation && (
            <>
              <button
                type="button"
                aria-label="Vorheriges Bild"
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + photos!.length) % photos!.length) }}
                style={{
                  position: 'fixed', left: 'max(8px, env(safe-area-inset-left))', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(240,235,227,0.12)', border: 'none', borderRadius: '50%',
                  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <ChevronLeft size={20} strokeWidth={1.8} style={{ color: '#F0EBE3' }} />
              </button>
              <button
                type="button"
                aria-label="Nächstes Bild"
                onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % photos!.length) }}
                style={{
                  position: 'fixed', right: 'max(8px, env(safe-area-inset-right))', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(240,235,227,0.12)', border: 'none', borderRadius: '50%',
                  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <ChevronRight size={20} strokeWidth={1.8} style={{ color: '#F0EBE3' }} />
              </button>
              <span
                style={{
                  position: 'fixed', bottom: 'max(16px, env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
                  color: 'rgba(240,235,227,0.7)', fontSize: '0.7rem', letterSpacing: '0.04em',
                }}
              >
                {activeIndex + 1} / {photos!.length}
              </span>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'default' }}
          />
        </div>
      )}
    </>
  )
}
