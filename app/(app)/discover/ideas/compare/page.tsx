import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { generateIdeaComparison } from "@/lib/actions/trip-idea-comparisons";
import { chooseComparisonWinner } from "@/lib/actions/trip-ideas";
import { LUXURY_TIER_LABELS, type LuxuryHotelTier } from "@/lib/data/luxury-hotel-brands";
import { TRIP_VARIANT_LABELS, type TripVariantType } from "@/lib/trip-idea-advisor-ai";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";

type IdeaScore = {
  destination: string
  totalCostMin: number | null; totalCostMax: number | null; currency: string
  durationMin: number | null; durationMax: number | null
  bestHotelTier: LuxuryHotelTier | null
  flightBurden: string; flightBurdenReasoning: string
  weatherFit: string; weatherFitReasoning: string
  kidFriendliness: string | null; kidFriendlinessReasoning: string
  experienceValue: string | null; experienceValueReasoning: string
  lumiFit: string | null; lumiFitReasoning: string
};

type IdeaRow = {
  id: string; destination: string; session_id: string | null; is_chosen: boolean
  chosen_variant_type: string | null
  variants: Array<{ variantType: TripVariantType; title: string }> | null
};

const HOTEL_TIER_RANK: Record<LuxuryHotelTier, number> = { standard: 1, premium: 2, ultra_luxury: 3 };
const FLIGHT_BURDEN_RANK: Record<string, number> = { gering: 1, mittel: 2, hoch: 3 };
const THREE_LEVEL_RANK: Record<string, number> = { hoch: 3, mittel: 2, niedrig: 1 };
const WEATHER_RANK: Record<string, number> = { ideal: 1, akzeptabel: 2, "ungünstig": 3 };
const LUMI_FIT_RANK: Record<string, number> = { "sehr gut": 4, gut: 3, mittel: 2, gering: 1 };

/** Ermittelt je Kriterium die Idee(n) mit dem besten Wert -- Unentschieden zählen alle als Gewinner. Werte ohne Einschätzung ("nicht einschätzbar"/null) nehmen nie teil. */
function winnersFor<T>(
  entries: Array<[string, T | null]>,
  rank: (v: T) => number | null,
  higherIsBetter: boolean,
): Set<string> {
  const ranked = entries
    .map(([id, v]) => ({ id, r: v !== null ? rank(v) : null }))
    .filter((e): e is { id: string; r: number } => e.r !== null);
  if (ranked.length === 0) return new Set();
  const best = higherIsBetter ? Math.max(...ranked.map((e) => e.r)) : Math.min(...ranked.map((e) => e.r));
  return new Set(ranked.filter((e) => e.r === best).map((e) => e.id));
}

