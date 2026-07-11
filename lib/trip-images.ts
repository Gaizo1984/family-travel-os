import type { SupabaseClient } from "@supabase/supabase-js";
import { DESTINATIONS } from "@/lib/data/destination-knowledge";

/**
 * Einzige Quelle der Wahrheit für kuratierte Reisebilder. War zuvor
 * unabhängig in app/page.tsx, app/trips/page.tsx und app/trips/[id]/page.tsx
 * dupliziert und dadurch bereits auseinandergelaufen (z. B. indonesien-2028
 * zeigte auf der Trips-Liste ein anderes Foto als auf Dashboard/Detail).
 */
export const TRIP_IMAGES: Record<string, string> = {
  "costa-rica-2026":
    "https://images.unsplash.com/photo-1611222566512-cb8dd8e689e5?auto=format&fit=crop&w=1920&q=80",
  "indonesien-2028":
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80",
  "japan-2025":
    "https://images.unsplash.com/photo-1757220306353-2282322ac464?auto=format&fit=crop&w=900&q=80",
  "sardinien-2024":
    "https://images.unsplash.com/photo-1780581800373-4fd4961743cd?auto=format&fit=crop&w=900&q=80",
};

export type TripImageInput = { slug: string; title: string };

/**
 * §"Neue Reisen ohne kuratiertes Bild und ohne Highlight-Foto zeigen nur
 * einen schlichten Farbverlauf": Bildauflösung mit drei Stufen vor dem
 * Gradient-Fallback — Highlight-Erinnerungsfoto (Familie hat selbst
 * hochgeladen) → fest kuratiertes TRIP_IMAGES-Bild → zum Reisetitel
 * passendes Destination-Foto (gleiche Namens-Abgleich-Technik wie im
 * Buchungsportal) → Gradient (vom Aufrufer gerendert, wenn diese Funktion
 * `null` zurückgibt).
 */
export function resolveTripImage(trip: TripImageInput, highlightUrl: string | null): string | null {
  if (highlightUrl) return highlightUrl;
  if (TRIP_IMAGES[trip.slug]) return TRIP_IMAGES[trip.slug];
  const destinationMatch = DESTINATIONS.find((d) => trip.title.toLowerCase().includes(d.name.toLowerCase()));
  return destinationMatch?.photo ?? null;
}

/**
 * Lädt je Reise das erste als Highlight markierte Erinnerungsfoto (falls
 * vorhanden) und löst es zu einer signierten URL auf. Gemeinsam genutzt von
 * Dashboard, Trips-Liste und Reisedetail, damit alle drei Seiten dasselbe
 * Bild für dieselbe Reise zeigen.
 */
export async function getHighlightPhotoByTripId(
  supabase: SupabaseClient,
  familyId: string,
  tripIds?: string[],
): Promise<Map<string, string>> {
  let query = supabase
    .from("memory_photos")
    .select("trip_id, storage_path")
    .eq("family_id", familyId)
    .eq("is_highlight", true)
    .not("trip_id", "is", null);
  if (tripIds) query = query.in("trip_id", tripIds);
  const { data: highlightPhotosRaw } = await query;

  const highlightPhotoByTripId = new Map<string, string>();
  for (const p of highlightPhotosRaw ?? []) {
    if (!p.trip_id || highlightPhotoByTripId.has(p.trip_id)) continue;
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) highlightPhotoByTripId.set(p.trip_id, signed.signedUrl);
  }
  return highlightPhotoByTripId;
}
