import {
  REEL_VIDEO_COMPRESSION_TARGET_BYTES, REEL_VIDEO_COMPRESSION_MAX_WIDTH, REEL_VIDEO_COMPRESSION_MAX_HEIGHT,
  REEL_VIDEO_COMPRESSION_FPS, REEL_VIDEO_COMPRESSION_AUDIO_BITRATE_BPS, REEL_VIDEO_COMPRESSION_MIN_VIDEO_BITRATE_BPS,
} from '@/lib/reel-media-limits'

/**
 * §Content Studio 3.0: "Videos über 50 MB vor dem Upload clientseitig mit
 * WebCodecs komprimieren" (Nutzervorgabe, wörtlich). Nutzt `mediabunny`
 * (reines TypeScript, keine WASM-Abhängigkeit, ~16-17kB gzip je Format, baut
 * selbst auf der Browser-WebCodecs-API auf) statt eines schweren
 * ffmpeg.wasm-Bundles -- per DYNAMISCHEM Import geladen, damit es nicht im
 * Haupt-Bundle landet, sondern nur beim tatsächlichen Komprimieren
 * nachgeladen wird ("keine schwere WASM-Lösung im Hauptbundle").
 *
 * Läuft ausschließlich lokal im Browser (Decoding/Encoding/Muxing komplett
 * clientseitig) -- der Server bekommt nie das Originalvideo zu Gesicht, nur
 * das bereits komprimierte Ergebnis (über die bestehende
 * Signed-Upload-Logik, siehe components/DirectVideoUploadForm.tsx).
 */

export class VideoCompressionUnsupportedError extends Error {
  constructor() {
    super('Videokompression wird von diesem Browser nicht unterstützt (WebCodecs fehlt).')
    this.name = 'VideoCompressionUnsupportedError'
  }
}

export class VideoCompressionCancelledError extends Error {
  constructor() {
    super('Kompression abgebrochen.')
    this.name = 'VideoCompressionCancelledError'
  }
}

/** §"Bei fehlendem WebCodecs klare Meldung" (Nutzervorgabe): reine Capability-Prüfung, lädt die Kompressions-Bibliothek noch nicht. */
export function isVideoCompressionSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined'
    && typeof (window as unknown as { AudioEncoder?: unknown }).AudioEncoder !== 'undefined'
}

export type VideoCompressionResult = {
  file: File
  originalSizeBytes: number
  compressedSizeBytes: number
}

/**
 * §"Maximal 1080 × 1920, 30 fps, H.264/AAC" + "Zielgröße sicher unter dem
 * Uploadlimit, mit etwas Puffer" (Nutzervorgabe, wörtlich): skaliert NUR
 * herunter (nie hoch), Zielbitrate wird aus der tatsächlichen Cliplänge
 * berechnet, damit die Ausgabedatei zuverlässig unter
 * REEL_VIDEO_COMPRESSION_TARGET_BYTES bleibt.
 *
 * §"Originaldatei unverändert lassen": `file` wird nirgends mutiert -- es
 * entsteht ausschließlich eine NEUE Datei aus dem komprimierten Ergebnis.
 */
export async function compressVideoFile(
  file: File,
  options: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
): Promise<VideoCompressionResult> {
  if (options.signal?.aborted) throw new VideoCompressionCancelledError()
  if (!isVideoCompressionSupported()) throw new VideoCompressionUnsupportedError()

  const {
    Input, Output, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS,
    Conversion, canEncodeVideo, canEncodeAudio, ConversionCanceledError,
  } = await import('mediabunny')

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })

  const [duration, videoTrack] = await Promise.all([
    input.computeDuration(),
    input.getPrimaryVideoTrack(),
  ])
  if (!videoTrack || !(duration > 0)) throw new Error('Video konnte nicht gelesen werden.')

  const sourceWidth = videoTrack.displayWidth
  const sourceHeight = videoTrack.displayHeight
  const scale = Math.min(1, REEL_VIDEO_COMPRESSION_MAX_WIDTH / sourceWidth, REEL_VIDEO_COMPRESSION_MAX_HEIGHT / sourceHeight)
  const targetWidth = Math.max(2, Math.round((sourceWidth * scale) / 2) * 2)
  const targetHeight = Math.max(2, Math.round((sourceHeight * scale) / 2) * 2)

  const audioBitrate = REEL_VIDEO_COMPRESSION_AUDIO_BITRATE_BPS
  // §Zusätzlicher Puffer für Container-/Mux-Overhead, oben auf den bereits konservativen Zielwert.
  const safeTargetBytes = REEL_VIDEO_COMPRESSION_TARGET_BYTES * 0.95
  const videoBitrate = Math.max(
    REEL_VIDEO_COMPRESSION_MIN_VIDEO_BITRATE_BPS,
    Math.floor((safeTargetBytes * 8 - audioBitrate * duration) / duration),
  )

  const [videoSupported, audioSupported] = await Promise.all([
    canEncodeVideo('avc', { width: targetWidth, height: targetHeight, bitrate: videoBitrate }),
    canEncodeAudio('aac', { bitrate: audioBitrate }),
  ])
  if (!videoSupported || !audioSupported) throw new VideoCompressionUnsupportedError()

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const conversion = await Conversion.init({
    input,
    output,
    video: { width: targetWidth, height: targetHeight, fit: 'contain', frameRate: REEL_VIDEO_COMPRESSION_FPS, codec: 'avc', bitrate: videoBitrate },
    audio: { codec: 'aac', bitrate: audioBitrate },
  })
  if (!conversion.isValid) throw new Error('Video kann nicht komprimiert werden (nicht unterstütztes Format).')

  if (options.onProgress) {
    const onProgress = options.onProgress
    conversion.onProgress = (progress) => onProgress(progress)
  }

  const handleAbort = () => { conversion.cancel().catch(() => {}) }
  options.signal?.addEventListener('abort', handleAbort)
  try {
    await conversion.execute()
  } catch (e) {
    if (e instanceof ConversionCanceledError) throw new VideoCompressionCancelledError()
    throw e
  } finally {
    options.signal?.removeEventListener('abort', handleAbort)
  }

  const buffer = output.target.buffer
  if (!buffer) throw new Error('Kompression hat kein Ergebnis geliefert.')

  const compressedName = file.name.replace(/\.[^./]+$/, '') + '.mp4'
  const compressedFile = new File([buffer], compressedName, { type: 'video/mp4' })

  return { file: compressedFile, originalSizeBytes: file.size, compressedSizeBytes: compressedFile.size }
}
