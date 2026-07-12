import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const DRAFT_TYPE_LABELS: Record<string, string> = {
  reel_plan: "Reel-Plan", carousel_plan: "Carousel-Plan", caption: "Caption", journal_review: "Reisejournal",
};

export default async function ContentProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("content_projects")
    .select("id, title, status, trip_id, trips(title)")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: ideas }, { data: drafts }] = await Promise.all([
    supabase.from("content_ideas").select("id, content_goal, status, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("content_drafts").select("id, draft_type, visibility, scheduled_at, notes").eq("project_id", projectId).order("created_at", { ascending: false }),
  ]);

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
          Projekt
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {project.title}
        </h1>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Ideen{(ideas ?? []).length > 0 ? ` · ${(ideas ?? []).length}` : ""}
            </h2>
          </div>
          {(ideas ?? []).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.74rem" }}>Noch keine Ideen in diesem Projekt.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {(ideas ?? []).map((idea) => (
                <Link key={idea.id} href={`/content-studio/ideas/${idea.id}`} className="block rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
                  <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>{idea.content_goal ?? "Content-Idee"}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.65rem", marginLeft: "8px" }}>{idea.status === "chosen" ? "· gewählt" : "· Vorschlag"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Drafts{(drafts ?? []).length > 0 ? ` · ${(drafts ?? []).length}` : ""}
          </h2>
          {(drafts ?? []).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.74rem" }}>Noch keine Drafts weiterentwickelt.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {(drafts ?? []).map((draft) => (
                <Link key={draft.id} href={`/content-studio/drafts/${draft.id}`} className="block rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>{DRAFT_TYPE_LABELS[draft.draft_type] ?? draft.draft_type}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.6rem", textTransform: "uppercase" }}>{draft.visibility}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
