import { Star, Wallet, Zap, PlaneTakeoff, Luggage, Check, X as XIcon, HelpCircle, CalendarRange, Bookmark } from "lucide-react";
import { FlightScoringService } from "@/lib/flight-scoring-service";
import { formatDateDE } from "@/lib/demo-data";
import type { FlightSearchOption, FlightItinerary, FlightBadge, CheckedBaggageStatus, BaggageEntryStatus } from "@/lib/flight-types";

export type FlightDateContext = { departureDate: string; returnDate: string | null; nights: number | null };

const BADGE_LABELS: Record<FlightBadge, string> = {
  lumi_empfehlung: "LUMI Empfehlung",
  preis_leistung: "Bestes Preis-Leistungs-Verhältnis",
  schnellste: "Schnellste Verbindung",
  direktflug: "Direktflug",
  gepaeck_inklusive: "Gepäck inklusive",
};

const BADGE_ICONS: Record<FlightBadge, React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>> = {
  lumi_empfehlung: Star,
  preis_leistung: Wallet,
  schnellste: Zap,
  direktflug: PlaneTakeoff,
  gepaeck_inklusive: Luggage,
};

/** §"Gepäcklogik": vier ehrliche Zustände statt einer einzigen Ja/Nein-Vereinfachung -- nie geraten. */
const BAGGAGE_LABELS: Record<CheckedBaggageStatus, string> = {
  included: "Aufgabegepäck inklusive",
  partial: "Gepäck teilweise inklusive",
  none: "Kein Aufgabegepäck enthalten",
  not_verified: "Gepäck nicht verifiziert",
};

const BAGGAGE_ENTRY_ICON: Record<BaggageEntryStatus, React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>> = {
  included: Check,
  excluded: XIcon,
  unknown: HelpCircle,
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}. ${hours}:${minutes}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}min` : ""}`;
}

