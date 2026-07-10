'use client'

import { useRef, useState } from 'react'

const FRAME = 220
const OUTPUT = 480

/**
 * Einzige bewusste 'use client'-Komponente der App (Foto-Crop mit Zoom/Pan
 * für Querformat-Vorlagen). Kein npm-Zusatzpaket: Zoom per <input
 * type="range"> + CSS transform, Pan per handgerolltem Pointer-Handler.
 * Auf "Übernehmen" wird der sichtbare Ausschnitt auf ein Offscreen-<canvas>
 * gezeichnet, als Blob/File verpackt und per DataTransfer in das native,
 * versteckte Datei-Feld injiziert — das umgebende Formular sendet danach
 * wie jedes andere Upload-Formular (multipart/form-data), ohne
 * Sonderbehandlung in der Server Action.
 */
export function PhotoCropInput({ name, label, existingPhotoUrl }: {
  name: string; label: string; existingPhotoUrl?: string | null
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [committedUrl, setCommittedUrl] = useState<string | null>(null)
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  function onPickSource(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSourceUrl(URL.createObjectURL(file))
    setNatural(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setCommittedUrl(null)
  }

  function onImageLoad() {
    const img = imgRef.current
    if (!img) return
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    setPan({
      x: dragState.current.panX + (e.clientX - dragState.current.startX),
      y: dragState.current.panY + (e.clientY - dragState.current.startY),
    })
  }
  function onPointerUp() {
    dragState.current = null
  }

  function layout() {
    if (!natural) return null
    const baseScale = FRAME / Math.min(natural.w, natural.h)
    const displayW = natural.w * baseScale * zoom
    const displayH = natural.h * baseScale * zoom
    const left = (FRAME - displayW) / 2 + pan.x
    const top = (FRAME - displayH) / 2 + pan.y
    return { displayW, displayH, left, top }
  }

  function handleApply() {
    const img = imgRef.current
    const l = layout()
    if (!img || !natural || !l) return

    const k = OUTPUT / FRAME
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0, natural.w, natural.h, l.left * k, l.top * k, l.displayW * k, l.displayH * k)

    canvas.toBlob((blob) => {
      if (!blob || !hiddenInputRef.current) return
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' })
      const dt = new DataTransfer()
      dt.items.add(file)
      hiddenInputRef.current.files = dt.files
      setCommittedUrl(URL.createObjectURL(blob))
    }, 'image/jpeg', 0.9)
  }

  const l = layout()

  return (
    <div className="mb-5">
      <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {label}
      </label>

      <input ref={hiddenInputRef} type="file" name={name} style={{ display: 'none' }} />

      <div className="flex items-center gap-5 flex-wrap">
        <div
          className="rounded-full overflow-hidden shrink-0"
          style={{ width: FRAME, height: FRAME, background: 'var(--surface)', border: '1px solid var(--border)', touchAction: 'none' }}
          onPointerDown={sourceUrl ? onPointerDown : undefined}
          onPointerMove={sourceUrl ? onPointerMove : undefined}
          onPointerUp={sourceUrl ? onPointerUp : undefined}
        >
          {sourceUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={sourceUrl}
              alt=""
              onLoad={onImageLoad}
              draggable={false}
              style={l ? {
                position: 'relative', left: l.left, top: l.top,
                width: l.displayW, height: l.displayH, maxWidth: 'none', cursor: 'grab', userSelect: 'none',
              } : { display: 'none' }}
            />
          ) : committedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={committedUrl} alt="" className="w-full h-full object-cover" />
          ) : existingPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existingPhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>

        <div className="flex-1" style={{ minWidth: 180 }}>
          <input
            type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickSource}
            style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
          />
          {sourceUrl && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span style={{ color: 'var(--muted)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>Zoom</span>
                <input
                  type="range" min="1" max="3" step="0.01" value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
              <button
                type="button"
                onClick={handleApply}
                className="mt-3"
                style={{
                  background: 'transparent', color: 'var(--accent)', border: '1px solid rgba(184,154,94,0.4)',
                  borderRadius: '6px', padding: '8px 16px', fontSize: '0.62rem', letterSpacing: '0.1em',
                  textTransform: 'uppercase', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
                }}
              >
                Übernehmen
              </button>
              {committedUrl && (
                <p className="mt-2" style={{ color: '#4C7A5D', fontSize: '0.65rem' }}>✓ Ausschnitt übernommen</p>
              )}
            </>
          )}
          <p className="mt-2" style={{ color: 'var(--muted)', fontSize: '0.62rem' }}>
            Foto auswählen, mit der Maus/dem Finger im Kreis verschieben, Zoom anpassen, dann „Übernehmen".
          </p>
        </div>
      </div>
    </div>
  )
}
