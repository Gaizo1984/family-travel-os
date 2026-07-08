import Link from "next/link";
import { ChevronRight, Plane, Clock, ArrowRight, Info } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";

// ── Data ─────────────────────────────────────────────────────────────────────

interface FlightOption {
  id: string;
  title: string;
  badge: string | null;
  recommended: boolean;
  fromCode: string;
  fromCity: string;
  fromTime: string;
  toCode: string;
  toCity: string;
  toTime: string;
  viaCode: string | null;
  viaCity: string | null;
  duration: string;
  flightType: string;
  cabin: string;
  isNight: boolean;
  character: string;
  desc: string;
  pros: string[];
  familyHint: string;
  honestHint: string | null;
  demoPrice: number;
}

const FLIGHTS: FlightOption[] = [
  {
    id: "direkt-economy",
    title: "Direkt und unkompliziert",
    badge: "PASST BESONDERS GUT ZU EUCH",
    recommended: true,
    fromCode: "FRA",
    fromCity: "Frankfurt",
    fromTime: "20:30",
    toCode: "MCT",
    toCity: "Muscat",
    toTime: "06:15",
    viaCode: null,
    viaCity: null,
    duration: "ca. 7 Std.",
    flightType: "Direktflug",
    cabin: "Economy",
    isNight: true,
    character: "Einsteigen. Schlafen. Ankommen.",
    desc: "Ein Direktflug, der genau das tut, was ihr von ihm braucht: euch ohne Umwege und ohne Anschlussrisiko in Muscat absetzen.",
    pros: [
      "Kein Umstieg, kein Anschlussrisiko",
      "Nur einmal mit Gepäck und Kindern einsteigen",
      "Früher Morgen in Muscat",
      "Schlafen und Ankommen",
    ],
    familyHint: "Mit Lumi ist die einfachste Verbindung oft die wertvollste.",
    honestHint:
      "Die erste Nacht kann kurz werden. Ein früher Check-in im Chedi wäre wichtig.",
    demoPrice: 4850,
  },
  {
    id: "umstieg-economy",
    title: "Der günstigere Weg",
    badge: null,
    recommended: false,
    fromCode: "FRA",
    fromCity: "Frankfurt",
    fromTime: "14:10",
    toCode: "MCT",
    toCity: "Muscat",
    toTime: "01:20",
    viaCode: "DOH",
    viaCity: "Doha",
    duration: "ca. 10 Std.",
    flightType: "1 Zwischenstopp",
    cabin: "Economy",
    isNight: false,
    character: "Mehr Reisezeit, dafür möglicherweise deutlich günstiger.",
    desc: "Eine attraktiv bepreiste Verbindung über Doha – mit einem Umstieg, der für zwei Erwachsene kaum ein Thema wäre.",
    pros: [
      "Günstigere Preise möglich",
      "Kurze Teilstrecken",
      "Moderner Umsteigeflughafen",
    ],
    familyHint: "Der Umstieg fällt wahrscheinlich in Lumis Schlafenszeit.",
    honestHint:
      "Eine Ankunft mitten in der Nacht passt weniger gut zu eurem gewünschten ruhigen Reisestart.",
    demoPrice: 3650,
  },
  {
    id: "direkt-business",
    title: "Mehr Komfort",
    badge: null,
    recommended: false,
    fromCode: "FRA",
    fromCity: "Frankfurt",
    fromTime: "22:00",
    toCode: "MCT",
    toCity: "Muscat",
    toTime: "07:30",
    viaCode: null,
    viaCity: null,
    duration: "ca. 7 Std.",
    flightType: "Direktflug",
    cabin: "Business Class",
    isNight: true,
    character: "Die Reise beginnt bereits im Flugzeug.",
    desc: "Lounge, flaches Bett, Priorität am Flughafen. Die erste Investition in die Reise – und die deutlichste.",
    pros: [
      "Mehr Schlaf durch flaches Bett",
      "Lounge am Flughafen",
      "Priorität beim Check-in",
      "Entspannterer erster Reisetag",
    ],
    familyHint:
      "Bei fünf Reisenden ist der Komfortgewinn groß – der Aufpreis aber ebenfalls.",
    honestHint: null,
    demoPrice: 13900,
  },
];

