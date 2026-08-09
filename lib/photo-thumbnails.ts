export {
  getPhotoDisplayUrl,
  getPhotoDisplayUrls,
  type PhotoVariant,
  type PhotoDisplayUrl,
  type ThumbnailSize,
} from '@/lib/lumi-core-storage/photo-thumbnails'

/**
 * FINALER CUTOVER: delegiert vollständig an
 * lib/lumi-core-storage/photo-thumbnails.ts (identische Logik, jetzt
 * gegen den Lumi-Core-Bucket). Re-Export statt Duplikat, damit kein
 * Aufrufer (~8 Dateien) seinen Import-Pfad ändern muss.
 */
