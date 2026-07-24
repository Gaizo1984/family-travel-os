'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAX_REEL_VIDEO_CLIP_SECONDS, MAX_REEL_VIDEO_FILE_SIZE_BYTES, ALLOWED_REEL_VIDEO_MIME_TYPES } from '@/lib/reel-media-limits'

type UploadSlot = { path: string; token: string }

/**
 * §Content Studio 3.0, Sprint 2: Video-Pendant zu `DirectPhotoUploadForm`
 * (identisches Signed-Upload-Muster, kein Function-Buffering). Zusätzlich:
 * clientseitige Prüfung von Cliplänge/Dateigröße/Dateityp VOR dem Upload
 * (spart unnötigen Upload-Traffic für abgelehnte Dateien) -- die
 * serverseitige Größen-/Typprüfung (lib/actions/content-reel-media.ts)
 * bleibt die eigentliche Durchsetzung, da eine rein clientseitige Prüfung
 * umgehbar wäre.
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
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const isUploadingRef = useRef(false)

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
    setProgress({ done: 0, total: files.length })

    const paths: string[] = []
    const mimeTypes: string[] = []
    const durations: (number | null)[] = []
    let rejectedCount = 0

    try {
      // §Vorab-Prüfung: Typ/Größe/Dauer -- abgelehnte Dateien lösen KEINEN Upload aus.
      const accepted: File[] = []
      const acceptedDurations: (number | null)[] = []
      for (const file of files) {
        if (!ALLOWED_REEL_VIDEO_MIME_TYPES.includes(file.type as (typeof ALLOWED_REEL_VIDEO_MIME_TYPES)[number])) {
          rejectedCount++; continue
        }
        if (file.size > MAX_REEL_VIDEO_FILE_SIZE_BYTES) {
          rejectedCount++; continue
        }
        const duration = await readVideoDurationSeconds(file)
        if (duration !== null && duration > MAX_REEL_VIDEO_CLIP_SECONDS) {
          rejectedCount++; continue
        }
        accepted.push(file)
        acceptedDurations.push(duration)
      }

      if (accepted.length === 0) {
        setProgress(null)
        setUploadError(`Kein Video hochgeladen -- ${rejectedCount} abgelehnt (Format, Größe über 50 MB oder länger als ${MAX_REEL_VIDEO_CLIP_SECONDS}s).`)
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
        setUploadError(`${rejectedCount} Video(s) abgelehnt (Format, Größe oder Länge) -- ${paths.length} werden gespeichert.`)
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
