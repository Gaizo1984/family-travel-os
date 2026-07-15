import Link from "next/link";
import { ChevronLeft, Trash2, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { deleteTripIdea, toggleTripIdeaFavorite } from "@/lib/actions/trip-ideas";
import { generateIdeaComparison } from "@/lib/actions/trip-idea-comparisons";
import { IdeaCompareSelector } from "@/components/IdeaCompareSelector";
import { Banner } from "@/components/Banner";

function FavoriteToggle({ ideaId, isFavorite }: { ideaId: string; isFavorite: boolean }) {
  return (
    <form action={toggleTripIdeaFavorite}>
      <input type="hidden" name="idea_id" value={ideaId} />
      <input type="hidden" name="current" value={String(isFavorite)} />
      <input type="hidden" name="return_to" value="/discover/ideas" />
      <button
        type="submit"
        aria-label={isFavorite ? "Aus Favoriten entfernen" : "Als Favorit markieren"}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", margin: "-6px", display: "flex" }}
      >
        <Star size={15} strokeWidth={1.6} fill={isFavorite ? "var(--accent)" : "none"} style={{ color: "var(--accent)" }} />
      </button>
    </form>
  );
}

export default async function DiscoverIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: ideasRaw } = await supabase
    .from("trip_ideas")
    .select("id, destination, route_summary, best_season, reasoning, origin, session_id, converted_trip_id, is_favorite")
    .eq("family_id", familyId);

  // §"Ideen alphabetisch nach Ländern ordnen": destination ist Freitext
  // (z. B. "Costa Rica" oder "Bali + Nihi Sumba") -- kein separates
  // Länderfeld vorhanden, daher alphabetisch auf diesem Text sortiert.
  const ideas = [...(ideasRaw ?? [])].sort((a, b) => a.destination.localeCompare(b.destination, "de"));
  const favorites = ideas.filter((idea) => idea.is_favorite);

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

        {error && <Banner variant="error" className="mb-6 px-4 py-3 rounded-lg">{error}</Banner>}

        {favorites.length > 0 && (
          <section className="mb-10">
            <div className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Meine Reiseideen
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {favorites.map((idea) => (
                <div key={idea.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: "var(--surface)", border: "1px solid rgba(184,154,94,0.3)" }}>
                  <div className="min-w-0">
                    <div className="truncate" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>{idea.destination}</div>
                    {idea.route_summary && <div className="truncate" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{idea.route_summary}</div>}
                  </div>
                  <FavoriteToggle ideaId={idea.id} isFavorite />
                </div>
              ))}
            </div>

            {favorites.length >= 2 ? (
              <IdeaCompareSelector
                ideas={favorites.map((idea) => ({ id: idea.id, label: idea.destination }))}
                action={generateIdeaComparison}
              />
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.7rem", fontStyle: "italic" }}>
                Markiert mindestens eine weitere Idee als Favorit, um zu vergleichen.
              </p>
            )}
          </section>
        )}

        {ideas.length === 0 ? (
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
            {ideas.map((idea) => (
              <div key={idea.id} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h3 className="text-base font-light" style={{ color: "var(--foreground)" }}>{idea.destination}</h3>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {idea.origin === "discover_bookmark" ? "Gemerkt" : "Reiseidee"}
                      {idea.converted_trip_id ? " · Umgewandelt" : ""}
                    </span>
                    <FavoriteToggle ideaId={idea.id} isFavorite={idea.is_favorite} />
                  </div>
                </div>
                {idea.route_summary && <p className="mb-2" style={{ color: "var(--muted)", fontSize: "0.74rem" }}>{idea.route_summary}</p>}
                {idea.reasoning && <p className="mb-3 italic" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{idea.reasoning}</p>}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {idea.session_id ? (
                    <Link href={`/plan/ideas/${idea.session_id}/${idea.id}`} style={{ color: "var(--accent)", fontSize: "0.65rem", textDecoration: "none" }}>
                      Weiterentwickeln →
                    </Link>
                  ) : <span />}
                  <form action={deleteTripIdea}>
                    <input type="hidden" name="idea_id" value={idea.id} />
                    <input type="hidden" name="return_to" value="/discover/ideas" />
                    <button
                      type="submit"
                      aria-label="Idee löschen"
                      className="flex items-center gap-1.5"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", margin: "-6px", color: "var(--muted)", fontSize: "0.65rem" }}
                    >
                      <Trash2 size={12} strokeWidth={1.6} />
                      Löschen
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
