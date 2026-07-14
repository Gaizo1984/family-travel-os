import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  createContentSessionUploadSlots, uploadContentSessionPhotos, analyzeContentSession,
  deleteContentSessionPhotosNow, retainContentSessionPhotoAsMemory,
} from "@/lib/actions/content-sessions";
import { MAX_RETAINED_MEMORIES_PER_TRIP } from "@/lib/content-session-limits";
import { CONTENT_TONALITY_OPTIONS } from "@/lib/ai-style-guidelines";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { SignedPhoto } from "@/components/SignedPhoto";
import { Banner } from "@/components/Banner";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

const CONTENT_FORMAT_OPTIONS = [
  { value: "caption", label: "Instagram-Caption" },
  { value: "carousel", label: "Carousel" },
  { value: "story", label: "Story" },
  { value: "reel", label: "Reel-Konzept" },
  { value: "day_recap", label: "Tagesrückblick" },
  { value: "highlight", label: "Ausflug/Highlight" },
  { value: "hotel_content", label: "Hotel-Content" },
  { value: "package", label: "Content-Paket (alles auf einmal)" },
];

const DRAFT_TYPE_LABELS: Record<string, string> = {
  caption: "Caption", carousel_plan: "Carousel", story_plan: "Story", reel_plan: "Reel",
  day_recap: "Tagesrückblick", highlight: "Ausflug/Highlight", hotel_content: "Hotel-Content",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

export default async function ContentSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string; package?: string }>;
}) {
  const { projectId } = await params;
  const { error, uploaded, package: packageCount } = await searchParams;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("content_projects")
    .select("id, title, trip_id, status, trips(title)")
    .eq("id", projectId)
    .eq("project_type", "session")
    .maybeSingle();

  if (!project) notFound();

  const [{ data: photosRaw }, { data: drafts }, { count: retainedCount }] = await Promise.all([
    supabase
      .from("content_project_photos")
      .select("id, storage_path, temporary, expires_at, retained_as_memory, is_duplicate_of")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("content_drafts")
      .select("id, draft_type, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    project.trip_id
      ? supabase.from("memory_photos").select("id", { count: "exact", head: true }).eq("trip_id", project.trip_id).eq("is_selected", true)
      : Promise.resolve({ count: 0 }),
  ]);

  const photos = (photosRaw ?? []).filter((p) => !p.is_duplicate_of);
  const photosWithUrls = await Promise.all(
    photos.map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl ?? null };
    }),
  );

  const tripTitle = (project.trips as unknown as { title: string } | null)?.title ?? project.title;
  const hasPhotos = photos.length > 0;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/content-studio"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Content Studio
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Content-Session
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {tripTitle}
        </h1>

        {error && <Banner variant="error">{error}</Banner>}
        {uploaded && (
          <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            {uploaded} Foto{uploaded === "1" ? "" : "s"} hochgeladen.
          </p>
        )}
        {packageCount && (
          <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Content-Paket erstellt: {packageCount} Entwürfe, einzeln bearbeitbar (siehe unten).
          </p>
        )}

        {/* ── Upload ── */}
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Fotos {hasPhotos ? `(${photos.length})` : ""}
            </span>
            {hasPhotos && (
              <form action={deleteContentSessionPhotosNow}>
                <input type="hidden" name="project_id" value={projectId} />
                <button
                  type="submit"
                  style={{
                    background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                    borderRadius: "6px", padding: "6px 12px", fontSize: "0.6rem", letterSpacing: "0.08em",
                    textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Temporäre Bilder jetzt löschen
                </button>
              </form>
            )}
          </div>

          <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
            Diese Bilder werden nur zur Content-Erstellung verwendet und automatisch nach 24 Stunden gelöscht --
            nicht dauerhaft als Reisealbum gespeichert.
          </p>

          {photosWithUrls.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
              {photosWithUrls.map((p) => p.url && (
                <div key={p.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                  <SignedPhoto
                    storagePath={p.storage_path} initialUrl={p.url} alt=""
                    className="absolute inset-0 w-full h-full object-cover" loading="lazy"
                  />
                  {p.retained_as_memory ? (
                    <span
                      className="absolute bottom-1 left-1 right-1 text-center rounded"
                      style={{ background: "rgba(10,9,7,0.6)", color: "#F0EBE3", fontSize: "0.55rem", padding: "2px 4px" }}
                    >
                      Als Erinnerung behalten
                    </span>
                  ) : (
                    <form action={retainContentSessionPhotoAsMemory} className="absolute bottom-1 left-1 right-1">
                      <input type="hidden" name="photo_id" value={p.id} />
                      <input type="hidden" name="project_id" value={projectId} />
                      <button
                        type="submit"
                        className="w-full rounded"
                        style={{ background: "rgba(10,9,7,0.55)", color: "#F0EBE3", fontSize: "0.55rem", padding: "3px 4px", border: "none", cursor: "pointer" }}
                      >
                        Als Erinnerung behalten
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {project.trip_id && (
            <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
              {retainedCount ?? 0} von {MAX_RETAINED_MEMORIES_PER_TRIP} dauerhaften Reiseerinnerungen dieser Reise.
            </p>
          )}

          <DirectPhotoUploadForm action={uploadContentSessionPhotos} createSlots={createContentSessionUploadSlots} fileInputName="files">
            <input type="hidden" name="project_id" value={projectId} />
            <label htmlFor="cs-files" style={LABEL_STYLE}>Weitere Fotos hinzufügen (10, 30, 50+ möglich)</label>
            <MultiPhotoFilePreview inputId="cs-files" inputName="files" fieldStyle={FIELD_STYLE} />
            <div className="mt-4 flex justify-end">
              <SubmitButtonWithProgress label="Hochladen" pendingLabel="Fotos werden hochgeladen …" />
            </div>
          </DirectPhotoUploadForm>
        </Card>

        {/* ── Content erstellen ── */}
        {hasPhotos && (
          <div className="mt-6">
            <Card>
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "16px" }}>
                Content erstellen
              </div>
              <form action={analyzeContentSession}>
                <input type="hidden" name="project_id" value={projectId} />

                <div className="mb-5">
                  <label htmlFor="cs-format" style={LABEL_STYLE}>Content-Art *</label>
                  <select id="cs-format" name="output_format" required style={FIELD_STYLE}>
                    <option value="">— auswählen —</option>
                    {CONTENT_FORMAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div>
                    <label htmlFor="cs-language" style={LABEL_STYLE}>Sprache</label>
                    <select id="cs-language" name="language" defaultValue="de" style={FIELD_STYLE}>
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                      <option value="both">Zweisprachig</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cs-tonality" style={LABEL_STYLE}>Tonalität</label>
                    <select id="cs-tonality" name="tonality" defaultValue="" style={FIELD_STYLE}>
                      <option value="">— egal, LUMI wählt passend —</option>
                      {CONTENT_TONALITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <SubmitButtonWithProgress label="Content erstellen →" pendingLabel="LUMI analysiert Fotos …" />
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* ── Bisherige Entwürfe dieser Session ── */}
        {(drafts ?? []).length > 0 && (
          <div className="mt-6">
            <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Entwürfe dieser Session
            </div>
            <div className="space-y-2">
              {(drafts ?? []).map((d) => (
                <Link
                  key={d.id}
                  href={`/content-studio/drafts/${d.id}`}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
                    {DRAFT_TYPE_LABELS[d.draft_type] ?? d.draft_type}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>Bearbeiten →</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
