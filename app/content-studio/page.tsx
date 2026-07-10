import Link from "next/link";
import { ArrowRight, Sparkles, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ContentStudioPage() {
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const familyId = family?.id ?? "";

  const { data: activeProject } = await supabase
    .from("content_projects")
    .select("id, title, trip_id, trips(title)")
    .eq("family_id", familyId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ideaCount = 0;
  let draftCount = 0;
  if (activeProject) {
    const [{ count: ic }, { count: dc }] = await Promise.all([
      supabase.from("content_ideas").select("id", { count: "exact", head: true }).eq("project_id", activeProject.id),
      supabase.from("content_drafts").select("id", { count: "exact", head: true }).eq("project_id", activeProject.id),
    ]);
    ideaCount = ic ?? 0;
    draftCount = dc ?? 0;
  }

  const { data: recentIdeas } = await supabase
    .from("content_ideas")
    .select("id, content_goal, status, trip_id, trips(title)")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
              Content Studio
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              Aus euren Reisen wird Erzählung.
            </h1>
          </div>
          <Link href="/content-studio/settings" style={{ color: "var(--muted)" }}>
            <Settings size={16} strokeWidth={1.5} />
          </Link>
        </div>

        {activeProject && (
          <Link
            href={`/content-studio/projects/${activeProject.id}`}
            className="block rounded-xl p-6 mb-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
          >
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "6px" }}>
              Aktives Projekt
            </div>
            <div className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.05rem" }}>
              {(activeProject.trips as unknown as { title: string } | null)?.title ?? activeProject.title}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              {ideaCount} {ideaCount === 1 ? "Idee" : "Ideen"} · {draftCount} {draftCount === 1 ? "Draft" : "Drafts"}
            </p>
          </Link>
        )}

        <Link
          href="/content-studio/new"
          className="block rounded-xl p-7 mb-8"
          style={{ background: "var(--foreground)", textDecoration: "none" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={16} strokeWidth={1.5} style={{ color: "var(--surface)" }} />
            <span style={{ color: "var(--surface)", fontSize: "1rem", fontWeight: 400 }}>Content-Idee erstellen</span>
          </div>
          <p style={{ color: "var(--surface)", opacity: 0.7, fontSize: "0.76rem" }}>
            Reise auswählen, optional ein Foto — die KI entwickelt 3–5 konkrete Vorschläge.
          </p>
        </Link>

        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Zuletzt entwickelt
          </h2>
          <Link href="/content-studio/ideas" style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.08em", textDecoration: "none" }}>
            Alle Ideen ansehen →
          </Link>
        </div>

        {(recentIdeas ?? []).length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.76rem" }}>Noch keine Content-Ideen entwickelt.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {(recentIdeas ?? []).map((idea) => (
              <Link
                key={idea.id}
                href={`/content-studio/ideas/${idea.id}`}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
              >
                <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
                  {(idea.trips as unknown as { title: string } | null)?.title ?? "Reise"}{idea.content_goal ? ` · ${idea.content_goal}` : ""}
                </span>
                <ArrowRight size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
