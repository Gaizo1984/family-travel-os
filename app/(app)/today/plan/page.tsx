import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { isTripCurrentlyRunning, isTripHistorical } from "@/lib/trip-status";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import { generateDayPlan, getLatestDayPlan, type DayPlan, type DayPlanMode } from "@/lib/actions/day-planner";
import { commitDayPlanToJourney } from "@/lib/actions/lumi-journey";
import { Banner } from "@/components/Banner";

type TripRow = { id: string; slug: string; status: string; start_date: string | null; end_date: string | null };

const MODE_OPTIONS: Array<{ value: DayPlanMode; label: string }> = [
  { value: "today", label: "Heute planen" },
  { value: "tomorrow", label: "Morgen planen" },
  { value: "bad_weather", label: "Schlechtwetter-Tag" },
  { value: "morning", label: "Vormittag" },
  { value: "afternoon", label: "Mittag/Nachmittag" },
  { value: "dinner", label: "Restaurantabend" },
  { value: "custom", label: "Individueller Wunsch" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

export default async function DayPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; new?: string }>;
}) {
  const { error, new: startNew } = await searchParams;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const todayIso = todayIsoInFamilyTimezone();

  const { data: trips } = await supabase.from("trips").select("id, slug, status, start_date, end_date").eq("family_id", familyId);
  const allTrips = (trips ?? []) as TripRow[];
  const activeTrip = allTrips.find((t) => isTripCurrentlyRunning(t, todayIso));
  const nextTrip = !activeTrip
    ? allTrips.filter((t) => t.status !== "archived" && !isTripHistorical(t, todayIso)).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0] ?? null
    : null;
  const trip = activeTrip ?? nextTrip;

  const backLink = (
    <Link href="/today" className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}>
      <ChevronLeft size={13} strokeWidth={1.5} />
      LUMI
    </Link>
  );

  if (!trip) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          {backLink}
          <Card><p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Sobald eine Reise geplant oder aktiv ist, hilft LUMI euch hier beim Tagesplan.</p></Card>
        </div>
      </div>
    );
  }

  // §Bugfix "Tagestrips löschen sich bei Menüpunktwechsel": der zuletzt
  // erzeugte Plan kommt jetzt aus der DB (day_plan_cache) statt aus einem
  // flüchtigen Redirect-Query-Param -- er bleibt bei Navigation bestehen,
  // bis eine neue Ermittlung ihn überschreibt. "Neuen Plan erstellen"
  // verlinkt auf ?new=1, um gezielt wieder die Moduswahl zu zeigen.
  const plan: DayPlan | null = startNew ? null : await getLatestDayPlan(familyId, trip.id);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        {backLink}
        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Tagesplanung
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        {!plan && (
          <Card>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              LUMI baut euch eine echte Route aus Sehenswürdigkeiten, Natur, Stränden und Restaurants -- mit echten Fahrzeiten, nur auf Klick.
            </p>
            <form action={generateDayPlan} className="flex flex-col gap-2">
              <input type="hidden" name="family_id" value={familyId} />
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="return_to" value="/today/plan" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="submit"
                    name="mode"
                    value={opt.value}
                    style={{
                      background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)",
                      borderRadius: "8px", padding: "10px 12px", fontSize: "0.75rem", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </form>
          </Card>
        )}

        {plan && (
          <>
            <h1 className="font-light mb-1" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "-0.01em" }}>
              {plan.title}
            </h1>
            <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Gesamtfahrzeit ca. {plan.totalTravelMinutes} Min · {plan.totalTravelDistanceKm} km
            </p>

            <div className="space-y-2.5 mb-5">
              {plan.stops.map((stop, i) => (
                <Card key={stop.placeId}>
                  <div className="flex items-center justify-between mb-1">
                    <div style={{ color: "var(--foreground)", fontSize: "0.9rem" }}>{i + 1}. {stop.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{stop.travelMinutes} Min · {stop.travelDistanceKm} km</div>
                  </div>
                  <div className="mb-2" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                    ca. {stop.stopDurationMinutes} Min vor Ort
                  </div>
                  {stop.why && <p style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>{stop.why}</p>}
                </Card>
              ))}
            </div>

            <Card>
              <div className="flex flex-col gap-1.5" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                {plan.weatherNote && <div>☀ {plan.weatherNote}</div>}
                {plan.kidsNote && <div>👨‍👩‍👧‍👦 {plan.kidsNote}</div>}
                {plan.mealBreakNote && <div>🍽 {plan.mealBreakNote}</div>}
                <div>🕐 {plan.returnNote}</div>
                <div style={{ color: "var(--muted)", opacity: 0.8 }}>{plan.alternativeNote}</div>
              </div>
            </Card>

            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <form action={commitDayPlanToJourney}>
                <input type="hidden" name="trip_id" value={trip.id} />
                <input type="hidden" name="trip_slug" value={trip.slug} />
                <input type="hidden" name="date" value={todayIso} />
                <input type="hidden" name="plan" value={JSON.stringify(plan)} />
                <button
                  type="submit"
                  style={{
                    background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                    padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                  }}
                >
                  Ins Journey übernehmen
                </button>
              </form>
              <Link href="/today/plan?new=1" style={{ color: "var(--muted)", fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                Neuen Plan erstellen
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