function CriterionRow({
  label, ideaIds, isWinner, render,
}: {
  label: string; ideaIds: string[]; isWinner: (id: string) => boolean
  render: (id: string) => React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      {ideaIds.map((id) => (
        <div key={id} className="flex items-center gap-1.5" style={{ fontSize: "0.78rem", color: isWinner(id) ? "var(--accent)" : "var(--foreground)" }}>
          {isWinner(id) && <Trophy size={11} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
          {render(id)}
        </div>
      ))}
    </div>
  );
}

export default async function CompareIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; error?: string }>;
}) {
  const { ids, error } = await searchParams;
  const ideaIds = (ids ?? "").split(",").filter(Boolean);
  if (ideaIds.length < 2) notFound();

  const supabase = await createClient();
  const { data: ideasRaw } = await supabase
    .from("trip_ideas")
    .select("id, destination, session_id, is_chosen, chosen_variant_type, variants")
    .in("id", ideaIds);
  const ideas = (ideasRaw ?? []) as unknown as IdeaRow[];
  if (ideas.length < 2) notFound();

  const { data: comparisonRow } = await supabase
    .from("trip_idea_comparisons")
    .select("scores")
    .eq("comparison_key", [...ideaIds].sort().join(","))
    .maybeSingle();
  const scores = (comparisonRow?.scores as Record<string, IdeaScore> | undefined) ?? null;

  const winners = scores
    ? {
        cost: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.totalCostMin ?? null]), (v) => v, false),
        hotel: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.bestHotelTier ?? null]), (v) => HOTEL_TIER_RANK[v], true),
        flight: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.flightBurden ?? null]), (v) => FLIGHT_BURDEN_RANK[v] ?? null, false),
        weather: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.weatherFit ?? null]), (v) => WEATHER_RANK[v] ?? null, false),
        kid: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.kidFriendliness ?? null]), (v) => THREE_LEVEL_RANK[v] ?? null, true),
        experience: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.experienceValue ?? null]), (v) => THREE_LEVEL_RANK[v] ?? null, true),
        lumiFit: winnersFor(ideas.map((i) => [i.id, scores[i.id]?.lumiFit ?? null]), (v) => LUMI_FIT_RANK[v] ?? null, true),
      }
    : null;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/discover/ideas"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Ideen-Inbox
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Favoriten vergleichen
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {ideas.map((i) => i.destination).join(" · ")}
        </h1>

        {error && <Banner variant="error" className="mb-6 px-4 py-3 rounded-lg">{error}</Banner>}

        {!scores ? (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch kein Vergleich erstellt. LUMI bewertet Gesamtkosten, Reisedauer, Flugbelastung, Wetter, Hotelqualität, Kindergeeignetheit, Erlebniswert und LUMI-Fit für alle ausgewählten Ideen.
            </p>
            <form action={generateIdeaComparison}>
              {ideaIds.map((id) => <input key={id} type="hidden" name="idea_ids" value={id} />)}
              <SubmitButtonWithProgress label="Vergleich erstellen" pendingLabel="Vergleich wird erstellt …" />
            </form>
          </div>
        ) : (
          <>
            {/* ── Primäre Ansicht: kompakte Karten je Idee (mobile first) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {ideas.map((idea) => {
                const s = scores[idea.id];
                return (
                  <div key={idea.id} className="rounded-xl p-5" style={{ background: "var(--surface)", border: idea.is_chosen ? "1px solid rgba(184,154,94,0.5)" : "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="font-light" style={{ color: "var(--foreground)", fontSize: "1rem" }}>{idea.destination}</div>
                      {idea.is_chosen && (
                        <span style={{ color: "var(--accent)", fontSize: "0.58rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Gewinner</span>
                      )}
                    </div>

                    {!s ? (
                      <p style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}>Keine Bewertung verfügbar.</p>
                    ) : (
                      <>
                        <CriterionRow label="Gesamtkosten" ideaIds={[idea.id]} isWinner={(id) => winners!.cost.has(id)}
                          render={() => `ca. ${s.totalCostMin ?? "?"}–${s.totalCostMax ?? "?"} ${s.currency}`} />
                        <CriterionRow label="Reisedauer" ideaIds={[idea.id]} isWinner={() => false}
                          render={() => s.durationMin || s.durationMax ? `${s.durationMin ?? s.durationMax}${s.durationMax && s.durationMax !== s.durationMin ? `–${s.durationMax}` : ""} Tage` : "—"} />
                        <CriterionRow label="Hotelqualität" ideaIds={[idea.id]} isWinner={(id) => winners!.hotel.has(id)}
                          render={() => s.bestHotelTier ? LUXURY_TIER_LABELS[s.bestHotelTier] : "Noch keine Shortlist"} />
                        <CriterionRow label="Flugbelastung" ideaIds={[idea.id]} isWinner={(id) => winners!.flight.has(id)}
                          render={() => <span title={s.flightBurdenReasoning}>{s.flightBurden}</span>} />
                        <CriterionRow label="Wetter" ideaIds={[idea.id]} isWinner={(id) => winners!.weather.has(id)}
                          render={() => <span title={s.weatherFitReasoning}>{s.weatherFit}</span>} />
                        <CriterionRow label="Kindergeeignetheit" ideaIds={[idea.id]} isWinner={(id) => winners!.kid.has(id)}
                          render={() => <span title={s.kidFriendlinessReasoning}>{s.kidFriendliness ?? "—"}</span>} />
                        <CriterionRow label="Erlebniswert" ideaIds={[idea.id]} isWinner={(id) => winners!.experience.has(id)}
                          render={() => <span title={s.experienceValueReasoning}>{s.experienceValue ?? "—"}</span>} />
                        <CriterionRow label="LUMI-Fit" ideaIds={[idea.id]} isWinner={(id) => winners!.lumiFit.has(id)}
                          render={() => <span title={s.lumiFitReasoning}>{s.lumiFit ?? "—"}</span>} />
                      </>
                    )}

                    <form action={chooseComparisonWinner} className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <input type="hidden" name="idea_id" value={idea.id} />
                      <input type="hidden" name="return_to" value={`/discover/ideas/compare?ids=${ideaIds.join(",")}`} />
                      {idea.variants && idea.variants.length > 0 && (
                        <select
                          name="variant_type"
                          defaultValue={idea.chosen_variant_type ?? ""}
                          className="mb-2"
                          style={{ width: "100%", padding: "8px 10px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)", fontSize: "0.72rem" }}
                        >
                          <option value="">Bevorzugte Variante (optional)</option>
                          {idea.variants.map((v) => (
                            <option key={v.variantType} value={v.variantType}>{TRIP_VARIANT_LABELS[v.variantType]}</option>
                          ))}
                        </select>
                      )}
                      <button
                        type="submit"
                        style={{
                          width: "100%", background: idea.is_chosen ? "transparent" : "var(--foreground)",
                          color: idea.is_chosen ? "var(--accent)" : "var(--surface)",
                          border: idea.is_chosen ? "1px solid rgba(184,154,94,0.4)" : "none",
                          borderRadius: "6px", padding: "8px 14px", fontSize: "0.6rem", letterSpacing: "0.1em",
                          textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                        }}
                      >
                        {idea.is_chosen ? "Gewinner aktualisieren" : "Als Gewinner markieren"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>

            {/* ── Sekundäre, optionale Detailtabelle ── */}
            <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Detailvergleich
            </div>
            <div className="rounded-xl overflow-x-auto mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <table className="w-full" style={{ borderCollapse: "collapse", minWidth: "560px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }} />
                    {ideas.map((idea) => (
                      <th key={idea.id} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.6rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        {idea.destination}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["Gesamtkosten", (s: IdeaScore | undefined) => s ? `ca. ${s.totalCostMin ?? "?"}–${s.totalCostMax ?? "?"} ${s.currency}` : "—", winners!.cost],
                    ["Reisedauer", (s: IdeaScore | undefined) => s && (s.durationMin || s.durationMax) ? `${s.durationMin ?? s.durationMax} Tage` : "—", new Set<string>()],
                    ["Hotelqualität", (s: IdeaScore | undefined) => s?.bestHotelTier ? LUXURY_TIER_LABELS[s.bestHotelTier] : "—", winners!.hotel],
                    ["Flugbelastung", (s: IdeaScore | undefined) => s?.flightBurden ?? "—", winners!.flight],
                    ["Wetter", (s: IdeaScore | undefined) => s?.weatherFit ?? "—", winners!.weather],
                    ["Kindergeeignetheit", (s: IdeaScore | undefined) => s?.kidFriendliness ?? "—", winners!.kid],
                    ["Erlebniswert", (s: IdeaScore | undefined) => s?.experienceValue ?? "—", winners!.experience],
                    ["LUMI-Fit", (s: IdeaScore | undefined) => s?.lumiFit ?? "—", winners!.lumiFit],
                  ] as Array<[string, (s: IdeaScore | undefined) => string, Set<string>]>).map(([label, render, winnerSet]) => (
                    <tr key={label}>
                      <td style={{ padding: "9px 14px", fontSize: "0.68rem", color: "var(--muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{label}</td>
                      {ideas.map((idea) => (
                        <td key={idea.id} style={{ padding: "9px 14px", fontSize: "0.72rem", color: winnerSet.has(idea.id) ? "var(--accent)" : "var(--foreground)", fontWeight: winnerSet.has(idea.id) ? 500 : 400, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                          {render(scores[idea.id])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form action={generateIdeaComparison} className="mb-6">
              {ideaIds.map((id) => <input key={id} type="hidden" name="idea_ids" value={id} />)}
              <SubmitButtonWithProgress
                label="Neu vergleichen"
                pendingLabel="Vergleich wird erstellt …"
                style={{ background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)" }}
              />
            </form>

            <p style={{ color: "var(--muted)", fontSize: "0.65rem", fontStyle: "italic" }}>
              Grobe Schätzungen und qualitative Einschätzungen, keine Live-Preise, Verfügbarkeiten oder Buchungen. "Als Gewinner markieren" ist eine strukturierte Vormerkung, keine Buchung.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
