import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { getCachedSignedUrl, getCachedSignedUrlIfPresent, getCachedSignedUrls } from '@/lib/signed-storage-url'

/**
 * §"Egress-Analyse 2026-07-16": Originale sind bereits auf max. 2000px Breite
 * komprimiert (`lib/image-compression.ts`), aber dieselbe Datei wurde bisher
 * AUCH für kleine Galerie-/Karten-Kacheln (z. B. 120×120px) ausgeliefert --
 * jede Kachel überträgt so ein Vielfaches der tatsächlich benötigten
 * Bilddaten. Diese Datei erzeugt echte, kleinere Vorschaubilder und liefert
 * sie für Grid-/Karten-Kontexte aus; Originale bleiben ausschließlich der
 * Detail-/Lightbox-Ansicht vorbehalten.
 */
export type ThumbnailSize = 400 | 800
const THUMBNAIL_QUALITY = 78

/** Deterministisch aus dem Original abgeleitet -- Originale enden bereits immer auf `.webp` (compressImageForStorage), kein Kollisionsrisiko mit anderen Dateien. */
function thumbnailPathFor(originalPath: string, size: ThumbnailSize): string {
  const withoutExt = originalPath.replace(/\.[^./]+$/, '')
  return `${withoutExt}__thumb${size}.webp`
}

function splitPath(path: string): { dir: string; name: string } {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash === -1 ? { dir: '', name: path } : { dir: path.slice(0, lastSlash), name: path.slice(lastSlash + 1) }
}

/** Reiner Metadaten-Check (kein Bild-Download) -- ob das Thumbnail schon existiert. */
async function thumbnailExists(bucket: string, thumbPath: string): Promise<boolean> {
  const { dir, name } = splitPath(thumbPath)
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).list(dir, { search: name, limit: 1 })
  if (error) return false
  return (data ?? []).some((f) => f.name === name)
}

/**
 * §"Für bestehende Fotos keine riskante Massenmigration -- Thumbnail bei
 * erstem Abruf erzeugen, Original unverändert lassen, bei Fehlern auf
 * Original zurückfallen" (Nutzervorgabe, wörtlich umgesetzt): lädt das
 * ORIGINAL nur zum Lesen herunter (wird nie verändert/überschrieben),
 * verkleinert es und lädt das Ergebnis unter dem deterministischen Pfad
 * hoch. `upsert: true` macht gleichzeitige Erzeugung durch parallele Abrufe
 * unschädlich -- letzter Schreibvorgang gewinnt, inhaltlich identisch, nie
 * eine doppelte Datei. Gibt bei JEDEM Fehler `null` zurück.
 */
