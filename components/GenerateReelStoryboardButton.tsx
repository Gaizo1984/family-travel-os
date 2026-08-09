'use client'

import { useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type UploadSlot = { path: string; token: string }
type VideoNeedingThumbnail = { videoId: string; signedUrl: string }

/** Eigener, minimaler Lumi-Core-Browser-Client für den Signed-Upload-Schritt -- siehe components/DirectPhotoUploadForm.tsx für das gleiche Muster. */
function createLumiCoreBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_LUMI_CORE_URL!,
    process.env.NEXT_PUBLIC_LUMI_CORE_PUBLISHABLE_KEY!,
  )
}

/**
 * §"Bei Videos nur ein Standbild/Posterframe analysieren, niemals das
 * Rohvideo an OpenAI senden" (Nutzervorgabe, wörtlich): das Standbild wird
 * HIER, clientseitig, per <video>+<canvas> aus dem bereits hochgeladenen
 * Videoclip selbst erzeugt (Signed-URL, kein Rohvideo-Upload an OpenAI) --
 * niemals serverseitig, das würde das Video erneut laden/dekodieren müssen.
 *
 * §Erweiterung des bestehenden Direct-Upload-Musters
 * (components/DirectVideoUploadForm.tsx): gleicher Signed-Upload-Mechanismus,
 * hier für das erzeugte JPEG-Standbild statt für die Video-Rohdatei.
 */
function capturePosterframe(signedUrl: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    let settled = false
    const finish = (blob: Blob | null) => {
      if (settled) return
      settled = true
      resolve(blob)
    }
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 720
        canvas.height = video.videoHeight || 1280
        const ctx = canvas.getContext('2d')
        if (!ctx) { finish(null); return }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.85)
      } catch {
        // §CORS-Tainted-Canvas o.ä. -- Video wird dann ohne Standbild übersprungen, kein Absturz.
        finish(null)
      }
    }
    video.onerror = () => finish(null)
    // §Absicherung gegen ein Video, das nie "seeked" auslöst (z.B. defekte Datei).
    setTimeout(() => finish(null), 15000)
    video.src = signedUrl
  })
}

export function GenerateReelStoryboardButton({
  action,
  projectId,
  returnTo,
  videosNeedingThumbnail,
  createThumbnailSlots,
  saveThumbnail,
  disabled,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>
  projectId: string
  returnTo: string
  videosNeedingThumbnail: VideoNeedingThumbnail[]
  createThumbnailSlots: (count: number) => Promise<UploadSlot[]>
  saveThumbnail: (formData: FormData) => Promise<{ ok: boolean }>
  disabled?: boolean
  label: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const isWorkingRef = useRef(false)

  async function handleClick() {
    if (isWorkingRef.current) return
    isWorkingRef.current = true
    setIsWorking(true)
    setStatusText(videosNeedingThumbnail.length > 0 ? 'Video-Standbilder werden erzeugt …' : 'Storyboard wird erstellt …')

    try {
      if (videosNeedingThumbnail.length > 0) {
        const lumiCore = createLumiCoreBrowserClient()
        const slots = await createThumbnailSlots(videosNeedingThumbnail.length)
        for (let i = 0; i < videosNeedingThumbnail.length; i++) {
          const video = videosNeedingThumbnail[i]
          const slot = slots[i]
          if (!slot) continue
          const blob = await capturePosterframe(video.signedUrl)
          if (!blob) continue
          const { error: uploadError } = await lumiCore.storage.from('travel-documents')
            .uploadToSignedUrl(slot.path, slot.token, blob, { contentType: 'image/jpeg' })
          if (uploadError) continue
          const fd = new FormData()
          fd.set('video_id', video.videoId)
          fd.set('staging_path', slot.path)
          await saveThumbnail(fd)
        }
        setStatusText('Storyboard wird erstellt …')
      }
      formRef.current?.requestSubmit()
    } finally {
      isWorkingRef.current = false
      setIsWorking(false)
    }
  }

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isWorking}
        style={{
          background: 'var(--accent)', color: 'var(--surface)', border: 'none', borderRadius: '999px',
          padding: '12px 22px', fontSize: '0.78rem', letterSpacing: '0.02em', cursor: disabled || isWorking ? 'default' : 'pointer',
          opacity: disabled || isWorking ? 0.6 : 1,
        }}
      >
        {isWorking ? (statusText ?? 'Bitte warten …') : label}
      </button>
    </form>
  )
}
