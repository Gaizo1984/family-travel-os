/**
 * §Sharp-Versions-Pinning (Vercel/Next.js-16.2.10-Kompatibilitätsbug, siehe
 * lib/image-compression.ts-Kommentar): sharp ist auf 0.34.4 fixiert, eine
 * ältere Version OHNE die libvips-Sicherheitsfixes ab 0.35 (u. a. für
 * TIFF-/GIF-Dekodierung). Solange diese Pinnung besteht, dürfen serverseitig
 * NUR die unkritischen, tatsächlich benötigten Formate (JPEG/PNG/WebP) an
 * sharp übergeben werden -- geprüft anhand der echten Datei-Magic-Bytes
 * (nicht des client-gelieferten MIME-Types, der sich fälschen lässt),
 * BEVOR der Buffer sharp überhaupt erreicht. Sobald ein sharp-Fix für den
 * Vercel-Ladefehler verfügbar ist und wieder auf eine aktuelle 0.35.x+
 * Version gewechselt werden kann, ist diese Einschränkung hinfällig und
 * kann entfernt werden.
 */
export class UnsupportedImageFormatError extends Error {
  constructor() {
    super("Dieses Bildformat wird derzeit nicht unterstützt (nur JPEG, PNG, WebP).");
    this.name = "UnsupportedImageFormatError";
  }
}

function matchesMagic(buffer: Buffer, magic: readonly number[], offset = 0): boolean {
  if (buffer.length < offset + magic.length) return false;
  return magic.every((byte, i) => buffer[offset + i] === byte);
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function isWebp(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

/** Wirft `UnsupportedImageFormatError`, falls der Buffer kein JPEG/PNG/WebP ist (u. a. GIF/TIFF werden bewusst abgelehnt, siehe Datei-Kommentar). */
export function assertSafeImageFormat(buffer: Buffer): void {
  if (matchesMagic(buffer, JPEG_MAGIC) || matchesMagic(buffer, PNG_MAGIC) || isWebp(buffer)) return;
  throw new UnsupportedImageFormatError();
}
