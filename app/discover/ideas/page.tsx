import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";

export default async function DiscoverIdeasPage() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: ideas } = await supabase
    .from("trip_ideas")
    .select("id, destination, route_summary, best_season, reasoning, origin, session_id, converted_trip_id")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/discover"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Entdecken
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Merken, sammeln, später entwickeln
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Eure Ideen-Inbox
        </h1>

        {(ideas ?? []).length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine gemerkten Ideen. Speichert Vorschläge aus Entdecken oder entwickelt eine Reiseidee.
            </p>
            <Link href="/plan" style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}>
              Reiseidee entwickeln →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {(ideas ?? []).map((idea) => (
              <div key={idea.id} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h3 className="text-base font-light" style={{ color: "var(--foreground)" }}>{idea.destination}</h3>
                  <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {idea.origin === "discover_bookmark" ? "Gemerkt" : "Reiseidee"}
                    {idea.converted_trip_id ? " · Umgewandelt" : ""}
                  </span>
                </div>
                {idea.route_summary && <p className="mb-2" style={{ color: "var(--muted)", fontSize: "0.74rem" }}>{idea.route_summary}</p>}
                {idea.reasoning && <p className="mb-3 italic" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{idea.reasoning}</p>}
                {idea.session_id && (
                  <Link href={`/plan/ideas/${idea.session_id}/${idea.id}`} style={{ color: "var(--accent)", fontSize: "0.65rem", textDecoration: "none" }}>
                    Weiterentwickeln →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
