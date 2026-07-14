'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type UploadSlot = { path: string; token: string }

/** `createUploadSlots` (lib/actions/photo-staging.ts) lehnt count>20 pro Aufruf ab -- größere Auswahlen werden clientseitig in Batches dieser Größe aufgeteilt, ein einziges finales Formular-Submit trägt alle gesammelten Pfade. */
const SLOT_BATCH_SIZE = 20

/**
 * Lädt ausgewählte Fotos DIREKT vom Browser zu Supabase Storage hoch (Signed
 * Upload URL) statt über den Server-Action-Request-Body — Vercel begrenzt
 * dessen Größe plattformseitig auf 4,5 MB, was bei 2+ Fotos zuverlässig
 * überschritten wurde ("This page couldn't load"). Nach erfolgreichem
 * Direkt-Upload wird das eigentliche Formular ganz normal nativ abgeschickt,
 * jetzt nur noch mit den Speicherpfaden statt Roh-Bytes (winziger Payload) —
 * Redirect/useFormStatus (SubmitButtonWithProgress) funktionieren dadurch
 * unverändert weiter. Größere Auswahlen (z.B. 30-50+ Content-Session-Fotos)
 * werden in Batches von je maximal 20 Slots hochgeladen, aber als EIN
 * gesammeltes Submit abgeschickt -- der Server-Action-Aufrufer entscheidet
 * selbst, ob/wie er die Gesamtmenge begrenzt.
 */
export function DirectPhotoUploadForm({
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const fileInput = form.elements.namedItem(fileInputName) as HTMLInputElement | null
    const files = Array.from(fileInput?.files ?? [])
    // Kein Foto gewählt: normales natives Submit, der Server meldet ggf.
    // "Bitte mindestens ein Foto auswählen" (oder Fotos sind hier optional).
    if (files.length === 0) return

    e.preventDefault()
    setUploadError(null)
    setProgress({ done: 0, total: files.length })

    try {
      const supabase = createClient()
      const paths: string[] = []
      for (let start = 0; start < files.length; start += SLOT_BATCH_SIZE) {
        const batch = files.slice(start, start + SLOT_BATCH_SIZE)
        const slots = await createSlots(batch.length)
        for (let i = 0; i < batch.length; i++) {
          const { error } = await supabase.storage.from('documents')
            .uploadToSignedUrl(slots[i].path, slots[i].token, batch[i], { contentType: batch[i].type })
          if (error) throw error
          paths.push(slots[i].path)
          setProgress({ done: paths.length, total: files.length })
        }
      }

      if (fileInput) fileInput.value = ''
      const hidden = document.createElement('input')
      hidden.type = 'hidden'
      hidden.name = 'uploaded_paths'
      hidden.value = JSON.stringify(paths)
      form.appendChild(hidden)

      setProgress(null)
      form.requestSubmit()
    } catch {
      setProgress(null)
      setUploadError('Foto-Upload fehlgeschlagen. Bitte erneut versuchen.')
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit}>
      {children}
      {progress && (
        <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginTop: '8px' }}>
          Fotos werden hochgeladen … {progress.done}/{progress.total}
        </p>
      )}
      {uploadError && (
        <p style={{ color: '#c0392b', fontSize: '0.7rem', marginTop: '8px' }}>{uploadError}</p>
      )}
    </form>
  )
}
