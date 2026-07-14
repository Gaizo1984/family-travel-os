import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  createContentSessionUploadSlots, uploadContentSessionPhotos, analyzeContentSession,
  deleteContentSessionPhotosNow, retainContentSessionPhotoAsMemory, chooseContentSessionFormat,
} from "@/lib/actions/content-sessions";
import { MAX_RETAINED_MEMORIES_PER_TRIP, MAX_PHOTOS_BY_FORMAT, CONTENT_FORMAT_LABELS } from "@/lib/content-session-limits";
import { CONTENT_TONALITY_OPTIONS, CONTENT_FOCUS_OPTIONS, CONTENT_MOOD_OPTIONS } from "@/lib/ai-style-guidelines";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { ChipToggleGroup } from "@/components/ChipToggleGroup";
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

const SELECTABLE_FORMATS = ["carousel", "story", "reel", "day_recap", "highlight", "hotel_content", "package"] as const;

const DRAFT_TYPE_LABELS: Record<string, string> = {
  carousel_plan: "Beitrag", story_plan: "Story", reel_plan: "Reel",
  day_recap: "Tagesrückblick", highlight: "Ausflug/Highlight", hotel_content: "Hotel-Content", caption: "Caption",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

/** Wiederholt sich in drei Formularen (Haupt-Formular + beide Passungs-Abhilfe-Optionen) -- jeweils dieselben zuletzt gespeicherten Werte der Session als Hidden-Felder, damit ein erneuter Klick nichts erneut abfragen muss. */
function GuidedHiddenFields({
  projectId, language, tonality, contentFocus, customFocus, mood, hintText,
}: {
  projectId: string; language: string; tonality: string | null
  contentFocus: string | null; customFocus: string | null; mood: string[]; hintText: string | null
}) {
  return (
    <>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="tonality" value={tonality ?? ""} />
      <input type="hidden" name="content_focus" value={contentFocus ?? ""} />
      <input type="hidden" name="custom_focus" value={customFocus ?? ""} />
      {mood.map((m) => <input key={m} type="hidden" name="mood" value={m} />)}
      <input type="hidden" name="hint_text" value={hintText ?? ""} />
    </>
  );
}

export default async function ContentSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string; package?: string; fit?: string; reason?: string; missing?: string; altfocus?: string }>;
}) {
  const { projectId } = await params;
  const { error, uploaded, package: packageCount, fit, reason, missing, altfocus } = await searchParams;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("content_projects")
    .select("id, title, trip_id, status, output_format, language, tonality, content_focus, custom_focus, mood, hint_text, trips(title)")
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
  const outputFormat = project.output_format;
  const formatLabel = outputFormat ? (CONTENT_FORMAT_LABELS[outputFormat] ?? outputFormat) : null;
  const maxPhotos = outputFormat ? (MAX_PHOTOS_BY_FORMAT[outputFormat] ?? 15) : 15;
  const mood = project.mood ?? [];

  const guidedFieldsProps = {
    projectId, language: project.language ?? "de", tonality: project.tonality,
    contentFocus: project.content_focus, customFocus: project.custom_focus, mood, hintText: project.hint_text,
  };

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

        {error && fit !== "weak" && <Banner variant="error">{error}</Banner>}
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

        {/* ── Schritt 1: Content-Art (muss vor dem Upload feststehen) ── */}
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Content-Art
            </span>
            {formatLabel && (
              <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                Aktuell: <strong style={{ color: "var(--foreground)", fontWeight: 400 }}>{formatLabel}</strong> · max. {maxPhotos} Fotos
              </span>
            )}
          </div>
          <form action={chooseContentSessionFormat} className="flex gap-3 flex-wrap items-end">
            <input type="hidden" name="project_id" value={projectId} />
            <div className="flex-1" style={{ minWidth: "200px" }}>
              <select name="output_format" defaultValue={outputFormat ?? ""} required style={FIELD_STYLE}>
                <option value="">— auswählen —</option>
                {SELECTABLE_FORMATS.map((f) => (
                  <option key={f} value={f}>{CONTENT_FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              style={{
                background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)",
                borderRadius: "6px", padding: "12px 16px", fontSize: "0.65rem", letterSpacing: "0.1em",
                textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
              }}
            >
              {outputFormat ? "Format ändern" : "Übernehmen"}
            </button>
          </form>
          {!outputFormat && (
            <p className="mt-3" style={{ color: "var(--muted)", fontSize: "0.68rem", lineHeight: 1.5 }}>
              Bitte zuerst die Content-Art wählen -- davon hängt ab, wie viele Fotos hochgeladen werden können.
            </p>
          )}
        </Card>

        {/* ── Upload (erst sichtbar, sobald eine Content-Art gewählt ist) ── */}
        {outputFormat && (
          <div className="mt-6" id="cs-upload">
            <Card>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  Fotos {hasPhotos ? `(${photos.length}/${maxPhotos})` : ""}
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
                nicht dauerhaft als Reisealbum gespeichert. Für {formatLabel} können maximal {maxPhotos} Fotos hochgeladen werden.
              </p>

              {error && fit !== "weak" && <Banner variant="error">{error}</Banner>}

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

              {photos.length < maxPhotos ? (
                <DirectPhotoUploadForm action={uploadContentSessionPhotos} createSlots={createContentSessionUploadSlots} fileInputName="files">
                  <input type="hidden" name="project_id" value={projectId} />
                  <label htmlFor="cs-files" style={LABEL_STYLE}>Weitere Fotos hinzufügen (bis zu {maxPhotos - photos.length} weitere möglich)</label>
                  <MultiPhotoFilePreview inputId="cs-files" inputName="files" fieldStyle={FIELD_STYLE} />
                  <div className="mt-4 flex justify-end">
                    <SubmitButtonWithProgress label="Hochladen" pendingLabel="Fotos werden hochgeladen …" />
                  </div>
                </DirectPhotoUploadForm>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                  Limit von {maxPhotos} Fotos für {formatLabel} erreicht.
                </p>
              )}
            </Card>
          </div>
        )}

        {/* ── Passungsprüfung: schwache Passung -> drei Abhilfe-Optionen statt blinder Generierung ── */}
        {fit === "weak" && outputFormat && (
          <div className="mt-6">
            <Card>
              <div style={{ color: "#B5624A", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                Bilder passen nicht ganz zum gewählten Fokus
              </div>
              {reason && <p className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.8rem", lineHeight: 1.5 }}>{reason}</p>}
              {missing && (
                <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
                  Fehlende Motive: {missing}
                </p>
              )}

              <div className="space-y-3">
                <form action={analyzeContentSession}>
                  <GuidedHiddenFields {...guidedFieldsProps} />
                  <input type="hidden" name="force_create" value="1" />
                  <button type="submit" style={{ width: "100%", textAlign: "left", background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", fontSize: "0.78rem", cursor: "pointer" }}>
                    Mit vorhandenem Material erstellen
                  </button>
                </form>

                <a href="#cs-upload" style={{ display: "block", background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", fontSize: "0.78rem", textDecoration: "none" }}>
                  Bilder ergänzen
                </a>

                {altfocus && (
                  <form action={analyzeContentSession}>
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="language" value={project.language ?? "de"} />
                    <input type="hidden" name="tonality" value={project.tonality ?? ""} />
                    <input type="hidden" name="content_focus" value="custom" />
                    <input type="hidden" name="custom_focus" value={altfocus} />
                    {mood.map((m) => <input key={m} type="hidden" name="mood" value={m} />)}
                    <input type="hidden" name="hint_text" value={project.hint_text ?? ""} />
                    <button type="submit" style={{ width: "100%", textAlign: "left", background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", fontSize: "0.78rem", cursor: "pointer" }}>
                      Engeren Fokus wählen: {altfocus}
                    </button>
                  </form>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Content erstellen ── */}
        {hasPhotos && outputFormat && fit !== "weak" && (
          <div className="mt-6">
            <Card>
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "16px" }}>
                Content erstellen -- {formatLabel}
              </div>
              <form action={analyzeContentSession}>
                <input type="hidden" name="project_id" value={projectId} />

                <div className="mb-5">
                  <label style={LABEL_STYLE}>Content-Fokus</label>
                  <ChipToggleGroup name="content_focus" options={CONTENT_FOCUS_OPTIONS} defaultValue={project.content_focus ? [project.content_focus] : []} />
                </div>

                <div className="mb-5">
                  <label htmlFor="cs-custom-focus" style={LABEL_STYLE}>Eigener Fokus (falls oben „Eigener Fokus“ gewählt)</label>
                  <input id="cs-custom-focus" name="custom_focus" type="text" defaultValue={project.custom_focus ?? ""} placeholder="z.B. Sonnenuntergang am Hafen" style={FIELD_STYLE} />
                </div>

                <div className="mb-5">
                  <label style={LABEL_STYLE}>Stimmung oder Besonderheit (optional)</label>
                  <ChipToggleGroup name="mood" options={CONTENT_MOOD_OPTIONS} multiple defaultValue={mood} />
                </div>

                <div className="mb-5">
                  <label htmlFor="cs-hint" style={LABEL_STYLE}>Was war heute besonders oder soll LUMI berücksichtigen? (optional)</label>
                  <textarea id="cs-hint" name="hint_text" rows={2} defaultValue={project.hint_text ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div>
                    <label htmlFor="cs-language" style={LABEL_STYLE}>Sprache</label>
                    <select id="cs-language" name="language" defaultValue={project.language ?? "de"} style={FIELD_STYLE}>
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                      <option value="both">Zweisprachig</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cs-tonality" style={LABEL_STYLE}>Tonalität</label>
                    <select id="cs-tonality" name="tonality" defaultValue={project.tonality ?? ""} style={FIELD_STYLE}>
                      <option value="">— egal, LUMI wählt passend —</option>
                      {CONTENT_TONALITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <SubmitButtonWithProgress
                    label="Content erstellen →"
                    pendingLabel="LUMI analysiert Bilder, wählt die stärksten aus und formuliert den Text …"
                  />
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