/** §"Pro Segment tatsächlichen Operating Carrier und Flugnummer darstellen": jedes Segment einzeln, keine Zusammenfassung auf das erste Segment. */
function ItineraryBlock({ label, itinerary }: { label: string; itinerary: FlightItinerary }) {
  return (
    <div className="mb-2">
      <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
        {label} · {formatDuration(itinerary.durationMinutes)} · {itinerary.stopCount === 0 ? "Direkt" : `${itinerary.stopCount} Umstieg${itinerary.stopCount > 1 ? "e" : ""}`}
      </div>
      <div className="flex flex-col gap-1">
        {itinerary.segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between gap-3 flex-wrap" style={{ fontSize: "0.76rem" }}>
            <div style={{ color: "var(--foreground)" }}>
              {seg.departureAirport} {formatDateTime(seg.departureTime)} → {seg.arrivalAirport} {formatDateTime(seg.arrivalTime)}
            </div>
            <div style={{ color: "var(--muted)" }}>
              {seg.carrierName ?? seg.carrierCode} {seg.flightNumber}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BaggageDetail({ option }: { option: FlightSearchOption }) {
  const itineraries: Array<{ label: string; itinerary: FlightItinerary }> = [
    { label: "Hinflug", itinerary: option.outbound },
    ...(option.inbound ? [{ label: "Rückflug", itinerary: option.inbound }] : []),
  ];
  return (
    <details className="mt-2">
      <summary style={{ color: "var(--muted)", fontSize: "0.68rem", cursor: "pointer" }}>Gepäck-Details je Segment/Reisendem anzeigen</summary>
      <div className="mt-2 flex flex-col gap-2">
        {itineraries.map(({ label, itinerary }) =>
          itinerary.segments.map((seg, segIdx) => (
            <div key={`${label}-${segIdx}`} style={{ fontSize: "0.68rem" }}>
              <div style={{ color: "var(--muted)" }}>{label}, Segment {segIdx + 1} ({seg.departureAirport}→{seg.arrivalAirport}):</div>
              <div className="flex flex-wrap gap-3 mt-1">
                {seg.checkedBaggageByPassenger.map((entry, pIdx) => {
                  const Icon = BAGGAGE_ENTRY_ICON[entry];
                  return (
                    <span key={pIdx} className="inline-flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                      <Icon size={11} strokeWidth={1.8} />
                      Reisender {pIdx + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          )),
        )}
      </div>
    </details>
  );
}

export function FlightCard({
  option, searchedAt, dateContext, searchKey, returnTo, isSaved, saveDisabled, saveAction,
}: {
  option: FlightSearchOption; searchedAt: string; dateContext?: FlightDateContext
  /** §"Bis zu 3 Flugverbindungen pro Strecke merken": nur gesetzt, wenn diese Karte aus einer Suche stammt (nicht bei bereits gemerkten Karten -- die haben kein "Merken"-Formular mehr, siehe `isSaved`-Aufrufer in app/(app)/discover/flights/page.tsx). */
  searchKey?: string
  returnTo?: string
  isSaved?: boolean
  saveDisabled?: boolean
  saveAction?: (formData: FormData) => void | Promise<void>
}) {
  const isExpired = FlightScoringService.isExpired(option);

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: isExpired ? 0.55 : 1 }}>
      {dateContext && (
        <div className="flex items-center gap-1.5 mb-3" style={{ color: "var(--accent)", fontSize: "0.68rem" }}>
          <CalendarRange size={12} strokeWidth={1.6} />
          {formatDateDE(dateContext.departureDate)}
          {dateContext.returnDate ? ` – ${formatDateDE(dateContext.returnDate)}` : ""}
          {dateContext.nights ? ` · ${dateContext.nights} ${dateContext.nights === 1 ? "Nacht" : "Nächte"}` : ""}
        </div>
      )}
      {option.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {option.badges.map((badge) => {
            const Icon = BADGE_ICONS[badge];
            return (
              <span
                key={badge}
                className="inline-flex items-center gap-1"
                style={{
                  color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.04em",
                  border: "1px solid rgba(184,154,94,0.4)", borderRadius: "20px", padding: "3px 9px",
                }}
              >
                <Icon size={10} strokeWidth={1.8} />
                {BADGE_LABELS[badge]}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
          {option.outbound.segments.length} Segment{option.outbound.segments.length > 1 ? "e" : ""} Hinflug{option.inbound ? `, ${option.inbound.segments.length} Rückflug` : ""}
        </div>
        <div className="text-right">
          <div style={{ color: "var(--foreground)", fontSize: "1.1rem", fontWeight: 300, whiteSpace: "nowrap" }}>
            {option.price} {option.currency}
          </div>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem" }}>Preis-Momentaufnahme vom {formatDateTime(searchedAt)}</div>
        </div>
      </div>

      {isExpired && (
        <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.35)" }}>
          <p style={{ color: "#B5624A", fontSize: "0.68rem" }}>Preis nicht mehr aktuell -- bitte neu suchen.</p>
        </div>
      )}

      <div className="mb-3">
        <ItineraryBlock label="Hinflug" itinerary={option.outbound} />
        {option.inbound && <ItineraryBlock label="Rückflug" itinerary={option.inbound} />}
      </div>

      <div className="flex items-center gap-1.5 mb-1" style={{ fontSize: "0.72rem", color: option.checkedBaggageStatus === "included" ? "var(--foreground)" : "var(--muted)" }}>
        <Luggage size={12} strokeWidth={1.6} />
        {BAGGAGE_LABELS[option.checkedBaggageStatus]}
      </div>
      <BaggageDetail option={option} />

      {option.aiReasoning && (
        <p className="mt-3 mb-2 italic leading-relaxed" style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{option.aiReasoning}</p>
      )}

      {option.comparisonHints.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          {option.comparisonHints.map((hint, i) => (
            <div key={i} style={{ color: "var(--accent)", fontSize: "0.68rem" }}>{hint}</div>
          ))}
        </div>
      )}

      {searchKey && saveAction && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {isSaved ? (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)", fontSize: "0.7rem" }}>
              <Bookmark size={12} strokeWidth={1.8} fill="currentColor" />
              Gemerkt
            </span>
          ) : (
            <form action={saveAction}>
              <input type="hidden" name="search_key" value={searchKey} />
              <input type="hidden" name="option_id" value={option.id} />
              <input type="hidden" name="return_to" value={returnTo ?? ""} />
              <button
                type="submit"
                disabled={saveDisabled}
                className="inline-flex items-center gap-1.5"
                style={{
                  background: "none", border: "none", padding: 0, fontSize: "0.7rem",
                  color: saveDisabled ? "var(--muted)" : "var(--accent)",
                  cursor: saveDisabled ? "not-allowed" : "pointer",
                }}
              >
                <Bookmark size={12} strokeWidth={1.8} />
                {saveDisabled ? "Limit erreicht (3/3) -- bitte erst eine löschen" : "Diese Verbindung merken"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
