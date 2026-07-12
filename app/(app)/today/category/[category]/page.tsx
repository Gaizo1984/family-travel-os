import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RefreshCw, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { isTripCurrentlyRunning, isTripHistorical } from "@/lib/trip-status";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import { getTodayCategoryConfig } from "@/lib/today-categories";
import { resolveTripAiContext } from "@/lib/today-trip-context";
import { generateCategorySuggestion, getCategorySuggestion } from "@/lib/actions/category-suggestions";
import { buildFamilyDnaSummary, TRAVEL_NEED_OPTIONS } from "@/lib/family-dna";
import { Banner } from "@/components/Banner";
import type { StageInput, TimelineBooking } from "@/lib/journey";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium mb-4" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.62rem" }}>
      {children}
    </h2>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
  trip_members: Array<{ persons: { id: string; name: string } | null }>
  stages: StageInput[]
  bookings: TimelineBooking[]
};

export default async function TodayCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { category } = await params;
  const { error } = await searchParams;

  // §"Vollständig generisch, keine eigene Seite pro Kategorie": diese Seite
  // rendert ausschließlich aus der aufgelösten Config (lib/today-categories.ts).
  // Eine unbekannte/künftig entfernte Kategorie führt zu 404, kein Sonderfall im JSX.
  const config = getTodayCategoryConfig(category);
  if (!config) notFound();

  const returnTo = `/today/category/${category}`;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const todayIso = todayIsoInFamilyTimezone();

  const { data: trips } = await supabase
    .from("trips")
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      trip_members ( persons ( id, name ) ),
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at )
    `)
    .eq("family_id", familyId);

  const allTrips = (trips ?? []) as unknown as TripRow[];
  const activeTrip = allTrips.find((t) => isTripCurrentlyRunning(t, todayIso));
  const nextTrip = !activeTrip
    ? allTrips
        .filter((t) => t.status !== "archived" && !isTripHistorical(t, todayIso))
        .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0] ?? null
    : null;
  const trip = activeTrip ?? nextTrip;

  const backLink = (
    <Link
      href="/today"
      className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
      style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
    >
      <ChevronLeft size={13} strokeWidth={1.5} />
      LUMI
    </Link>
  );

  if (!trip) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          {backLink}
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            {config.label}
          </div>
          <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            Aktuell keine Reise
          </h1>
          <Card>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Sobald eine Reise geplant oder aktiv ist, hilft LUMI euch hier mit {config.label.toLowerCase()}.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const context = await resolveTripAiContext(trip, trip === activeTrip, todayIso);
  const dateLabel = new Date(todayIso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const weatherSummary = context.weather ? `${context.weather.currentTemp}°C` : null;

  const [cachedSuggestion, curatedResults, dna] = await Promise.all([
    getCategorySuggestion(familyId, context.tripId, config.key),
    config.curatedSearch ? config.curatedSearch(context.locationLabel) : Promise.resolve(null),
    config.key === "family" ? buildFamilyDnaSummary(familyId) : Promise.resolve(null),
  ]);

  const questionText = config.aiQuestionTemplate(context.locationLabel);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        {backLink}

        <div className="flex items-center gap-2.5 mb-3">
          <config.Icon size={16} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            {config.label}
          </div>
        </div>
        <h1 className="font-light mb-1" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
          {context.tripTitle}
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>📍 {context.locationLabel}</p>

        {error && <Banner variant="error">{error}</Banner>}

        {/* §Familie: umgezogene Familien-DNA-Hinweise (vormals auf der LUMI-Startseite). */}
        {config.key === "family" && dna && dna.persons.some((p) => p.travel_needs.length > 0 || p.interest_tags.length > 0) && (
          <section className="mb-8">
            <SectionLabel>Für dich mitgedacht</SectionLabel>
            <Card>
              <div className="space-y-3">
                {dna.persons.filter((p) => p.travel_needs.length > 0 || p.interest_tags.length > 0).map((p) => {
                  const needLabels = p.travel_needs.map((k) => TRAVEL_NEED_OPTIONS.find((o) => o.key === k)?.label ?? k);
                  const allTags = [...needLabels, ...p.interest_tags];
                  return (
                    <div key={p.id} className="flex items-start gap-3">
                      <Users size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{p.name}: </span>
                        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{allTags.join(", ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        )}

        {/* Kuratierte Treffer: kostenlos, sofort sichtbar, kein Klick nötig. */}
        {curatedResults && curatedResults.length > 0 && (
          <section className="mb-8">
            <SectionLabel>Kuratiert für euch</SectionLabel>
            <div className="space-y-2.5">
              {curatedResults.map((r) => (
                <Card key={r.id}>
                  <div style={{ color: "var(--foreground)", fontSize: "0.88rem", marginBottom: "3px" }}>{r.name}</div>
                  <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{r.description}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* KI-Vorschlag: nur auf Klick, danach mehrtägig gecacht. */}
        <section className="mb-8">
          <SectionLabel>KI-Empfehlung</SectionLabel>
          {cachedSuggestion ? (
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {cachedSuggestion.questionText}
                </span>
              </div>
              <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{cachedSuggestion.title}</div>
              <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{cachedSuggestion.body}</p>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>
                  {cachedSuggestion.daysAgo <= 0 ? "Heute aktualisiert" : cachedSuggestion.daysAgo === 1 ? "Vor 1 Tag aktualisiert" : `Vor ${cachedSuggestion.daysAgo} Tagen aktualisiert`}
                </span>
                <form action={generateCategorySuggestion}>
                  <input type="hidden" name="family_id" value={familyId} />
                  <input type="hidden" name="trip_id" value={context.tripId} />
                  <input type="hidden" name="category" value={config.key} />
                  <input type="hidden" name="question_text" value={questionText} />
                  <input type="hidden" name="date_label" value={dateLabel} />
                  <input type="hidden" name="location_label" value={context.locationLabel} />
                  <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
                  <input type="hidden" name="member_names" value={context.memberNames.join(",")} />
                  <input type="hidden" name="is_regenerate" value="true" />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5"
                    style={{
                      background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                      borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={11} strokeWidth={1.6} />
                    Aktualisieren
                  </button>
                </form>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                Noch keine KI-Empfehlung für {config.label.toLowerCase()} in {context.locationLabel}.
              </p>
              <form action={generateCategorySuggestion}>
                <input type="hidden" name="family_id" value={familyId} />
                <input type="hidden" name="trip_id" value={context.tripId} />
                <input type="hidden" name="category" value={config.key} />
                <input type="hidden" name="question_text" value={questionText} />
                <input type="hidden" name="date_label" value={dateLabel} />
                <input type="hidden" name="location_label" value={context.locationLabel} />
                <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
                <input type="hidden" name="member_names" value={context.memberNames.join(",")} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button
                  type="submit"
                  style={{
                    background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                    padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                  }}
                >
                  {config.aiButtonLabel}
                </button>
              </form>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
