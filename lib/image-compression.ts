import sharp from 'sharp'

const MAX_WIDTH = 2000

/**
 * Serverseitige Kompression vor dem Speichern (Leitlinie Phase 16: "Fotos
 * serverseitig in Supabase Storage speichern, komprimieren") — Resize auf
 * eine sinnvolle Maximalbreite (nur falls größer) + WebP-Reencoding.
 * Wiederverwendbar für jede künftige Foto-Upload-Stelle, nicht nur Memories.
 */
export async function compressImageForStorage(buffer: Buffer): Promise<Buffer> {
  const compressed = await sharp(buffer)
    // §"Bilder im Querformat stehen auf dem Kopf": Fotos von Smartphones
    // speichern die Pixel oft unrotiert und markieren die tatsächliche
    // Ausrichtung nur im EXIF-Orientation-Tag. Ohne .rotate() übernimmt
    // resize()/webp() die rohen (falsch orientierten) Pixel, und der Tag
    // geht beim WebP-Reencoding ohnehin verloren -- .rotate() ohne
    // Argumente wendet die EXIF-Rotation VOR dem Resize physisch auf die
    // Pixel an, danach ist das Bild unabhängig vom (verworfenen) Tag korrekt.
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  // §Diagnose "Broken Image nach Upload" (Sprint 1.2): verifiziert, dass das
  // komprimierte Ergebnis selbst wieder decodierbar ist, BEVOR es gespeichert
  // wird — verhindert, dass eine kaputte Datei überhaupt erst im Storage
  // landet (statt erst beim Anzeigen als Broken Image aufzufallen).
  await sharp(compressed).metadata()

  return compressed
}
