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
