import sharp from 'sharp'

const MAX_WIDTH = 2000

/**
 * Serverseitige Kompression vor dem Speichern (Leitlinie Phase 16: "Fotos
 * serverseitig in Supabase Storage speichern, komprimieren") — Resize auf
 * eine sinnvolle Maximalbreite (nur falls größer) + WebP-Reencoding.
 * Wiederverwendbar für jede künftige Foto-Upload-Stelle, nicht nur Memories.
 */
export async function compressImageForStorage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
}
