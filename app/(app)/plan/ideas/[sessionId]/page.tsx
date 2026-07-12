import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { chooseTripIdea } from "@/lib/actions/trip-ideas";

export default async function TripIdeaSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("trip_idea_sessions")
    .select("id, input_text, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  const { data: ideas } = await supabase
    .from("trip_ideas")
    .select("id, destination, route_summary, best_season, duration_days_min, duration_days_max, reasoning, budget_range_min, budget_range_max, budget_currency, includes_flights")
    .eq("session_id", sessionId)
    .order("created_at");

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/plan"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Reiseidee entwickeln
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Eure Reiseideen
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Drei Ideen zu eurem Wunsch
        </h1>
        <p className="mb-8 italic" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
          „{session.input_text}"
        </p>

        <div className="grid grid-cols-1 gap-4">
          {(ideas ?? []).map((idea) => (
            <div key={idea.id} className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <h2 className="text-lg font-light" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
                  {idea.destination}
                </h2>
                {idea.best_season && (
                  <span style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {idea.best_season}
                  </span>
                )}
              </div>

              {idea.route_summary && (
                <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{idea.route_summary}</p>
              )}

              <p className="mb-4 italic leading-relaxed" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
                {idea.reasoning}
              </p>

              <div className="flex flex-wrap gap-4 mb-5" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                {(idea.duration_days_min || idea.duration_days_max) && (
                  <span>
                    {idea.duration_days_min && idea.duration_days_max && idea.duration_days_min !== idea.duration_days_max
                      ? `${idea.duration_days_min}–${idea.duration_days_max} Tage`
                      : `${idea.duration_days_min ?? idea.duration_days_max} Tage`}
                  </span>
                )}
                {(idea.budget_range_min || idea.budget_range_max) && (
                  <span>
                    ca. {idea.budget_range_min ?? "?"}–{idea.budget_range_max ?? "?"} {idea.budget_currency}
                    {idea.includes_flights ? " (inkl. Flüge)" : " (ohne Flüge)"}
                  </span>
                )}
              </div>

              <form action={chooseTripIdea}>
                <input type="hidden" name="idea_id" value={idea.id} />
                <input type="hidden" name="session_id" value={session.id} />
                <button
                  type="submit"
                  style={{
                    background: "var(--foreground)", color: "var(--surface)", border: "none",
                    borderRadius: "6px", padding: "10px 20px", fontSize: "0.62rem",
                    letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                    whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Diese Idee wählen →
                </button>
              </form>
            </div>
          ))}
        </div>

        <p className="mt-8" style={{ color: "var(--muted)", fontSize: "0.68rem", lineHeight: 1.6 }}>
          Alle Angaben sind KI-gestützte Schätzungen auf Basis eurer Familiendaten — keine Live-Preise oder garantierten Verfügbarkeiten.
        </p>
      </div>
    </div>
  );
}