const OPEN_ITEMS = [
  "Echte Flugzeiten im Oktober 2028",
  "Tatsächlicher Gesamtpreis für fünf Personen",
  "Gepäckzuschläge und -konditionen",
  "Sitzplatzreservierungskosten",
  "Stornierungsbedingungen",
  "Flugzeugtyp und Konfiguration",
  "Verfügbarkeit zusammenhängender Sitzplätze",
  "Früher Check-in im Chedi Muscat",
];

const TRUE_PRICE_FACTORS = [
  "Ticketpreis",
  "Gepäck",
  "Sitzplätze",
  "Zubringer zum Flughafen",
  "Lounge (optional)",
  "Hotelnacht bei ungünstiger Ankunft",
  "Verlorene Reisezeit",
];

const PERSPECTIVES = [
  { who: "Für Sarah & Marcel", text: "Weniger Organisation und ein klarer Start in die Reise." },
  { who: "Für Lia & Elias",   text: "Keine Wartezeit an einem Umsteigeflughafen." },
  { who: "Für Lumi",          text: "Nur einmal einsteigen, einmal schlafen und ankommen." },
  { who: "Für die Reise",     text: "Der erste Tag beginnt in Muscat – nicht auf einem Flughafen." },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--muted)",
        fontSize: "0.58rem",
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}

