import sharp from 'sharp'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getSignedUrl } from './signed-url'

/**
 * Lumi-Core-Äquivalent zu lib/photo-thumbnails.ts -- identische Logik
 * (deterministischer Pfad, sharp-Resize, upsert:true, Fallback auf
 * Original bei jedem Fehler), nur gegen den Lumi-Core-Client/-Bucket.
 * Thumbnails werden weiterhin automatisch beim ersten Abruf erzeugt,
 * NICHT vorab migriert (gleiche Begründung wie im Original: keine
 * riskante Massenmigration bestehender Fotos).
 */
export type ThumbnailSize = 400 | 800
const THUMBNAIL_QUALITY = 78

function thumbnailPathFor(originalPath: string, size: ThumbnailSize): string {
  const withoutExt = originalPath.replace(/\.[^./]+$/, '')
  return `${withoutExt}__thumb${size}.webp`
}

function splitPath(path: string): { dir: string; name: string } {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash === -1 ? { dir: '', name: path } : { dir: path.slice(0, lastSlash), name: path.slice(lastSlash + 1) }
}

async function thumbnailExists(bucket: string, thumbPath: string): Promise<boolean> {
  const { dir, name } = splitPath(thumbPath)
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.storage.from(bucket).list(dir, { search: name, limit: 1 })
  if (error) return false
  return (data ?? []).some((f) => f.name === name)
}

async function createThumbnail(bucket: string, originalPath: string, size: ThumbnailSize): Promise<string | null> {
  const thumbPath = thumbnailPathFor(originalPath, size)
  try {
    const lumiCore = await createLumiCoreClient()
    const { data: originalData, error: downloadError } = await lumiCore.storage.from(bucket).download(originalPath)
    if (downloadError || !originalData) return null
    const originalBuffer = Buffer.from(await originalData.arrayBuffer())

    const thumbBuffer = await sharp(originalBuffer)
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer()

    const blob = new Blob([new Uint8Array(thumbBuffer)], { type: 'image/webp' })
    const { error: uploadError } = await lumiCore.storage.from(bucket).upload(thumbPath, blob, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
    if (uploadError) {
      console.error('[lumi-core-storage/photo-thumbnails] Thumbnail-Upload fehlgeschlagen', { thumbPath, error: uploadError.message })
      return null
    }
    return thumbPath
  } catch (e) {
    console.error('[lumi-core-storage/photo-thumbnails] Thumbnail-Erzeugung fehlgeschlagen', { originalPath, size, error: e })
    return null
  }
}

export type PhotoVariant = 'thumb400' | 'thumb800' | 'original'
export type PhotoDisplayUrl = { url: string; resolvedPath: string }

export async function getPhotoDisplayUrl(bucket: string, originalPath: string, variant: PhotoVariant): Promise<PhotoDisplayUrl | null> {
  if (variant === 'original') {
    const url = await getSignedUrl(bucket, originalPath)
    return url ? { url, resolvedPath: originalPath } : null
  }

  const size: ThumbnailSize = variant === 'thumb400' ? 400 : 800
  const thumbPath = thumbnailPathFor(originalPath, size)

  try {
    const exists = await thumbnailExists(bucket, thumbPath)
    const resolvedThumbPath = exists ? thumbPath : await createThumbnail(bucket, originalPath, size)
    if (resolvedThumbPath) {
      const url = await getSignedUrl(bucket, resolvedThumbPath)
      if (url) return { url, resolvedPath: resolvedThumbPath }
    }
  } catch (e) {
    console.error('[lumi-core-storage/photo-thumbnails] getPhotoDisplayUrl fehlgeschlagen, falle auf Original zurueck', e)
  }

  const fallbackUrl = await getSignedUrl(bucket, originalPath)
  return fallbackUrl ? { url: fallbackUrl, resolvedPath: originalPath } : null
}

export async function getPhotoDisplayUrls(bucket: string, originalPaths: string[], variant: PhotoVariant): Promise<Map<string, PhotoDisplayUrl>> {
  if (originalPaths.length === 0) return new Map()
  const resolved = await Promise.all(originalPaths.map(async (path) => [path, await getPhotoDisplayUrl(bucket, path, variant)] as const))
  const result = new Map<string, PhotoDisplayUrl>()
  for (const [path, r] of resolved) if (r) result.set(path, r)
  return result
}
