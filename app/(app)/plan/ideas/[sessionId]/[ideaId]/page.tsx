import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateTripIdeaNotes } from "@/lib/actions/trip-ideas";
import { Banner } from "@/components/Banner";

export default async function TripIdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string; ideaId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { sessionId, ideaId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: idea } = await supabase
    .from("trip_ideas")
    .select("*")
    .eq("id", ideaId)
    .maybeSingle();

  if (!idea) notFound();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/plan/ideas/${sessionId}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Alle Ideen dieses Wunsches
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Reiseidee
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}>
          {idea.destination}
        </h1>
        {idea.best_season && (
          <p className="mb-8" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Beste Reisezeit: {idea.best_season}
          </p>
        )}

        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {idea.route_summary && (
            <p className="mb-4" style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 300 }}>{idea.route_summary}</p>
          )}
          <p className="mb-5 italic leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            {idea.reasoning}
          </p>
          <div className="flex flex-wrap gap-6" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {(idea.duration_days_min || idea.duration_days_max) && (
              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>Dauer</div>
                <div style={{ color: "var(--foreground)" }}>
                  {idea.duration_days_min && idea.duration_days_max && idea.duration_days_min !== idea.duration_days_max
                    ? `${idea.duration_days_min}–${idea.duration_days_max} Tage`
                    : `${idea.duration_days_min ?? idea.duration_days_max} Tage`}
                </div>
              </div>
            )}
            {(idea.budget_range_min || idea.budget_range_max) && (
              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>Budget (Schätzung)</div>
                <div style={{ color: "var(--foreground)" }}>
                  ca. {idea.budget_range_min ?? "?"}–{idea.budget_range_max ?? "?"} {idea.budget_currency}{idea.includes_flights ? " (inkl. Flüge)" : " (ohne Flüge)"}
                </div>
              </div>
            )}
          </div>
        </div>

        <form action={updateTripIdeaNotes} className="mb-6">
          <input type="hidden" name="idea_id" value={idea.id} />
          <input type="hidden" name="session_id" value={sessionId} />
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error" className="mb-4 px-4 py-3 rounded-lg">
                {error}
              </Banner>
            )}
            <label htmlFor="dev-notes" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}>
              Weiterentwickeln — eure Notizen
            </label>
            <textarea
              id="dev-notes" name="development_notes" rows={4}
              defaultValue={idea.development_notes ?? ""}
              placeholder="z. B. konkrete Hotel-Ideen, Anpassungen an der Route, offene Fragen …"
              style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 300, outline: "none", resize: "none", marginBottom: "16px" }}
            />
            <button
              type="submit"
              style={{
                background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
              }}
            >
              Notizen speichern
            </button>
          </div>
        </form>

        <div className="rounded-xl p-6 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <div style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 400, marginBottom: "4px" }}>Bereit für den nächsten Schritt?</div>
            <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Wandelt diese Idee in eine echte, konkrete Reise um.</p>
          </div>
          <Link
            href={`/plan?from_idea=${idea.id}`}
            style={{
              background: "var(--foreground)", color: "var(--surface)", textDecoration: "none",
              borderRadius: "6px", padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.14em",
              textTransform: "uppercase", whiteSpace: "nowrap",
            }}
          >
            In echte Reise umwandeln →
          </Link>
        </div>
      </div>
    </div>
  );
}