function FlightLine({ flight }: { flight: FlightOption }) {
  return (
    <div
      className="py-6 px-7"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-4 md:gap-8">
        {/* Departure */}
        <div className="text-right shrink-0" style={{ minWidth: "80px" }}>
          <div
            className="font-light leading-none mb-1"
            style={{ color: "var(--foreground)", fontSize: "1.9rem", letterSpacing: "-0.01em" }}
          >
            {flight.fromTime}
          </div>
          <div
            style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em" }}
          >
            {flight.fromCode}
          </div>
          <div
            style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.04em", opacity: 0.7 }}
          >
            {flight.fromCity}
          </div>
        </div>

        {/* Flight line */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          {/* Via indicator */}
          {flight.viaCity && (
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.58rem",
                letterSpacing: "0.1em",
                textAlign: "center",
              }}
            >
              über {flight.viaCity} ({flight.viaCode})
            </div>
          )}

          {/* Line */}
          <div className="flex items-center w-full gap-2">
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            {flight.viaCode && (
              <>
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    border: "1px solid var(--muted)",
                    background: "var(--surface)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
              </>
            )}
            <Plane
              size={12}
              strokeWidth={1.5}
              style={{ color: "var(--accent)", flexShrink: 0 }}
            />
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          </div>

          {/* Duration */}
          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.6rem",
              letterSpacing: "0.08em",
              textAlign: "center",
            }}
          >
            {flight.duration}
          </div>
        </div>

        {/* Arrival */}
        <div className="shrink-0" style={{ minWidth: "80px" }}>
          <div
            className="font-light leading-none mb-1"
            style={{ color: "var(--foreground)", fontSize: "1.9rem", letterSpacing: "-0.01em" }}
          >
            {flight.toTime}
          </div>
          <div
            style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em" }}
          >
            {flight.toCode}
          </div>
          <div
            style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.04em", opacity: 0.7 }}
          >
            {flight.toCity}
          </div>
        </div>
      </div>

      {/* Flight meta */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {[flight.flightType, flight.cabin, flight.isNight ? "Nachtflug" : "Tagflug"].map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.1em",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              padding: "3px 10px",
              borderRadius: "20px",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function FlightCard({ flight }: { flight: FlightOption }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: flight.recommended
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Accent bar */}
      {flight.recommended && (
        <div style={{ height: "3px", background: "var(--accent)" }} />
      )}

      {/* Card header */}
      <div
        className="px-7 pt-6 pb-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {flight.badge && (
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.52rem",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {flight.badge}
              </div>
            )}
            <h2
              className="font-light mb-1"
              style={{
                color: "var(--foreground)",
                fontSize: "1.25rem",
                letterSpacing: "0.01em",
              }}
            >
              {flight.title}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.8rem",
                fontStyle: "italic",
              }}
            >
              „{flight.character}"
            </p>
          </div>
          {/* Demo price */}
          <div className="text-right shrink-0">
            <div
              className="font-light"
              style={{ color: "var(--foreground)", fontSize: "1.3rem" }}
            >
              {flight.demoPrice.toLocaleString("de-DE")} €
            </div>
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.52rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Demo · 5 Personen
            </div>
          </div>
        </div>
      </div>

      {/* Visual flight line */}
      <FlightLine flight={flight} />

      {/* Body: pros + family hint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Pros */}
        <div
          className="p-6"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "14px",
            }}
          >
            Vorteile
          </div>
          <div className="space-y-2.5">
            {flight.pros.map((pro) => (
              <div key={pro} className="flex items-start gap-2.5">
                <div
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    flexShrink: 0,
                    marginTop: "6px",
                  }}
                />
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  {pro}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Family + honest hint */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.55rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              Für eure Familie
            </div>
            <p style={{ color: "var(--foreground)", fontSize: "0.78rem", lineHeight: 1.6 }}>
              {flight.familyHint}
            </p>
          </div>

          {flight.honestHint && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <Info
                size={12}
                strokeWidth={1.5}
                style={{ color: "var(--muted)", flexShrink: 0, marginTop: "2px" }}
              />
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.72rem",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                {flight.honestHint}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-7 py-5 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          style={{
            background: flight.recommended ? "var(--foreground)" : "transparent",
            color: flight.recommended ? "var(--surface)" : "var(--muted)",
            border: flight.recommended
              ? "1px solid var(--foreground)"
              : "1px solid var(--border)",
            borderRadius: "6px",
            padding: "10px 22px",
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {flight.recommended ? "Direktflug vormerken" : "Diese Verbindung wählen"}
        </button>
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            fontSize: "0.62rem",
            letterSpacing: "0.08em",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Andere Verbindung wählen
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OmanFlightsPage() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-5 md:px-8 pb-24">

        {/* ── 1. Header ── */}
        <div className="pt-10 pb-10">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 mb-7 flex-wrap"
            style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em" }}
          >
            <Link href="/plan" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Neue Reise
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <Link href="/plan/oman" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Oman
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <Link href="/plan/oman" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Oman in Balance
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <span style={{ color: "var(--foreground)" }}>Flüge</span>
          </div>

          <div
            style={{
              color: "var(--accent)",
              fontSize: "0.55rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              marginBottom: "14px",
            }}
          >
            Der erste Teil der Reise
          </div>
          <h1
            className="font-light leading-tight mb-3"
            style={{
              color: "var(--foreground)",
              fontSize: "clamp(1.8rem, 4.5vw, 2.8rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Wie wollt ihr ankommen?
          </h1>
          <p
            className="leading-relaxed mb-7 max-w-xl"
            style={{ color: "var(--muted)", fontSize: "0.9rem" }}
          >
            Der beste Flug ist nicht immer der günstigste. Entscheidend ist, wie sich die Reise für euch fünf anfühlt.
          </p>

          {/* Route meta */}
          <div
            className="flex items-center gap-4 flex-wrap"
            style={{
              padding: "14px 20px",
              borderRadius: "10px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "inline-flex",
            }}
          >
            <div className="flex items-center gap-2">
              <Plane size={11} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 300 }}>
                Frankfurt → Muscat
              </span>
            </div>
            <div
              style={{ width: "1px", height: "14px", background: "var(--border)" }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>Oktober 2028</span>
            <div
              style={{ width: "1px", height: "14px", background: "var(--border)" }}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>5 Reisende</span>
          </div>
        </div>

        {/* ── 2. Reisekontext ── */}
        <section className="mb-12">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--accent)",
                fontSize: "0.55rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                marginBottom: "14px",
              }}
            >
              Was für euch bei diesem Flug zählt
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-7">
              {[
                "Lumi ist 2 Jahre alt",
                "Fünf Reisende",
                "Langer Anreise vermeiden",
                "Keinen ersten Urlaubstag verlieren",
                "Genug Gepäck für 14 Tage",
                "Entspannter Start in Muscat",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: "var(--accent)",
                      flexShrink: 0,
                      marginTop: "6px",
                    }}
                  />
                  <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{item}</span>
                </div>
              ))}
            </div>

            <div
              style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}
            >
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.85rem",
                  fontWeight: 300,
                  fontStyle: "italic",
                  lineHeight: 1.7,
                }}
              >
                „Weil eure Reise im Chedi ruhig beginnt, ist eine angenehme Ankunft
                wichtiger als die frühestmögliche Landung."
              </p>
            </div>
          </div>
        </section>

        {/* ── 3–5. Drei Flugverbindungen ── */}
        <section className="mb-14">
          <SectionLabel>Drei Verbindungen für eure Familie</SectionLabel>
          <div className="space-y-5">
            {FLIGHTS.map((flight) => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
          </div>
        </section>

        {/* ── 6. Unsere Empfehlung ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--accent)",
                fontSize: "0.55rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                marginBottom: "14px",
              }}
            >
              Warum wir zum Direktflug tendieren
            </div>
            <p
              className="leading-relaxed mb-8 max-w-xl"
              style={{
                color: "var(--foreground)",
                fontSize: "0.88rem",
                fontStyle: "italic",
                fontWeight: 300,
              }}
            >
              „Eure Reise hat vier Stationen. Deshalb muss bereits die Anreise nicht zum ersten
              Abenteuer werden. Ein Direktflug reduziert genau die Reibung, die mit fünf
              Reisenden und einer zweijährigen Lumi unnötig wäre."
            </p>

            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-4"
              style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}
            >
              {PERSPECTIVES.map((p) => (
                <div key={p.who}>
                  <div
                    style={{
                      color: "var(--accent)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    {p.who}
                  </div>
                  <p
                    style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.6 }}
                  >
                    {p.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. Was kostet der Komfort? ── */}
        <section className="mb-14">
          <SectionLabel>Wann lohnt sich die bessere Verbindung?</SectionLabel>

          {/* Price comparison cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {[
              { label: "Direktflug Economy", price: "4.850 €", highlighted: true },
              { label: "Umsteigeverbindung Economy", price: "3.650 €", highlighted: false },
              { label: "Direktflug Business Class", price: "13.900 €", highlighted: false },
            ].map(({ label, price, highlighted }) => (
              <div
                key={label}
                className="p-5 rounded-xl"
                style={{
                  background: "var(--surface)",
                  border: highlighted ? "1px solid var(--accent)" : "1px solid var(--border)",
                }}
              >
                <div
                  style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: "8px" }}
                >
                  {label}
                </div>
                <div
                  className="font-light"
                  style={{
                    color: "var(--foreground)",
                    fontSize: "1.4rem",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {price}
                </div>
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.52rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginTop: "4px",
                    opacity: 0.7,
                  }}
                >
                  Demo-Preis · 5 Personen
                </div>
              </div>
            ))}
          </div>

          {/* Insight text */}
          <div
            className="rounded-xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p
              className="leading-relaxed mb-5"
              style={{ color: "var(--muted)", fontSize: "0.82rem" }}
            >
              Die günstigste Verbindung spart 1.200 €. Dafür kostet sie euch drei zusätzliche
              Reisestunden, einen Umstieg mit fünf Personen und eine Ankunft mitten in der Nacht.
            </p>
            <p
              className="mb-3"
              style={{ color: "var(--muted)", fontSize: "0.82rem" }}
            >
              Die Frage ist nicht nur: Was kostet der Flug?
            </p>
            <div
              style={{
                color: "var(--foreground)",
                fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
                fontWeight: 300,
                fontStyle: "italic",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              „Was kostet euch die schlechtere Verbindung?"
            </div>
          </div>
        </section>

        {/* ── 8. Family Travel Value ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <SectionLabel>So denken wir über den Aufpreis</SectionLabel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-7">
              {/* Savings */}
              <div>
                <div
                  className="font-light mb-2"
                  style={{ color: "var(--foreground)", fontSize: "2rem" }}
                >
                  1.200 €
                </div>
                <div
                  style={{ color: "var(--accent)", fontSize: "0.62rem", letterSpacing: "0.1em" }}
                >
                  Ersparnis gegenüber dem Direktflug
                </div>
              </div>

              {/* Cost */}
              <div className="space-y-2">
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.55rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  Dafür
                </div>
                {[
                  "3 Stunden mehr Reisezeit",
                  "1 Umstieg mit fünf Personen",
                  "Ankunft mitten in der Nacht",
                  "Höheres Stressrisiko",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <div
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: "var(--muted)",
                        flexShrink: 0,
                        opacity: 0.6,
                      }}
                    />
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}
            >
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                  fontWeight: 300,
                  lineHeight: 1.7,
                  maxWidth: "520px",
                }}
              >
                „Für zwei Erwachsene wäre der Umstieg eine echte Alternative. Mit drei Kindern
                und Lumi als Zweijähriger würden wir für diese Reise zum Direktflug tendieren."
              </p>
            </div>
          </div>
        </section>

        {/* ── 9. Was noch geprüft werden muss ── */}
        <section className="mb-14">
          <SectionLabel>Bevor wir uns entscheiden</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPEN_ITEMS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    border: "1px solid var(--muted)",
                    flexShrink: 0,
                    opacity: 0.5,
                  }}
                />
                <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 10. Der echte Flugpreis ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              opacity: 0.8,
            }}
          >
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.55rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              Der echte Flugpreis
            </div>
            <p
              className="mb-6"
              style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}
            >
              Erst dann vergleichen wir wirklich.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUE_PRICE_FACTORS.map((f, idx) => (
                <div key={f} className="flex items-center gap-2">
                  <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{f}</span>
                  {idx < TRUE_PRICE_FACTORS.length - 1 && (
                    <span style={{ color: "var(--border)", fontSize: "0.8rem" }}>+</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 11. Direktflug vormerken ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--accent)" }}
          >
            <div style={{ height: "3px", background: "var(--accent)", borderRadius: "2px", width: "40px", marginBottom: "20px" }} />
            <h2
              className="font-light mb-2"
              style={{ color: "var(--foreground)", fontSize: "1.1rem" }}
            >
              Frankfurt → Muscat · Direktflug Economy
            </h2>
            <p
              className="mb-7"
              style={{ color: "var(--muted)", fontSize: "0.78rem" }}
            >
              20:30 → 06:15 · ca. 7 Std. · 5 Personen · Oktober 2028
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                style={{
                  background: "var(--foreground)",
                  color: "var(--surface)",
                  border: "none",
                  borderRadius: "6px",
                  padding: "12px 26px",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Direktflug vormerken
              </button>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Andere Verbindung wählen
              </button>
            </div>
          </div>
        </section>

        {/* ── 12. Abschluss ── */}
        <section>
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--foreground)",
                fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
                fontWeight: 300,
                fontStyle: "italic",
                marginBottom: "14px",
                lineHeight: 1.3,
              }}
            >
              „Die Reise beginnt nicht in Oman."
            </div>
            <p
              className="leading-relaxed mb-9"
              style={{ color: "var(--muted)", fontSize: "0.88rem", maxWidth: "440px" }}
            >
              Sie beginnt in dem Moment, in dem ihr zu Hause die Tür schließt.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/plan/oman/hotels"
                style={{
                  background: "var(--foreground)",
                  color: "var(--surface)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  borderRadius: "6px",
                  padding: "12px 24px",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Reise weiterentwickeln
                <ArrowRight size={11} strokeWidth={1.5} />
              </Link>
              <Link
                href="/plan/oman/budget"
                style={{
                  color: "var(--accent)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
              >
                Budget ansehen
              </Link>
              <Link
                href="/plan/oman"
                style={{
                  color: "var(--muted)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
              >
                Zurück zur Routenwahl
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
