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
    "https://images.unsplash.com/photo-1611222566512-cb8dd8e689e5?auto=format&fit=crop&w=1200&q=80",
  "indonesien-2028":
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
  "japan-2025":
    "https://images.unsplash.com/photo-1757220306353-2282322ac464?auto=format&fit=crop&w=900&q=80",
  "sardinien-2024":
    "https://images.unsplash.com/photo-1780581800373-4fd4961743cd?auto=format&fit=crop&w=900&q=80",
};

export type TripImageInput = { slug: string; title: string };

/** `storagePath` ist nur gesetzt, wenn das Bild aus unserem Supabase-Storage
 *  kommt (Highlight-Erinnerungsfoto) — nur dann kann components/SignedPhoto.tsx
 *  bei einem Ladefehler ein frisches Signed-URL-Token nachfordern. */
export type ResolvedTripImage = { url: string; storagePath: string | null };
type HighlightPhoto = { url: string; storagePath: string };

/**
 * §"Neue Reisen ohne kuratiertes Bild und ohne Highlight-Foto zeigen nur
 * einen schlichten Farbverlauf": Bildauflösung mit drei Stufen vor dem
 * Gradient-Fallback — Highlight-Erinnerungsfoto (Familie hat selbst
 * hochgeladen) → fest kuratiertes TRIP_IMAGES-Bild → zum Reisetitel
 * passendes Destination-Foto (gleiche Namens-Abgleich-Technik wie im
 * Buchungsportal) → Gradient (vom Aufrufer gerendert, wenn diese Funktion
 * `null` zurückgibt).
 */
export function resolveTripImage(trip: TripImageInput, highlight: HighlightPhoto | null): ResolvedTripImage | null {
  if (highlight) return { url: highlight.url, storagePath: highlight.storagePath };
  if (TRIP_IMAGES[trip.slug]) return { url: TRIP_IMAGES[trip.slug], storagePath: null };
  const destinationMatch = DESTINATIONS.find((d) => trip.title.toLowerCase().includes(d.name.toLowerCase()));
  return destinationMatch ? { url: destinationMatch.photo, storagePath: null } : null;
}

/**
 * Löst je Reise das anzuzeigende Erinnerungsfoto auf und signiert es.
 * Gemeinsam genutzt von Dashboard, Trips-Liste und Reisedetail, damit alle
 * drei Seiten dasselbe Bild für dieselbe Reise zeigen. Priorität:
 * 1) explizit vom Nutzer gewähltes Titelbild (trips.cover_photo_id),
 * 2) sonst das erste als Highlight markierte Foto (bisheriges Verhalten).
 */
export async function getHighlightPhotoByTripId(
  supabase: SupabaseClient,
  familyId: string,
  tripIds?: string[],
): Promise<Map<string, HighlightPhoto>> {
  // 1) Explizite Titelbild-Wahl hat Vorrang vor jeder automatischen Auswahl.
  let tripsQuery = supabase.from("trips").select("id, cover_photo_id").eq("family_id", familyId).not("cover_photo_id", "is", null);
  if (tripIds) tripsQuery = tripsQuery.in("id", tripIds);
  const { data: tripsWithCover } = await tripsQuery;

  const coverPhotoIdByTripId = new Map<string, string>();
  for (const t of tripsWithCover ?? []) {
    if (t.cover_photo_id) coverPhotoIdByTripId.set(t.id, t.cover_photo_id);
  }

  const coverPhotoIds = Array.from(coverPhotoIdByTripId.values());
  const coverStoragePathByPhotoId = new Map<string, string>();
  if (coverPhotoIds.length > 0) {
    const { data: coverPhotosRaw } = await supabase.from("memory_photos").select("id, storage_path").in("id", coverPhotoIds);
    for (const p of coverPhotosRaw ?? []) coverStoragePathByPhotoId.set(p.id, p.storage_path);
  }

  // 2) Für Reisen ohne explizites Titelbild: erstes Highlight-Foto (bisheriges Verhalten).
  let highlightQuery = supabase
    .from("memory_photos")
    .select("trip_id, storage_path")
    .eq("family_id", familyId)
    .eq("is_highlight", true)
    .not("trip_id", "is", null);
  if (tripIds) highlightQuery = highlightQuery.in("trip_id", tripIds.filter((id) => !coverPhotoIdByTripId.has(id)));
  const { data: highlightPhotosRaw } = await highlightQuery;

  const firstHighlightByTripId = new Map<string, string>();
  for (const p of highlightPhotosRaw ?? []) {
    if (!p.trip_id || coverPhotoIdByTripId.has(p.trip_id) || firstHighlightByTripId.has(p.trip_id)) continue;
    firstHighlightByTripId.set(p.trip_id, p.storage_path);
  }

  // 3) Alle Signaturen (Titelbilder + Highlight-Fallbacks) parallel erzeugen.
  const highlightPhotoByTripId = new Map<string, HighlightPhoto>();
  await Promise.all([
    ...Array.from(coverPhotoIdByTripId.entries()).map(async ([tripId, photoId]) => {
      const storagePath = coverStoragePathByPhotoId.get(photoId);
      if (!storagePath) return;
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(storagePath, 3600);
      if (signed?.signedUrl) highlightPhotoByTripId.set(tripId, { url: signed.signedUrl, storagePath });
    }),
    ...Array.from(firstHighlightByTripId.entries()).map(async ([tripId, storagePath]) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(storagePath, 3600);
      if (signed?.signedUrl) highlightPhotoByTripId.set(tripId, { url: signed.signedUrl, storagePath });
    }),
  ]);
  return highlightPhotoByTripId;
}
