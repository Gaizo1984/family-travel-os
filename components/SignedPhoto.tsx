'use client'

import { useEffect, useRef, useState } from 'react'
import { refreshSignedUrl, logPhotoDiagnostic } from '@/lib/actions/photo-diagnostics'

/**
 * Gemeinsame Bild-Komponente für JEDE Stelle, die ein Foto rendert (Travel
 * Memory, Content Studio, Dashboard/Trips-Highlightfotos) — ersetzt das rohe
 * `<img>`, damit überall dieselbe Logik greift: Diagnose-Logging (temporär,
 * Sprint 1.2) + automatischer Retry mit frisch erzeugter Signed URL, bevor
 * ein Broken Image sichtbar wird.
 *
 * `storagePath` nur setzen, wenn das Bild wirklich aus unserem
 * Supabase-Storage kommt (memory_photos/content_project_photos) — dort kann
 * ein abgelaufenes/fehlerhaftes Signed-URL-Token neu erzeugt werden. Bei
 * `null` (z. B. feste Unsplash-URLs) wird nur geloggt, kein Retry versucht.
 */
export function SignedPhoto({
  storagePath,
  initialUrl,
  alt,
  className,
  style,
  loading,
}: {
  storagePath: string | null
  initialUrl: string
  alt: string
  className?: string
  style?: React.CSSProperties
  loading?: 'lazy' | 'eager'
}) {
  const [src, setSrc] = useState(initialUrl)
  const retriedRef = useRef(false)

  useEffect(() => {
    logPhotoDiagnostic({ storagePath, url: src, phase: 'render', httpStatus: null, retried: false }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleErrorInner() {
    let httpStatus = 'unknown'
    try {
      const res = await fetch(src, { method: 'HEAD' })
      httpStatus = String(res.status)
    } catch {
      httpStatus = 'fetch_failed'
    }

    console.error('[SignedPhoto][DIAGNOSTIC] Bild-Ladefehler', { storagePath, url: src, httpStatus, retried: retriedRef.current })
    logPhotoDiagnostic({ storagePath, url: src, phase: 'load', httpStatus, retried: retriedRef.current }).catch(() => {})

    // §Fix "This page couldn't load"/Unhandled Promise Rejection: refreshSignedUrl
    // ist ein Server-Aufruf und kann selbst fehlschlagen (Netzwerk, Server) —
    // MUSS abgesichert sein, sonst wird handleErrors Promise zurückgewiesen,
    // ohne dass irgendjemand sie behandelt (React ruft onError "fire and
    // forget" auf, ohne die zurückgegebene Promise abzuwarten).
    if (!retriedRef.current && storagePath) {
      retriedRef.current = true
      try {
        const fresh = await refreshSignedUrl(storagePath)
        if (fresh && fresh !== src) {
          setSrc(fresh)
          return
        }
      } catch (e) {
        console.error('[SignedPhoto][DIAGNOSTIC] refreshSignedUrl fehlgeschlagen', e)
      }
    }
    // Zweiter Fehlschlag (oder kein storagePath/Refresh möglich): Broken
    // Image bewusst sichtbar lassen, wie gewünscht — kein Verstecken.
  }

  // Zusätzliches Sicherheitsnetz: React ruft onError "fire and forget" auf und
  // wartet die zurückgegebene Promise nicht ab — ein hier nicht gefangener
  // Fehler würde als unhandled rejection im Browser landen. handleErrorInner
  // ist bereits vollständig abgesichert (s. o.), dieser äußere .catch() ist
  // die letzte Verteidigungslinie, falls doch einmal etwas durchrutscht.
  function handleError() {
    handleErrorInner().catch((e) => console.error('[SignedPhoto][DIAGNOSTIC] unerwarteter Fehler in handleError', e))
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} loading={loading} onError={handleError} />
}
