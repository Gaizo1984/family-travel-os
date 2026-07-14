import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star, Archive, ArchiveRestore, Trash2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  createContentDraftFromIdea, toggleFavoriteContentIdea, archiveContentIdea,
  unarchiveContentIdea, deleteContentIdea,
} from "@/lib/actions/content-ideas";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";

type Suggestion = {
  title: string; format: string; hook: string; angle: string
  caption_draft: string; hashtags: string[]
};

// §"caption"/"feed_post" werden nicht mehr neu erzeugt (Caption ist kein
// eigenständiges Format mehr, siehe Story-Vereinheitlichung) -- Mapping
// bleibt nur für bereits bestehende ältere Vorschläge erhalten.
const FORMAT_LABELS: Record<string, string> = {
  reel: "Reel", carousel: "Beitrag", story: "Story", caption: "Story", feed_post: "Story",
};

export default async function ContentIdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ideaId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { ideaId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: idea } = await supabase
    .from("content_ideas")
    .select("id, project_id, suggestions, content_goal, chosen_index, source_input_text, trip_id, status, is_favorite, reasoning, trips(title)")
    .eq("id", ideaId)
    .maybeSingle();

  if (!idea) notFound();

  const suggestions = idea.suggestions as unknown as Suggestion[];
  const tripTitle = (idea.trips as unknown as { title: string } | null)?.title;
  const returnTo = `/content-studio/ideas/${idea.id}`;

  const { data: selectedPhotosRaw } = idea.project_id
    ? await supabase
        .from("content_project_photos")
        .select("id, storage_path, quality_score")
        .eq("project_id", idea.project_id)
        .eq("is_selected", true)
        .order("quality_score", { ascending: false })
    : { data: null };

  // §"Dublettenerkennung sichtbar machen": läuft bereits (is_duplicate_of),
  // wurde bisher aber nirgends kommuniziert — analog zu app/memories/page.tsx.
  const { count: duplicateCount } = idea.project_id
    ? await supabase
        .from("content_project_photos")
        .select("id", { count: "exact", head: true })
        .eq("project_id", idea.project_id)
        .not("is_duplicate_of", "is", null)
    : { count: 0 };

  const selectedPhotos = await Promise.all(
    (selectedPhotosRaw ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { id: p.id, url: signed?.signedUrl ?? null, storagePath: p.storage_path, qualityScore: p.quality_score };
    }),
  );

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/content-studio/ideas"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Alle Ideen
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-2">
          <div>
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
              {tripTitle ?? "Content-Idee"}{idea.status === "archived" && " · Archiviert"}
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
              {suggestions.length} Vorschläge
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <form action={toggleFavoriteContentIdea}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="next_value" value={(!idea.is_favorite).toString()} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button
                type="submit"
                aria-label={idea.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px" }}
              >
                <Star size={16} strokeWidth={1.6} fill={idea.is_favorite ? "var(--accent)" : "none"} style={{ color: "var(--accent)" }} />
              </button>
            </form>
            <form action={idea.status === "archived" ? unarchiveContentIdea : archiveContentIdea}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="return_to" value={idea.status === "archived" ? returnTo : "/content-studio/ideas"} />
              <button
                type="submit"
                aria-label={idea.status === "archived" ? "Wiederherstellen" : "Archivieren"}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px", color: "var(--muted)" }}
              >
                {idea.status === "archived" ? <ArchiveRestore size={16} strokeWidth={1.6} /> : <Archive size={16} strokeWidth={1.6} />}
              </button>
            </form>
            <form action={deleteContentIdea}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="return_to" value="/content-studio/ideas" />
              <button
                type="submit"
                aria-label="Idee löschen"
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px", color: "#B5624A" }}
              >
                <Trash2 size={16} strokeWidth={1.6} />
              </button>
            </form>
          </div>
        </div>

        {idea.reasoning && (
          <div className="flex items-start gap-2 mb-8 p-4 rounded-lg" style={{ background: "var(--accent-subtle)" }}>
            <Sparkles size={13} strokeWidth={1.6} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
            <p style={{ color: "var(--foreground)", fontSize: "0.78rem", lineHeight: 1.5 }}>{idea.reasoning}</p>
          </div>
        )}

        {selectedPhotos.length > 0 && (
          <div className="mb-8">
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>
              Ausgewählte Motive
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedPhotos.map((p) => (
                p.url && (
                  <div key={p.id} className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 96, height: 96 }}>
                    <SignedPhoto storagePath={p.storagePath} initialUrl={p.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    {p.qualityScore !== null && (
                      <span
                        className="absolute bottom-1 right-1"
                        style={{ color: "#F0EBE3", fontSize: "0.58rem", background: "rgba(10,9,7,0.6)", padding: "1px 6px", borderRadius: "10px" }}
                      >
                        {p.qualityScore}/10
                      </span>
                    )}
                  </div>
                )
              ))}
            </div>
            {!!duplicateCount && (
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}>
                {duplicateCount} {duplicateCount === 1 ? "Dublette" : "Dubletten"} automatisch erkannt und ausgeblendet.
              </p>
            )}
          </div>
        )}

        {error && (
          <Banner variant="error">
            {error}
          </Banner>
        )}

        <div className="grid grid-cols-1 gap-4">
          {suggestions.map((s, idx) => (
            <div key={idx} className="rounded-xl p-6" style={{ background: "var(--surface)", border: idx === idea.chosen_index ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="text-base font-light" style={{ color: "var(--foreground)" }}>{s.title}</h2>
                <span style={{ color: "var(--accent)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {FORMAT_LABELS[s.format] ?? s.format}
                </span>
              </div>
              <p className="mb-2 italic" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>„{s.hook}"</p>
              <p className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>{s.angle}</p>
              <p className="mb-3 leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.74rem" }}>{s.caption_draft}</p>
              {s.hashtags.length > 0 && (
                <p className="mb-4" style={{ color: "var(--accent)", fontSize: "0.68rem" }}>
                  {s.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
              <form action={createContentDraftFromIdea}>
                <input type="hidden" name="idea_id" value={idea.id} />
                <input type="hidden" name="suggestion_index" value={idx} />
                <button
                  type="submit"
                  style={{
                    background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                    borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Weiterentwickeln →
                </button>
              </form>
            </div>
          ))}
        </div>

        <p className="mt-8" style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}>
          KI-generierte Vorschläge auf Basis eurer echten Reisedaten — vor Veröffentlichung immer prüfen und anpassen.
        </p>
      </div>
    </div>
  );
}
