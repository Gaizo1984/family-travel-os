import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createContentDraftFromIdea } from "@/lib/actions/content-ideas";

type Suggestion = {
  title: string; format: string; hook: string; angle: string
  caption_draft: string; hashtags: string[]
};

const FORMAT_LABELS: Record<string, string> = {
  reel: "Reel", carousel: "Carousel", story: "Story-Serie", caption: "Feed-Post",
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
    .select("id, suggestions, content_goal, chosen_index, source_input_text, trip_id, trips(title)")
    .eq("id", ideaId)
    .maybeSingle();

  if (!idea) notFound();

  const suggestions = idea.suggestions as unknown as Suggestion[];
  const tripTitle = (idea.trips as unknown as { title: string } | null)?.title;

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          {tripTitle ?? "Content-Idee"}
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {suggestions.length} Vorschläge
        </h1>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-lg"
            style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
          >
            {error}
          </div>
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
