import Link from "next/link";
import { ChevronLeft, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { WhatCanAI } from "../WhatCanAI";

export default async function ContentIdeasLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  const { archiv } = await searchParams;
  const showArchived = archiv === "1";

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: allIdeas } = await supabase
    .from("content_ideas")
    .select("id, content_goal, status, is_favorite, created_at, trip_id, trips(title)")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });

  const ideas = (allIdeas ?? []).filter((i) => (showArchived ? i.status === "archived" : i.status !== "archived"));
  const archivedCount = (allIdeas ?? []).filter((i) => i.status === "archived").length;

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

        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
            {showArchived ? "Archivierte Ideen" : "Alle Ideen"}
          </h1>
          <Link href="/content-studio/new" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
            + Neue Idee
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <Link
            href="/content-studio/ideas"
            style={{
              fontSize: "0.62rem", letterSpacing: "0.06em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
              color: !showArchived ? "var(--surface)" : "var(--muted)",
              background: !showArchived ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)",
            }}
          >
            Aktiv
          </Link>
          {archivedCount > 0 && (
            <Link
              href="/content-studio/ideas?archiv=1"
              style={{
                fontSize: "0.62rem", letterSpacing: "0.06em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
                color: showArchived ? "var(--surface)" : "var(--muted)",
                background: showArchived ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)",
              }}
            >
              Archiv ({archivedCount})
            </Link>
          )}
        </div>

        {ideas.length === 0 ? (
          showArchived
            ? <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Keine archivierten Ideen.</p>
            : <WhatCanAI />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {ideas.map((idea) => {
              const tripTitle = (idea.trips as unknown as { title: string } | null)?.title;
              return (
                <Link
                  key={idea.id}
                  href={`/content-studio/ideas/${idea.id}`}
                  className="block rounded-xl p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2" style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 400 }}>
                      {idea.is_favorite && <Star size={12} strokeWidth={1.6} fill="var(--accent)" style={{ color: "var(--accent)", flexShrink: 0 }} />}
                      {tripTitle ?? "Reise"}{idea.content_goal ? ` · ${idea.content_goal}` : ""}
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {idea.status === "chosen" ? "Gewählt" : idea.status === "archived" ? "Archiviert" : "Vorschlag"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
