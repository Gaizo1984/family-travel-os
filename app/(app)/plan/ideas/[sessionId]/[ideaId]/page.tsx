import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateTripIdeaNotes } from "@/lib/actions/trip-ideas";
import { generateHotelShortlist, estimateTripIdeaBudget } from "@/lib/actions/trip-idea-advisor";
import { BUDGET_CATEGORY_ORDER, BUDGET_CATEGORY_LABELS, type BudgetCategory } from "@/lib/budget";
import { LUXURY_TIER_LABELS, type LuxuryHotelTier } from "@/lib/data/luxury-hotel-brands";
import { Banner } from "@/components/Banner";

type HotelShortlistItem = {
  placeId: string; name: string; address: string
  rating: number | null; reviewCount: number | null; priceLevel: string | null
  photoName: string | null; websiteUri: string | null; transferMinutes: number | null
  familyFitReasoning: string; styleImpression: string; bestFor: string; caveats: string
  tier: LuxuryHotelTier; tierBasis: "brand" | "heuristic"
  unverifiedFields: string[]
};

const TIER_COLORS: Record<LuxuryHotelTier, string> = {
  standard: "var(--accent)",
  premium: "#8B6F47",
  ultra_luxury: "#B5624A",
};

type BudgetBreakdown = {
  currency: string; totalMin: number | null; totalMax: number | null
  byCategory: Record<BudgetCategory, { min: number | null; max: number | null; note: string }>
};

const PRICE_LEVEL_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: "Kostenlos",
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

function HotelCard({ hotel }: { hotel: HotelShortlistItem }) {
  const isUnverified = (field: string) => hotel.unverifiedFields.includes(field);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {hotel.photoName && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/places-photo/${hotel.photoName}?maxWidthPx=400`}
          alt={hotel.name}
          className="w-full object-cover"
          style={{ height: "140px" }}
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-light" style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{hotel.name}</div>
          {hotel.priceLevel && !isUnverified("priceLevel") && (
            <span style={{ color: "var(--accent)", fontSize: "0.68rem", whiteSpace: "nowrap" }}>
              {PRICE_LEVEL_LABELS[hotel.priceLevel] ?? hotel.priceLevel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            style={{
              color: TIER_COLORS[hotel.tier], fontSize: "0.6rem", letterSpacing: "0.06em", textTransform: "uppercase",
              border: `1px solid ${TIER_COLORS[hotel.tier]}55`, borderRadius: "20px", padding: "2px 9px",
            }}
          >
            {LUXURY_TIER_LABELS[hotel.tier]}
          </span>
          {hotel.tierBasis === "heuristic" && (
            <span style={{ color: "var(--muted)", fontSize: "0.6rem", fontStyle: "italic" }}>
              (keine offizielle Sterne-Klassifizierung — Einordnung aus Bewertung/Preisniveau)
            </span>
          )}
        </div>

        <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{hotel.address}</p>

        <div className="flex flex-wrap items-center gap-3 mb-3" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          {hotel.rating !== null && !isUnverified("rating") ? (
            <span className="flex items-center gap-1">
              <Star size={11} strokeWidth={1.6} fill="var(--accent)" style={{ color: "var(--accent)" }} />
              {hotel.rating} ({hotel.reviewCount ?? 0})
            </span>
          ) : (
            <span>Bewertung nicht verifiziert</span>
          )}
          {hotel.transferMinutes !== null ? (
            <span>{hotel.transferMinutes} Min Transfer</span>
          ) : (
            <span>Transferzeit nicht verifiziert</span>
          )}
        </div>

        <p className="mb-2 italic leading-relaxed" style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{hotel.familyFitReasoning}</p>
        <p className="mb-2" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{hotel.styleImpression} · {hotel.bestFor}</p>
        {hotel.caveats && (
          <p className="mb-3" style={{ color: "#B5624A", fontSize: "0.7rem" }}>{hotel.caveats}</p>
        )}

        {hotel.websiteUri && (
          <a
            href={hotel.websiteUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
            style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.04em", textDecoration: "none" }}
          >
            Hotelwebsite öffnen <ExternalLink size={11} strokeWidth={1.6} />
          </a>
        )}
      </div>
    </div>
  );
}

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

  const hotelShortlist = (idea.hotel_shortlist as HotelShortlistItem[] | null) ?? null;
  const budgetBreakdown = (idea.budget_breakdown as BudgetBreakdown | null) ?? null;

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

        {error && (
          <Banner variant="error" className="mb-6 px-4 py-3 rounded-lg">
            {error}
          </Banner>
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

        {/* ── Hotel-Shortlist ── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xs font-medium" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}>
              Hotel-Shortlist
            </h2>
            <form action={generateHotelShortlist}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="session_id" value={sessionId} />
              <button
                type="submit"
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "6px", padding: "7px 14px", fontSize: "0.6rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                {hotelShortlist ? "Neu vorschlagen" : "Hotels vorschlagen"}
              </button>
            </form>
          </div>

          {hotelShortlist ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                {hotelShortlist.map((h) => <HotelCard key={h.placeId} hotel={h} />)}
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.65rem", fontStyle: "italic" }}>
                Auswahl auf Basis echter Google-Places-Daten, keine Live-Verfügbarkeit oder Livepreisprüfung.
              </p>
            </>
          ) : (
            <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Noch keine Hotels vorgeschlagen. LUMI sucht dafür reale Hotels am Zielort und wählt die passendsten für eure Familie aus.
              </p>
            </div>
          )}
        </section>

        {/* ── Budget-Schätzung ── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xs font-medium" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}>
              Budget-Schätzung
            </h2>
            <form action={estimateTripIdeaBudget}>
              <input type="hidden" name="idea_id" value={idea.id} />
              <input type="hidden" name="session_id" value={sessionId} />
              <button
                type="submit"
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "6px", padding: "7px 14px", fontSize: "0.6rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                {budgetBreakdown ? "Neu schätzen" : "Budget schätzen"}
              </button>
            </form>
          </div>

          {budgetBreakdown ? (
            <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {(budgetBreakdown.totalMin || budgetBreakdown.totalMax) && (
                <div className="mb-5 pb-5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>
                    Gesamt (Schätzung)
                  </div>
                  <div style={{ color: "var(--foreground)", fontSize: "1.1rem", fontWeight: 300 }}>
                    ca. {budgetBreakdown.totalMin ?? "?"}–{budgetBreakdown.totalMax ?? "?"} {budgetBreakdown.currency}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {BUDGET_CATEGORY_ORDER.map((cat) => {
                  const est = budgetBreakdown.byCategory[cat];
                  if (!est || (est.min == null && est.max == null)) return null;
                  return (
                    <div key={cat} className="flex items-start justify-between gap-3">
                      <div>
                        <div style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>{BUDGET_CATEGORY_LABELS[cat]}</div>
                        {est.note && <div style={{ color: "var(--muted)", fontSize: "0.65rem" }}>{est.note}</div>}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        ca. {est.min ?? "?"}–{est.max ?? "?"} {budgetBreakdown.currency}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5" style={{ color: "var(--muted)", fontSize: "0.65rem", fontStyle: "italic" }}>
                Grobe Schätzung, keine aktuellen/verfügbaren Preise.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Noch keine Budget-Schätzung erstellt.
              </p>
            </div>
          )}
        </section>

        <form action={updateTripIdeaNotes} className="mb-6">
          <input type="hidden" name="idea_id" value={idea.id} />
          <input type="hidden" name="session_id" value={sessionId} />
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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
