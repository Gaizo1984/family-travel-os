import Link from "next/link";
import { Star, Trash2, Users, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { uploadMemoryPhotos, deleteMemoryPhoto, toggleMemoryHighlight, setCoverPhoto, createMemoryUploadSlots } from "@/lib/actions/memories";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PhotoLightbox } from "@/components/PhotoLightbox";

// §Der Upload selbst ist jetzt schnell (Analyse läuft per after() im
// Hintergrund) — großzügigeres Timeout als zusätzliches Sicherheitsnetz.
export const maxDuration = 60;

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

type PhotoRow = {
  id: string; trip_id: string | null; uploaded_by_person_id: string | null
  storage_path: string; taken_at: string | null; caption: string | null
  is_highlight: boolean; created_at: string
  is_selected: boolean; is_duplicate_of: string | null; quality_score: number | null
};

function PhotoCard({ photo, url, personName, returnTo, isCover }: { photo: PhotoRow; url: string | null; personName: string | null; returnTo: string; isCover: boolean }) {
  if (!url) return null;
  return (
    <div className="relative rounded-lg overflow-hidden group" style={{ aspectRatio: "1/1" }}>
      <PhotoLightbox url={url} alt={photo.caption ?? ""}>
        <SignedPhoto storagePath={photo.storage_path} initialUrl={url} alt={photo.caption ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      </PhotoLightbox>
      <div
        className="absolute inset-0 flex flex-col justify-between p-2"
        style={{ background: "linear-gradient(to bottom, rgba(10,9,7,0.5) 0%, transparent 30%, transparent 70%, rgba(10,9,7,0.7) 100%)", pointerEvents: "none", zIndex: 2 }}
      >
        <div className="flex items-center justify-end gap-1" style={{ pointerEvents: "auto" }}>
          {photo.trip_id && !isCover && (
            <form action={setCoverPhoto}>
              <input type="hidden" name="photo_id" value={photo.id} />
              <input type="hidden" name="trip_id" value={photo.trip_id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button type="submit" aria-label="Als Titelbild verwenden" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px" }}>
                <ImageIcon size={14} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
              </button>
            </form>
          )}
          {isCover && (
            <span aria-label="Aktuelles Titelbild" style={{ display: "flex", padding: "10px", margin: "-6px" }}>
              <ImageIcon size={14} strokeWidth={1.8} fill="#F0EBE3" style={{ color: "#F0EBE3" }} />
            </span>
          )}
          <form action={toggleMemoryHighlight}>
            <input type="hidden" name="photo_id" value={photo.id} />
            <input type="hidden" name="next_value" value={(!photo.is_highlight).toString()} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" aria-label="Highlight" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px" }}>
              <Star size={14} strokeWidth={1.8} fill={photo.is_highlight ? "#F0EBE3" : "none"} style={{ color: "#F0EBE3" }} />
            </button>
          </form>
          <form action={deleteMemoryPhoto}>
            <input type="hidden" name="photo_id" value={photo.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" aria-label="Löschen" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px" }}>
              <Trash2 size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
            </button>
          </form>
        </div>
        {(photo.caption || personName) && (
          <div style={{ color: "#F0EBE3", fontSize: "0.62rem", lineHeight: 1.3 }}>
            {photo.caption}
            {personName && <div style={{ color: "#C9A96E", fontSize: "0.58rem" }}>{personName}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; uploaded?: string; trip?: string }>;
}) {
  const { error, uploaded, trip: tripFilter } = await searchParams;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const returnTo = tripFilter ? `/memories?trip=${tripFilter}` : "/memories";

  const [{ data: photosRaw }, { data: personsRaw }, { data: tripsRaw }] = await Promise.all([
    (() => {
      let query = supabase
        .from("memory_photos")
        .select("id, trip_id, uploaded_by_person_id, storage_path, taken_at, caption, is_highlight, created_at, is_selected, is_duplicate_of, quality_score")
        .eq("family_id", familyId)
        .order("taken_at", { ascending: false, nullsFirst: false });
      if (tripFilter) query = query.eq("trip_id", tripFilter);
      return query;
    })(),
    supabase.from("persons").select("id, name").eq("family_id", familyId),
    supabase.from("trips").select("id, title, cover_photo_id").eq("family_id", familyId).order("start_date", { ascending: false }),
  ]);

  const coverPhotoIds = new Set((tripsRaw ?? []).flatMap((t) => (t.cover_photo_id ? [t.cover_photo_id] : [])));

  const allPhotos = (photosRaw ?? []) as PhotoRow[];
  // §"Maximal 30 Erinnerungsbilder je Reise": nicht ausgewählte Fotos (Dubletten
  // oder außerhalb der KI-Top-30) werden in der Hauptgalerie ausgeblendet, aber
  // nie gelöscht — keine stille Datenlöschung.
  const photos = allPhotos.filter((p) => p.is_selected);
  const hiddenCount = allPhotos.length - photos.length;
  const persons = personsRaw ?? [];
  const trips = tripsRaw ?? [];
  const personNameById = new Map(persons.map((p) => [p.id, p.name]));
  const filteredTripTitle = tripFilter ? trips.find((t) => t.id === tripFilter)?.title ?? null : null;

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { photo: p, url: signed?.signedUrl ?? null };
    }),
  );

  // Highlights: manuell markierte Fotos + je Reise das chronologisch erste und letzte Foto —
  // deterministisch berechnet, kein KI-Aufruf (Leitlinie "KI nur bei echtem Mehrwert").
  const highlightIds = new Set(photos.filter((p) => p.is_highlight).map((p) => p.id));
  const byTrip = new Map<string, PhotoRow[]>();
  for (const p of photos) {
    if (!p.trip_id || !p.taken_at) continue;
    if (!byTrip.has(p.trip_id)) byTrip.set(p.trip_id, []);
    byTrip.get(p.trip_id)!.push(p);
  }
  for (const tripPhotos of byTrip.values()) {
    const sorted = [...tripPhotos].sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""));
    if (sorted[0]) highlightIds.add(sorted[0].id);
    if (sorted[sorted.length - 1]) highlightIds.add(sorted[sorted.length - 1].id);
  }
  const highlightPhotos = photosWithUrls.filter((p) => highlightIds.has(p.photo.id));

  // Nach Jahr gruppieren (taken_at bevorzugt, sonst Upload-Datum).
  const byYear = new Map<number, typeof photosWithUrls>();
  for (const entry of photosWithUrls) {
    const year = new Date(entry.photo.taken_at ?? entry.photo.created_at).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(entry);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

        <header className="mb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Travel Memory
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "-0.01em" }}>
            {filteredTripTitle ? `Erinnerungen: ${filteredTripTitle}` : "Eure gemeinsame Reisegalerie"}
          </h1>
          {tripFilter && (
            <Link href="/memories" style={{ color: "var(--accent)", fontSize: "0.72rem", textDecoration: "none" }}>
              Alle Erinnerungen ansehen →
            </Link>
          )}
        </header>

        {uploaded && <Banner variant="success">{uploaded} Foto(s) gespeichert.</Banner>}
        {error && <Banner variant="error">{error}</Banner>}

        {/* ── Upload ── */}
        <section className="mb-12">
          <DirectPhotoUploadForm action={uploadMemoryPhotos} createSlots={createMemoryUploadSlots} fileInputName="files">
            <input type="hidden" name="family_id" value={familyId} />
            <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="mem-trip" style={LABEL_STYLE}>Reise (optional)</label>
                  <select id="mem-trip" name="trip_id" style={FIELD_STYLE}>
                    <option value="">— keine Zuordnung —</option>
                    {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="mem-person" style={LABEL_STYLE}>Hochgeladen von</label>
                  <select id="mem-person" name="uploaded_by_person_id" style={FIELD_STYLE}>
                    <option value="">— egal —</option>
                    {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="mem-date" style={LABEL_STYLE}>Aufnahmedatum</label>
                  <input id="mem-date" name="taken_at" type="date" style={FIELD_STYLE} />
                </div>
                <div>
                  <label htmlFor="mem-caption" style={LABEL_STYLE}>Bildunterschrift</label>
                  <input id="mem-caption" name="caption" type="text" style={FIELD_STYLE} />
                </div>
              </div>
              <div className="mb-5">
                <label htmlFor="mem-files" style={LABEL_STYLE}>Fotos</label>
                <MultiPhotoFilePreview inputId="mem-files" inputName="files" fieldStyle={FIELD_STYLE} />
              </div>
              <SubmitButtonWithProgress label="Fotos speichern" pendingLabel="Fotos werden gespeichert …" />
            </div>
          </DirectPhotoUploadForm>
        </section>

        {/* ── Highlights ── */}
        {highlightPhotos.length > 0 && (
          <section className="mb-12">
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "12px" }}>
              Highlights
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {highlightPhotos.map(({ photo, url }) => (
                <PhotoCard key={photo.id} photo={photo} url={url} personName={photo.uploaded_by_person_id ? personNameById.get(photo.uploaded_by_person_id) ?? null : null} returnTo={returnTo} isCover={coverPhotoIds.has(photo.id)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Timeline nach Jahr ── */}
        {years.length > 0 ? (
          years.map((year) => (
            <section key={year} className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <Link href={`/memories/yearbook/${year}`} className="text-lg font-light" style={{ color: "var(--foreground)", textDecoration: "none" }}>
                  {year}
                </Link>
                <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{byYear.get(year)!.length} Fotos</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {byYear.get(year)!.map(({ photo, url }) => (
                  <PhotoCard key={photo.id} photo={photo} url={url} personName={photo.uploaded_by_person_id ? personNameById.get(photo.uploaded_by_person_id) ?? null : null} returnTo={returnTo} isCover={coverPhotoIds.has(photo.id)} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Noch keine Erinnerungsfotos hochgeladen — legt oben eure ersten Fotos an.
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Users size={12} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
          <p style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
            Persönliche Ansichten je Familienmitglied unter{" "}
            <Link href="/family" style={{ color: "var(--accent)" }}>Familie → Profil → Erinnerungen</Link>.
          </p>
        </div>

        {hiddenCount > 0 && (
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}>
            {hiddenCount} weitere hochgeladene {hiddenCount === 1 ? "Foto ist" : "Fotos sind"} (Dubletten oder außerhalb der besten 30 je Reise) hier ausgeblendet, aber nicht gelöscht.
          </p>
        )}
      </div>
    </div>
  );
}
