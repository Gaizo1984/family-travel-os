'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Macht ein Foto-Tile per Klick zum Großbild aufklappbar (Lightbox) — statt
 * dauerhaft kleine Vorschaubilder als einzige Ansicht zu haben. Umschließt
 * den bestehenden Tile-Inhalt (Bild + evtl. Overlay-Buttons), ohne dessen
 * Markup zu verändern; öffnet ein Vollbild-Overlay mit der großen Version
 * desselben Fotos.
 */
export function PhotoLightbox({
  url,
  alt,
  children,
}: {
  url: string
  alt: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <>
      <div
        onClick={() => setOpen(true)}
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
            }}
          >
            <X size={18} strokeWidth={1.8} style={{ color: '#F0EBE3' }} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'default' }}
          />
        </div>
      )}
    </>
  )
}
