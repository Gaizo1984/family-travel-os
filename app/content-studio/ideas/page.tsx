import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ContentIdeasLibraryPage() {
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const { data: ideas } = await supabase
    .from("content_ideas")
    .select("id, content_goal, status, created_at, trip_id, trips(title)")
    .eq("family_id", family?.id ?? "")
    .order("created_at", { ascending: false });

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

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
            Alle Ideen
          </h1>
          <Link href="/content-studio/new" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
            + Neue Idee
          </Link>
        </div>

        {(ideas ?? []).length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Noch keine Content-Ideen entwickelt.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {(ideas ?? []).map((idea) => {
              const tripTitle = (idea.trips as unknown as { title: string } | null)?.title;
              return (
                <Link
                  key={idea.id}
                  href={`/content-studio/ideas/${idea.id}`}
                  className="block rounded-xl p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 400 }}>
                      {tripTitle ?? "Reise"}{idea.content_goal ? ` · ${idea.content_goal}` : ""}
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {idea.status === "chosen" ? "Gewählt" : "Vorschlag"}
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
