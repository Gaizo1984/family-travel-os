import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import { getFamily } from "@/lib/family";
import { getHouseholdMemberById, deriveInitials } from "@/lib/household-members";
import { getPhotoDisplayUrl, getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { uploadMemoryPhotos, createMemoryUploadSlots, deleteMemoryPhoto } from "@/lib/actions/memories";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PhotoLightbox } from "@/components/PhotoLightbox";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

/**
 * §Bugfix "Reisegeschichte ist fehlgeleitet" (Nutzer-Feedback): bisher
 * existierte für past_trips (manuell erfasste, vor LUMI erlebte Reisen wie
 * "Malediven 2021") keine eigene Leseansicht -- jeder Link (Reisegeschichte-
 * Liste, Unsere Welt, Reisen-Übersicht, Erinnerungen-Galerie) führte direkt
 * auf die Bearbeiten-Seite. Diese neue Seite ist die fehlende Detailansicht;
 * "Bearbeiten" bleibt als expliziter, separater Schritt erreichbar.
 *
 * §"Man kann keine Flüge/Aktivitäten anlegen" (Nutzer-Feedback): kein Bug --
 * past_trips sind bewusst eine schlanke, von `trips` komplett getrennte
 * Datenform ohne Buchungen/Etappen/Journey (siehe lib/travel-world.ts,
 * supabase/migrations/20260711000013_phase7_family_content_ideas.sql). Diese
 * Seite macht das jetzt sichtbar, statt die Erwartung stillschweigend zu
 * enttäuschen.
 *
 * §Bugfix "Fotos aus Travel Memory sind hier nicht zuordenbar" (Nutzer-
 * Feedback): past_trips hatten bisher nur EIN einzelnes Titelbild
 * (`photo_storage_path`, siehe Bearbeiten-Seite) -- `memory_photos` konnte
 * strukturell nie auf eine past_trip zeigen. Jetzt zusätzlich eine echte
 * Mehrfoto-Galerie über `memory_photos.past_trip_id` (Migration
 * 20260803000003), direkt von hier hoch- oder zuordenbar.
 */
