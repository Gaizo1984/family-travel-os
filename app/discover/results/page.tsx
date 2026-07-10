import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildFamilyDnaSummary } from "@/lib/family-dna";
import { DESTINATIONS, MOOD_OPTIONS, SEASON_WINDOW_OPTIONS } from "@/lib/data/destination-knowledge";
import type { MoodKey, SeasonWindowKey } from "@/lib/data/destination-knowledge";
import { scoreDestinations } from "@/lib/discover-scoring";
import { bookmarkTripIdea } from "@/lib/actions/trip-ideas";

export default async function DiscoverResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; mood?: string }>;
}) {
  const { season, mood } = await searchParams;

  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const dna = await buildFamilyDnaSummary(family?.id ?? "");

  const { data: pastTrips } = await supabase.from("past_trips").select("country_or_region").eq("family_id", family?.id ?? "");
  const { data: trips } = await supabase.from("trips").select("title").eq("family_id", family?.id ?? "").in("status", ["completed", "active"]);
  const avoidNames = [...(pastTrips ?? []).map((p) => p.country_or_region), ...(trips ?? []).map((t) => t.title)];

  const seasonOption = SEASON_WINDOW_OPTIONS.find((s) => s.key === season as SeasonWindowKey);
  const moodOption = MOOD_OPTIONS.find((m) => m.key === mood as MoodKey);

  const scored = scoreDestinations(DESTINATIONS, dna, {
    seasonMonths: seasonOption?.months ?? null,
    mood: moodOption?.key ?? null,
    avoidNames,
  }).slice(0, 5);

  const title = moodOption ? moodOption.label : seasonOption ? seasonOption.label : "Eure Vorschläge";

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
          Kuratierte Vorschläge
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {title}
        </h1>

        {scored.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Für diese Kombination ist aktuell nichts Passendes hinterlegt.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {scored.map(({ destination: d, reasoning }) => (
              <div key={d.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="relative" style={{ height: 160 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.photo} alt={d.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.9) 0%, transparent 60%)" }} />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div style={{ color: "#F0EBE3", fontSize: "1.1rem", fontWeight: 300 }}>{d.name}</div>
                    <div style={{ color: "#A89880", fontSize: "0.65rem" }}>{d.tags}</div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="mb-2" style={{ color: "var(--muted)", fontSize: "0.78rem", fontStyle: "italic" }}>{d.feel}</p>
                  <p className="mb-4" style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>{reasoning}</p>
                  {d.watchOut && (
                    <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>ℹ️ {d.watchOut}</p>
                  )}
                  <form action={bookmarkTripIdea}>
                    <input type="hidden" name="destination" value={d.name} />
                    <input type="hidden" name="route_summary" value={d.tags} />
                    <input type="hidden" name="best_season" value={d.bestSeasonMonths?.join(', ') ?? 'Ganzjährig geeignet'} />
                    <input type="hidden" name="reasoning" value={reasoning} />
                    <input type="hidden" name="return_to" value={`/discover/results${season ? `?season=${season}` : mood ? `?mood=${mood}` : ''}`} />
                    <button
                      type="submit"
                      style={{
                        background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                        borderRadius: "6px", padding: "8px 16px", fontSize: "0.62rem", letterSpacing: "0.1em",
                        textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                      }}
                    >
                      Als Reiseidee merken
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8" style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}>
          Basiert auf statischem Zielwissen und eurem Reisekompass — keine Live-Preise oder Wetterdaten.
        </p>
      </div>
    </div>
  );
}
