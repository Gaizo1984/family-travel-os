import type { SupabaseClient } from "@supabase/supabase-js";
import { getPhotoDisplayUrl } from "@/lib/photo-thumbnails";

/**
 * Etappen-/Ziel-Bilder über das echte ISO-Länderkürzel (stages.country_code)
 * ausgewählt — nicht über Listenposition. Geteilt zwischen der Reisedetailseite
 * und der Heute-Seite, damit ein Ziel überall dasselbe Bild zeigt.
 */
export const COUNTRY_STAGE_IMAGES: Record<string, string> = {
  CR: "https://images.unsplash.com/photo-1581129724980-2ab2153c3d8d?auto=format&fit=crop&w=800&q=80", // Costa Rica
  ID: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80", // Indonesien/Bali
  AE: "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=800&q=80", // Dubai/VAE
  IT: "https://images.unsplash.com/photo-1780581800373-4fd4961743cd?auto=format&fit=crop&w=800&q=80", // Sardinien/Italien
}
export const FALLBACK_STAGE_IMAGE = "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80"

export type ResolvedStageImage = { url: string; storagePath: string | null }
type StageForImage = { id: string; country_code?: string | null; cover_photo_id?: string | null }

/**
 * §"Bei Etappen werden falsche Bilder dargestellt": COUNTRY_STAGE_IMAGES
 * kennt nur eine Handvoll kuratierter Länder -- jede andere Etappe bekam
 * bisher immer dasselbe generische Ersatzbild. Löst das strukturell über ein
 * explizit wählbares Etappen-Titelbild (stages.cover_photo_id, gleiche
 * Bauart wie trips.cover_photo_id in lib/trip-images.ts), mit Vorrang vor
 * der automatischen Länder-Zuordnung. Geteilt zwischen Reisedetailseite und
 * Heute-Seite, damit eine Etappe überall dasselbe Bild zeigt.
 */
export async function resolveStageImages(
  supabase: SupabaseClient,
  stages: StageForImage[],
): Promise<Map<string, ResolvedStageImage>> {
  const result = new Map<string, ResolvedStageImage>()

  const coverPhotoIds = stages.flatMap((s) => (s.cover_photo_id ? [s.cover_photo_id] : []))
  const storagePathByPhotoId = new Map<string, string>()
  if (coverPhotoIds.length > 0) {
    const { data } = await supabase.from("memory_photos").select("id, storage_path").in("id", coverPhotoIds)
    for (const p of data ?? []) storagePathByPhotoId.set(p.id, p.storage_path)
  }

  await Promise.all(stages.map(async (s) => {
    if (s.cover_photo_id) {
      const storagePath = storagePathByPhotoId.get(s.cover_photo_id)
      if (storagePath) {
        // §"Egress-Analyse 2026-07-16": Karten-Vorschau statt volles Original + gecachte Signed URL.
        const resolved = await getPhotoDisplayUrl("documents", storagePath, "thumb800")
        if (resolved) {
          result.set(s.id, { url: resolved.url, storagePath: resolved.resolvedPath })
          return
        }
      }
    }
    const fallbackUrl = (s.country_code && COUNTRY_STAGE_IMAGES[s.country_code]) || FALLBACK_STAGE_IMAGE
    result.set(s.id, { url: fallbackUrl, storagePath: null })
  }))

  return result
}