export default async function PastTripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ pastTripId: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string }>;
}) {
  const { pastTripId } = await params;
  const { error, uploaded } = await searchParams;
  const returnTo = `/family/history/${pastTripId}`;

  const lumiCore = await createLumiCoreClient();
  const { id: familyId } = await getFamily();
  const { data: pastTrip } = await lumiCore
    .from("travel_past_trips")
    .select("id, household_id, country_or_region, year, places, duration_days, note, photo_storage_path")
    .eq("id", pastTripId)
    .maybeSingle();

  if (!pastTrip) notFound();

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings zwischen travel_*-Tabellen --
  // flache Abfrage (travel_past_trip_travelers -> household_members) statt
  // verschachteltem Select, exakt wie lib/travel-world.ts::fetchTravelWorldRawData.
  const [{ data: travelerLinks }, { data: galleryPhotosRaw }] = await Promise.all([
    lumiCore.from("travel_past_trip_travelers").select("household_member_id").eq("past_trip_id", pastTripId),
    lumiCore
      .from("travel_memory_photos")
      .select("id, storage_path, caption")
      .eq("past_trip_id", pastTripId)
      .order("sort_order", { ascending: true })
      .order("taken_at", { ascending: false, nullsFirst: false }),
  ]);
  const travelerIds = (travelerLinks ?? []).map((t) => t.household_member_id);
  const travelerMembers = await Promise.all(travelerIds.map((id) => getHouseholdMemberById(id)));
  const travelers = travelerMembers
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => ({ id: m.id, name: m.name, initials: deriveInitials(m.name), color: m.color }));

  const galleryPhotos = galleryPhotosRaw ?? [];
  const galleryUrlByPath = await getPhotoDisplayUrls(LUMI_CORE_DOCUMENTS_BUCKET, galleryPhotos.map((p) => p.storage_path), "thumb400");
  const galleryWithUrls = galleryPhotos.map((p) => {
    const resolved = galleryUrlByPath.get(p.storage_path);
    return { photo: p, url: resolved?.url ?? null, resolvedPath: resolved?.resolvedPath ?? p.storage_path };
  });

  const photoUrl = pastTrip.photo_storage_path
    ? (await getPhotoDisplayUrl(LUMI_CORE_DOCUMENTS_BUCKET, pastTrip.photo_storage_path, "thumb800"))?.url ?? null
    : null;

  const subtitle = [pastTrip.places, pastTrip.duration_days ? `${pastTrip.duration_days} Tage` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family/history"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Reisegeschichte
        </Link>

        <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={pastTrip.country_or_region} className="w-full" style={{ maxHeight: 340, objectFit: "cover" }} />
          ) : (
            <div className="w-full flex items-center justify-center" style={{ height: 160, background: "linear-gradient(135deg, #1a1a1a, #333)" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Kein Foto hinterlegt</span>
            </div>
          )}

          <div className="p-6 md:p-8">
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
              Erlebt · {pastTrip.year} · Manuell erfasst
            </div>
            <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {pastTrip.country_or_region}
            </h1>
            {subtitle && (
              <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{subtitle}</p>
            )}

            {travelers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {travelers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    <span
                      className="inline-flex items-center justify-center rounded-full"
                      style={{ width: "18px", height: "18px", background: p.color, color: "#fff", fontSize: "0.55rem" }}
                    >
                      {p.initials}
                    </span>
                    <span style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>{p.name}</span>
                  </div>
                ))}
              </div>
            )}

            {pastTrip.note && (
              <p className="mb-6" style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                {pastTrip.note}
              </p>
            )}

            <div
              className="rounded-lg px-4 py-3 mb-6"
              style={{ background: "rgba(184,154,94,0.08)", border: "1px solid rgba(184,154,94,0.25)" }}
            >
              <p style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
                Diese Reise wurde vor der Nutzung von LUMI unternommen und manuell erfasst — Flüge, Aktivitäten, Buchungen und Tagesplanung
                sind für solche Einträge nicht verfügbar. Land/Region, Jahr, Reisende, ein Titelbild, eine Notiz und beliebig viele
                Erinnerungsfotos werden gespeichert.
              </p>
            </div>

            <Link
              href={`/family/history/${pastTrip.id}/edit`}
              className="inline-flex items-center gap-2"
              style={{
                background: "var(--foreground)", color: "var(--surface)", border: "none",
                borderRadius: "6px", padding: "10px 18px", fontSize: "0.65rem", letterSpacing: "0.14em",
                textTransform: "uppercase", textDecoration: "none",
              }}
            >
              <Pencil size={12} strokeWidth={1.8} />
              Bearbeiten
            </Link>
          </div>
        </div>

        {/* ── Erinnerungsfotos (Travel Memory) ── */}
        <div className="rounded-xl p-6 md:p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Erinnerungsfotos
          </div>

          {uploaded && <Banner variant="success">{uploaded} Foto(s) gespeichert.</Banner>}
          {error && <Banner variant="error">{error}</Banner>}

          <DirectPhotoUploadForm action={uploadMemoryPhotos} createSlots={createMemoryUploadSlots} fileInputName="files">
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="past_trip_id" value={pastTrip.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <div className="mb-4">
              <label htmlFor="pt-caption" style={LABEL_STYLE}>Notiz (optional)</label>
              <input id="pt-caption" name="caption" type="text" style={FIELD_STYLE} />
            </div>
            <div className="mb-4">
              <label htmlFor="pt-files" style={LABEL_STYLE}>Fotos</label>
              <MultiPhotoFilePreview inputId="pt-files" inputName="files" fieldStyle={FIELD_STYLE} />
            </div>
            <SubmitButtonWithProgress label="Fotos speichern" pendingLabel="Fotos werden gespeichert …" />
          </DirectPhotoUploadForm>

          {galleryWithUrls.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
              {galleryWithUrls.map(({ photo, url, resolvedPath }) => {
                if (!url) return null;
                return (
                  <div key={photo.id} className="relative rounded-lg overflow-hidden group" style={{ aspectRatio: "1/1" }}>
                    <PhotoLightbox url={url} alt={photo.caption ?? ""}>
                      <SignedPhoto storagePath={resolvedPath} initialUrl={url} alt={photo.caption ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    </PhotoLightbox>
                    <form
                      action={deleteMemoryPhoto}
                      className="absolute top-1 right-1"
                      style={{ zIndex: 2 }}
                    >
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button type="submit" aria-label="Löschen" style={{ background: "rgba(10,9,7,0.5)", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", padding: "6px" }}>
                        <Trash2 size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
