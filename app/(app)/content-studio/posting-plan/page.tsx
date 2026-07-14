import Link from "next/link";
import { ChevronLeft, Clock, Gauge, CalendarDays } from "lucide-react";
import { getFamily } from "@/lib/family";
import { buildContentPostingPlanContext } from "@/lib/content-strategy-context";
import { getOrGeneratePostingPlan } from "@/lib/content-strategy";
import { regenerateContentStrategy } from "@/lib/actions/content-strategy-actions";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

/**
 * §"KI Urlaubs-/Postingfahrplan" ersetzt "Bilder analysieren" (hatte massive
 * Überschneidung mit "Content-Idee erstellen" und wurde von der neuen
 * Content-Session vollständig überholt). Zeigt statt nur "Today's Content
 * Strategy" (ein Tag, auf dem Hub) die nächsten Tage der laufenden Reise --
 * dieselbe content_strategies-Cache-Tabelle/KI, nur über mehrere Tage
 * geloopt (lib/content-strategy.ts::getOrGeneratePostingPlan). Keine neue
 * Migration, keine zweite Content-Strategie-Logik.
 */
export default async function ContentPostingPlanPage() {
  const { id: familyId } = await getFamily();
  const context = await buildContentPostingPlanContext(familyId);
  const days = context ? await getOrGeneratePostingPlan(familyId, context) : [];
  const returnTo = "/content-studio/posting-plan";

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Content-Fahrplan
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {context ? `Die nächsten Tage in ${context.tripTitle}` : "Kein aktiver Reisetag"}
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
          LUMI schlägt für jeden kommenden Tag vor, ob und wie sich ein Post lohnt -- basierend auf Wetter,
          bekanntem Tagesplan und Etappen. Keine Pflicht, nur eine Orientierung.
        </p>

        {!context && (
          <Card>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
              Der Content-Fahrplan steht zur Verfügung, sobald eine Reise gerade läuft -- er plant anhand von
              Wetter, Etappen und bekanntem Tagesplan, wann sich ein Post lohnt.
            </p>
          </Card>
        )}

        {days.map((day) => {
          const dayContext = context!.days.find((d) => d.forDate === day.forDate);
          return (
          <Card key={day.forDate}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={13} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.06em" }}>{day.dateLabel} · {day.locationLabel}</span>
            </div>

            <div style={{ color: "var(--accent)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>
              {day.contentType}
            </div>
            <p className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem", lineHeight: 1.5 }}>
              {day.storyline}
            </p>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
              {day.reasoning}
            </p>

            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
              Shotliste
            </div>
            <ul className="mb-4 space-y-1.5">
              {day.shotlist.map((shot, i) => (
                <li key={i} className="flex items-start gap-2" style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0 }}>{i + 1}.</span>
                  {shot}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-5 flex-wrap mb-5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
              <div className="flex items-center gap-1.5">
                <Clock size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
                {day.bestTime}
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
                Aufwand: {day.effort}
              </div>
            </div>

            <form action={regenerateContentStrategy}>
              <input type="hidden" name="family_id" value={familyId} />
              <input type="hidden" name="trip_id" value={context!.tripId} />
              <input type="hidden" name="for_date" value={day.forDate} />
              <input type="hidden" name="date_label" value={day.dateLabel} />
              <input type="hidden" name="location_label" value={day.locationLabel} />
              <input type="hidden" name="weather_summary" value={dayContext?.weatherSummary ?? ""} />
              <input type="hidden" name="known_plan_text" value={dayContext?.knownPlanText ?? ""} />
              <input type="hidden" name="highlight_title" value={dayContext?.highlightTitle ?? ""} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button
                type="submit"
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "6px", padding: "8px 16px", fontSize: "0.62rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Andere Idee für diesen Tag
              </button>
            </form>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
