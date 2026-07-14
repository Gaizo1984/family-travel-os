import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, AlertTriangle, CircleAlert, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeTripReadiness, READINESS_THEME_LABELS } from "@/lib/readiness";
import type { ReadinessTheme } from "@/lib/readiness";
import { isTripHistorical } from "@/lib/trip-status";
import { deriveTripDateRange } from "@/lib/trip-dates";

const THEME_ORDER: ReadinessTheme[] = ["documents", "entry", "insurance", "itinerary", "bookings"];

function SeverityIcon({ severity }: { severity: "conflict" | "hint" }) {
  return severity === "conflict"
    ? <CircleAlert size={14} strokeWidth={1.5} style={{ color: "#B5624A", flexShrink: 0 }} />
    : <AlertTriangle size={14} strokeWidth={1.5} style={{ color: "#B89A5E", flexShrink: 0 }} />;
}

export default async function ReadyToTravelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: tripRaw } = await supabase
    .from("trips")
    .select("id, slug, title, status, start_date, end_date, stages ( start_date, end_date ), bookings ( type, status, start_datetime, end_datetime )")
    .eq("slug", id)
    .maybeSingle();

  if (!tripRaw) notFound();

  // §"Reisezeitraum automatisch ableiten": ohne manuelles Datum, aber mit
  // Buchungen/Etappen, gilt die Reise trotzdem korrekt als "erlebt" (lib/trip-dates.ts).
  const tripDateRange = deriveTripDateRange(tripRaw, tripRaw.bookings, tripRaw.stages);
  const trip = { ...tripRaw, start_date: tripDateRange.startDate, end_date: tripDateRange.endDate };

  if (isTripHistorical(trip)) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          <Link
            href={`/trips/${trip.slug}`}
            className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
            style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            {trip.title}
          </Link>
          <div className="rounded-xl p-6 flex items-center gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <CircleCheck size={18} strokeWidth={1.4} style={{ color: "#4C7A5D", flexShrink: 0 }} />
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Diese Reise ist bereits abgeschlossen — hier gibt es nichts mehr vorzubereiten.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const result = await computeTripReadiness(trip.id);

  const statusLabel = result.status === "ready"
    ? "Reisebereit"
    : result.status === "conflicts"
      ? `${result.conflictCount} ${result.conflictCount === 1 ? "ToDo" : "ToDos"}`
      : `${result.hintCount} ${result.hintCount === 1 ? "Punkt" : "Punkte"} prüfen`;
  const statusColor = result.status === "ready" ? "#4C7A5D" : result.status === "conflicts" ? "#B5624A" : "#B89A5E";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Ready to Travel
        </div>
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
            {trip.title}
          </h1>
          <span
            style={{
              color: statusColor, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
              border: `1px solid ${statusColor}55`, padding: "4px 12px", borderRadius: "20px",
            }}
          >
            {statusLabel}
          </span>
        </div>

        {result.status === "ready" && (
          <div className="rounded-xl p-6 flex items-center gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <CircleCheck size={18} strokeWidth={1.4} style={{ color: "#4C7A5D", flexShrink: 0 }} />
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Keine offensichtlichen Lücken oder ToDos in den vorhandenen Daten gefunden.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {THEME_ORDER.map((theme) => {
            const themeFindings = result.findings.filter((f) => f.theme === theme);
            if (themeFindings.length === 0) return null;
            return (
              <section key={theme}>
                <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                  {READINESS_THEME_LABELS[theme]}
                </div>
                <div className="space-y-2">
                  {themeFindings.map((finding, idx) => (
                    <Link
                      key={idx}
                      href={finding.href}
                      className="flex items-start gap-3 p-4 rounded-xl transition-colors"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                    >
                      <SeverityIcon severity={finding.severity} />
                      <span style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                        {finding.message}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

      </div>
    </div>
  );
}
