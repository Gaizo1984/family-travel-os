import sharp from 'sharp'
import { assertSafeImageFormat } from './image-format-guard'

const MAX_WIDTH = 2000

/**
 * Serverseitige Kompression vor dem Speichern (Leitlinie Phase 16: "Fotos
 * serverseitig in Supabase Storage speichern, komprimieren") — Resize auf
 * eine sinnvolle Maximalbreite (nur falls größer) + WebP-Reencoding.
 * Wiederverwendbar für jede künftige Foto-Upload-Stelle, nicht nur Memories.
 *
 * §Sharp 0.34.4-Pinning (siehe lib/image-format-guard.ts): dies ist der
 * EINZIGE Einstiegspunkt, über den rohe, ungeprüfte Upload-Bytes an sharp
 * gelangen -- alle Upload-Aktionen (memories.ts/trips.ts/content-sessions.ts/
 * image-check.ts) rufen ausschließlich diese Funktion mit dem frischen
 * Nutzer-Upload auf; jede weitere sharp-Nutzung im Projekt (Thumbnails,
 * dHash, KI-Analyse-Vorverarbeitung) verarbeitet ausschließlich bereits
 * hierüber gelaufene, also schon auf WebP re-encodete Buffer. Die
 * Formatprüfung hier reicht deshalb aus, um GIF/TIFF u. ä. konsequent von
 * sharp fernzuhalten, ohne sie an jeder einzelnen Aufrufstelle zu duplizieren.
 */
export async function compressImageForStorage(buffer: Buffer): Promise<Buffer> {
  assertSafeImageFormat(buffer)

  // §Fix "Invalid SOS parameters for sequential JPEG": manche Smartphone-/
  // Messenger-JPEGs sind leicht nicht-konform kodiert (z. B. ungewöhnliche
  // Restart-Marker) -- libvips lehnt sie standardmäßig komplett ab, obwohl
  // sie sich fehlertolerant decodieren lassen. `failOn: 'none'` erlaubt
  // genau das (statt eines harten Abbruchs), ohne die Kompressions-/
  // Qualitätslogik selbst zu verändern.
  const compressed = await sharp(buffer, { failOn: 'none' })
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