async function createThumbnail(bucket: string, originalPath: string, size: ThumbnailSize): Promise<string | null> {
  const thumbPath = thumbnailPathFor(originalPath, size)
  try {
    const supabase = await createClient()
    const { data: originalData, error: downloadError } = await supabase.storage.from(bucket).download(originalPath)
    if (downloadError || !originalData) return null
    const originalBuffer = Buffer.from(await originalData.arrayBuffer())

    const thumbBuffer = await sharp(originalBuffer)
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer()

    const blob = new Blob([new Uint8Array(thumbBuffer)], { type: 'image/webp' })
    const { error: uploadError } = await supabase.storage.from(bucket).upload(thumbPath, blob, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
    if (uploadError) {
      console.error('[photo-thumbnails] Thumbnail-Upload fehlgeschlagen', { thumbPath, error: uploadError.message })
      return null
    }
    return thumbPath
  } catch (e) {
    console.error('[photo-thumbnails] Thumbnail-Erzeugung fehlgeschlagen', { originalPath, size, error: e })
    return null
  }
}

export type PhotoVariant = 'thumb400' | 'thumb800' | 'original'
export type PhotoDisplayUrl = { url: string; resolvedPath: string }

/**
 * Zentrale Auflösung für JEDE Foto-Anzeige: Grid-/Karten-Kontexte fordern
 * `thumb400`/`thumb800` an, Detail-/Lightbox-Ansichten `original`.
 * `resolvedPath` wird zurückgegeben, damit `components/SignedPhoto.tsx` bei
 * einem Ladefehler exakt den tatsächlich angezeigten Pfad (Thumbnail ODER
 * Original) neu signieren lässt, nicht versehentlich den jeweils anderen.
 */
export async function getPhotoDisplayUrl(bucket: string, originalPath: string, variant: PhotoVariant): Promise<PhotoDisplayUrl | null> {
  if (variant === 'original') {
    const url = await getCachedSignedUrl(bucket, originalPath)
    return url ? { url, resolvedPath: originalPath } : null
  }

  const size: ThumbnailSize = variant === 'thumb400' ? 400 : 800
  const thumbPath = thumbnailPathFor(originalPath, size)

  try {
    // Bereits eine gültige, gecachte Signed URL fürs Thumbnail? Dann
    // existiert es garantiert schon -- kein erneuter Existenz-Check nötig.
    const alreadyCached = await getCachedSignedUrlIfPresent(bucket, thumbPath)
    if (alreadyCached) return { url: alreadyCached, resolvedPath: thumbPath }

    const exists = await thumbnailExists(bucket, thumbPath)
    const resolvedThumbPath = exists ? thumbPath : await createThumbnail(bucket, originalPath, size)
    if (resolvedThumbPath) {
      const url = await getCachedSignedUrl(bucket, resolvedThumbPath)
      if (url) return { url, resolvedPath: resolvedThumbPath }
    }
  } catch (e) {
    console.error('[photo-thumbnails] getPhotoDisplayUrl fehlgeschlagen, falle auf Original zurueck', e)
  }

  // §"Bei Fehlern immer auf das Original zurückfallen": nie ein kaputtes Bild.
  const fallbackUrl = await getCachedSignedUrl(bucket, originalPath)
  return fallbackUrl ? { url: fallbackUrl, resolvedPath: originalPath } : null
}

/**
 * Batch-Variante für Grid-/Listen-Ansichten (Galerie/Memories/Yearbook).
 * Liest den Signed-URL-Cache für ALLE Pfade in einer einzigen Abfrage (statt
 * einer pro Foto) -- nur für Pfade, die dabei nicht als bereits gültig
 * gecacht gefunden werden (neue Fotos, erstmalige Thumbnail-Erzeugung,
 * abgelaufener Cache-Eintrag), fällt es auf die einzelne Auflösung pro Pfad
 * zurück (inkl. Thumbnail-Erzeugung/Existenz-Check/Original-Fallback).
 */
export async function getPhotoDisplayUrls(bucket: string, originalPaths: string[], variant: PhotoVariant): Promise<Map<string, PhotoDisplayUrl>> {
  if (originalPaths.length === 0) return new Map()

  if (variant === 'original') {
    const cachedUrls = await getCachedSignedUrls(bucket, originalPaths)
    const result = new Map<string, PhotoDisplayUrl>()
    for (const [path, url] of cachedUrls) result.set(path, { url, resolvedPath: path })
    return result
  }

  const size: ThumbnailSize = variant === 'thumb400' ? 400 : 800
  const thumbPathByOriginal = new Map(originalPaths.map((p) => [p, thumbnailPathFor(p, size)] as const))
  const cachedThumbUrls = await getCachedSignedUrls(bucket, [...thumbPathByOriginal.values()])

  const result = new Map<string, PhotoDisplayUrl>()
  const missing: string[] = []
  for (const originalPath of originalPaths) {
    const thumbPath = thumbPathByOriginal.get(originalPath)!
    const cached = cachedThumbUrls.get(thumbPath)
    if (cached) result.set(originalPath, { url: cached, resolvedPath: thumbPath })
    else missing.push(originalPath)
  }

  if (missing.length > 0) {
    const resolved = await Promise.all(missing.map(async (path) => [path, await getPhotoDisplayUrl(bucket, path, variant)] as const))
    for (const [path, r] of resolved) if (r) result.set(path, r)
  }

  return result
}
