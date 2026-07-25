'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAX_REEL_VIDEO_CLIP_SECONDS, MAX_REEL_VIDEO_FILE_SIZE_BYTES, ALLOWED_REEL_VIDEO_MIME_TYPES } from '@/lib/reel-media-limits'
import { compressVideoFile, isVideoCompressionSupported, VideoCompressionCancelledError } from '@/lib/video-compression-client'

type UploadSlot = { path: string; token: string }
type CompressionSummary = { fileName: string; originalSizeBytes: number; compressedSizeBytes: number }

/**
 * §Content Studio 3.0: Video-Pendant zu `DirectPhotoUploadForm`
 * (identisches Signed-Upload-Muster, kein Function-Buffering). Zusätzlich:
 * clientseitige Prüfung von Cliplänge/Dateigröße/Dateityp VOR dem Upload
 * (spart unnötigen Upload-Traffic für abgelehnte Dateien) -- die
 * serverseitige Größen-/Typprüfung (lib/actions/content-reel-media.ts)
 * bleibt die eigentliche Durchsetzung, da eine rein clientseitige Prüfung
 * umgehbar wäre.
 *
 * §"Videos über 50 MB vor dem Upload clientseitig mit WebCodecs
 * komprimieren" (Nutzervorgabe, wörtlich): eine zu große Datei wird jetzt
 * NICHT mehr pauschal abgelehnt, sondern zuerst per
 * lib/video-compression-client.ts komprimiert -- der Upload startet erst,
 * wenn die Kompression erfolgreich war ("Upload erst nach erfolgreicher
 * Komprimierung"). Läuft komplett lokal im Browser, das Original-`File`
 * bleibt unangetastet (es entsteht immer eine neue, komprimierte Datei).
 */
function readVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(Number.isFinite(video.duration) ? video.duration : null)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      resolve(null)
    }
    video.src = URL.createObjectURL(file)
  })
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DirectVideoUploadForm({
  action,
  createSlots,
  fileInputName,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>
  createSlots: (count: number) => Promise<UploadSlot[]>
  fileInputName: string
  children: React.ReactNode
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [compressing, setCompressing] = useState<{ fileName: string; progress: number } | null>(null)
  const [compressionSummaries, setCompressionSummaries] = useState<CompressionSummary[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const isUploadingRef = useRef(false)
  const compressionAbortRef = useRef<AbortController | null>(null)

  function handleCancelCompression() {
    compressionAbortRef.current?.abort()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const fileInput = form.elements.namedItem(fileInputName) as HTMLInputElement | null
    const files = Array.from(fileInput?.files ?? [])
    if (files.length === 0) return
    if (isUploadingRef.current) { e.preventDefault(); return }

    e.preventDefault()
    isUploadingRef.current = true
    setIsUploading(true)
    setUploadError(null)
    setCompressionSummaries([])
    setProgress({ done: 0, total: files.length })

    const paths: string[] = []
    const mimeTypes: string[] = []
    const durations: (number | null)[] = []
    let rejectedCount = 0
    let cancelled = false

    try {
      // §Vorab-Prüfung: Typ/Länge/Größe (inkl. Kompression bei Übergröße) -- abgelehnte Dateien lösen KEINEN Upload aus.
      const accepted: File[] = []
      const acceptedDurations: (number | null)[] = []
      for (const file of files) {
        if (!ALLOWED_REEL_VIDEO_MIME_TYPES.includes(file.type as (typeof ALLOWED_REEL_VIDEO_MIME_TYPES)[number])) {
          rejectedCount++; continue
        }
        const duration = await readVideoDurationSeconds(file)
        if (duration !== null && duration > MAX_REEL_VIDEO_CLIP_SECONDS) {
          rejectedCount++; continue
        }

        let candidateFile = file
        if (file.size > MAX_REEL_VIDEO_FILE_SIZE_BYTES) {
          if (!isVideoCompressionSupported()) {
            rejectedCount++
            setUploadError(`„${file.name}" ist zu groß (max. 50 MB) -- dieser Browser unterstützt keine automatische Kompression.`)
            continue
          }
          const controller = new AbortController()
          compressionAbortRef.current = controller
          setCompressing({ fileName: file.name, progress: 0 })
          try {
            const result = await compressVideoFile(file, {
              onProgress: (p) => setCompressing({ fileName: file.name, progress: p }),
              signal: controller.signal,
            })
            setCompressionSummaries((prev) => [...prev, {
              fileName: file.name, originalSizeBytes: result.originalSizeBytes, compressedSizeBytes: result.compressedSizeBytes,
            }])
            if (result.compressedSizeBytes > MAX_REEL_VIDEO_FILE_SIZE_BYTES) {
              rejectedCount++
              setUploadError(`„${file.name}" konnte nicht klein genug komprimiert werden.`)
              continue
            }
            candidateFile = result.file
          } catch (compressionError) {
            if (compressionError instanceof VideoCompressionCancelledError) {
              cancelled = true
              setUploadError('Kompression abgebrochen.')
              break
            }
            rejectedCount++
            setUploadError(`„${file.name}" konnte nicht komprimiert werden.`)
            continue
          } finally {
            setCompressing(null)
            compressionAbortRef.current = null
          }
        }

        accepted.push(candidateFile)
        acceptedDurations.push(duration)
      }

      if (cancelled) {
        setProgress(null)
        return
      }

      if (accepted.length === 0) {
        setProgress(null)
        setUploadError((prev) => prev ?? `Kein Video hochgeladen -- ${rejectedCount} abgelehnt (Format, Größe über 50 MB oder länger als ${MAX_REEL_VIDEO_CLIP_SECONDS}s).`)
        return
      }

      const supabase = createClient()
      const slots = await createSlots(accepted.length)
      for (let i = 0; i < accepted.length; i++) {
        try {
          const { error } = await supabase.storage.from('documents')
            .uploadToSignedUrl(slots[i].path, slots[i].token, accepted[i], { contentType: accepted[i].type })
          if (error) throw error
          paths.push(slots[i].path)
          mimeTypes.push(accepted[i].type)
          durations.push(acceptedDurations[i])
        } catch {
          rejectedCount++
        }
        setProgress({ done: paths.length, total: accepted.length })
      }

      if (paths.length === 0) {
        setProgress(null)
        setUploadError('Video-Upload fehlgeschlagen. Bitte erneut versuchen.')
        return
      }

      if (fileInput) fileInput.value = ''
      const hiddenPaths = document.createElement('input')
      hiddenPaths.type = 'hidden'
      hiddenPaths.name = 'uploaded_paths'
      hiddenPaths.value = JSON.stringify(paths)
      form.appendChild(hiddenPaths)
      const hiddenMimes = document.createElement('input')
      hiddenMimes.type = 'hidden'
      hiddenMimes.name = 'uploaded_mime_types'
      hiddenMimes.value = JSON.stringify(mimeTypes)
      form.appendChild(hiddenMimes)
      const hiddenDurations = document.createElement('input')
      hiddenDurations.type = 'hidden'
      hiddenDurations.name = 'uploaded_durations'
      hiddenDurations.value = JSON.stringify(durations)
      form.appendChild(hiddenDurations)

      setProgress(null)
      if (rejectedCount > 0) {
        setUploadError((prev) => prev ?? `${rejectedCount} Video(s) abgelehnt (Format, Größe oder Länge) -- ${paths.length} werden gespeichert.`)
      }
      form.requestSubmit()
    } finally {
      isUploadingRef.current = false
      setIsUploading(false)
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit}>
      <div
        aria-disabled={isUploading}
        style={{ pointerEvents: isUploading ? 'none' : undefined, opacity: isUploading ? 0.6 : 1 }}
      >
        {children}
      </div>

      {compressing && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
            „{compressing.fileName}" wird komprimiert … {Math.round(compressing.progress * 100)}%
          </p>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(compressing.progress * 100)}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
          <button
            type="button" onClick={handleCancelCompression}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#B5624A', fontSize: '0.68rem', cursor: 'pointer', padding: 0 }}
          >
            Abbrechen
          </button>
        </div>
      )}

      {compressionSummaries.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {compressionSummaries.map((s) => (
            <p key={s.fileName} style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>
              „{s.fileName}" komprimiert: {formatMB(s.originalSizeBytes)} → {formatMB(s.compressedSizeBytes)}
            </p>
          ))}
        </div>
      )}

      {progress && (
        <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginTop: '8px' }}>
          Videos werden hochgeladen … {progress.done}/{progress.total}
        </p>
      )}
      {uploadError && (
        <p style={{ color: '#c0392b', fontSize: '0.7rem', marginTop: '8px' }}>{uploadError}</p>
      )}
    </form>
  )
}
