import Link from "next/link";
import {
  Plane, Car, FileText, Shield, Clock, ArrowRight,
  ChevronRight, MapPin, Users, Check, Package, WifiOff,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────

// ── Data ─────────────────────────────────────────────────────────────────────

const READY_STATUS = [
  { label: "Flüge",         status: "Gebucht",   ok: true  },
  { label: "Hotel",         status: "Gebucht",   ok: true  },
  { label: "Mietwagen",     status: "Gebucht",   ok: true  },
  { label: "Offene Punkte", status: "3 Dinge",   ok: false },
];

const KEY_FACTS = [
  { label: "Abflug",         value: "Frankfurt" },
  { label: "Ziel",           value: "Costa Rica" },
  { label: "Reisezeitraum",  value: "23. Juli – 6. August" },
  { label: "Hotel",          value: "Westin Reserva Conchal" },
  { label: "Reisende",       value: "5 Personen" },
  { label: "Mietwagen",      value: "3 Tage" },
];

const BOOKINGS = [
  {
    Icon: Plane,
    type: "Flug",
    title: "Frankfurt → Costa Rica",
    status: "Gebucht",
    details: [
      { label: "Datum",      value: "23. Juli 2026" },
      { label: "Abflug",     value: "Demo-Platzhalter" },
      { label: "Ankunft",    value: "Demo-Platzhalter" },
      { label: "Reisende",   value: "5 Personen" },
      { label: "Gepäck",     value: "Aufgabegepäck" },
    ],
    cta: "Buchung ansehen",
  },
  {
    Icon: MapPin,
    type: "Hotel",
    title: "Westin Reserva Conchal",
    status: "Gebucht",
    details: [
      { label: "Check-in",       value: "23. Juli 2026" },
      { label: "Check-out",      value: "6. August 2026" },
      { label: "Nächte",         value: "14 Nächte" },
      { label: "Reisende",       value: "5 Personen" },
      { label: "Zimmer",         value: "Platzhalter" },
      { label: "Verpflegung",    value: "Platzhalter" },
    ],
    cta: "Hotel ansehen",
  },
  {
    Icon: Car,
    type: "Mietwagen",
    title: "3 Tage · Selbstfahrer",
    status: "Gebucht",
    details: [
      { label: "Abholung",  value: "Platzhalter" },
      { label: "Rückgabe",  value: "Platzhalter" },
      { label: "Fahrzeug",  value: "Platzhalter" },
    ],
    cta: "Buchung ansehen",
  },
];

const GENERAL_DOCS = [
  "Reiseübersicht",
  "Flugunterlagen",
  "Hotelbestätigung",
  "Mietwagenunterlagen",
  "Reiseversicherung",
];

const MEMBERS = ["Sarah", "Marcel", "Lia", "Elias", "Lumi"];

const OPEN_ITEMS = [
  {
    title: "Sitzplätze auswählen",
    hint: "Damit ihr im Flugzeug sinnvoll zusammensitzt.",
    context: "Flug",
  },
  {
    title: "Lunch für den Mietwagen-Tag reservieren",
    hint: "Der Tagesplan steht – der Tisch noch nicht.",
    context: "Ausflug",
  },
  {
    title: "Packliste für Lumi prüfen",
    hint: "Badesachen, Medikamente und Dinge für unterwegs.",
    context: "Vorbereitung",
  },
];

const PACKLISTEN = [
  { person: "Sarah",    status: "In Arbeit",           special: false },
  { person: "Marcel",   status: "Noch nicht begonnen", special: false },
  { person: "Lia",      status: "Fast fertig",          special: false },
  { person: "Elias",    status: "In Arbeit",            special: false },
  { person: "Lumi",     status: "In Arbeit",            special: true  },
  { person: "Für alle", status: "Noch nicht begonnen", special: false },
];

const LUMI_CATEGORIES = ["Schlafen", "Essen unterwegs", "Strand", "Gesundheit", "Flug"];

const OFFLINE_ITEMS = [
  "Reisepässe",
  "Flugdetails",
  "Hoteladresse",
  "Mietwagenunterlagen",
  "Versicherungsdaten",
  "Wichtige Kontakte",
];

const FAMILY_CHECKS = [
  { who: "Sarah & Marcel", text: "Reisedokumente vollständig",                                           special: false },
  { who: "Lia & Elias",    text: "Aktivitäten und Flug vorbereitet",                                     special: false },
  { who: "Lumi",           text: "Reiserhythmus, wichtige Dinge und Unterlagen mitgedacht",               special: true  },
];

const EMERGENCY_ITEMS = [
  { label: "Versicherung",               value: "Informationen hinterlegt" },
  { label: "Hotel",                      value: "Kontakt verfügbar" },
  { label: "Nächste medizinische Hilfe", value: "Später automatisch am Reiseort" },
  { label: "Wichtige Dokumente",         value: "Offline verfügbar geplant" },
];

const PROACTIVE_EXAMPLES = [
  "Lumis Reisepass läuft zu früh ab.",
  "Für den Mietwagen fehlt noch ein Fahrer.",
  "Der Restauranttisch für euren Ausflugstag ist noch offen.",
  "Für den Flug wurden noch keine Sitzplätze gewählt.",
];

const TIME_PHASES = [
  { when: "3 Monate vorher",  what: "Dokumente und Einreise" },
  { when: "4 Wochen vorher",  what: "Reservierungen und Ausflüge" },
  { when: "1 Woche vorher",   what: "Packlisten und letzte Details" },
  { when: "Am Abreisetag",    what: "Nur noch das, was ihr jetzt braucht" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--accent)",
        fontSize: "0.55rem",
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        marginBottom: "10px",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--muted)",
        fontSize: "0.58rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        marginBottom: "18px",
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "0.58rem",
        letterSpacing: "0.1em",
        padding: "3px 10px",
        borderRadius: "20px",
        background: ok ? "rgba(184,154,94,0.1)" : "rgba(37,33,29,0.06)",
        color: ok ? "var(--accent)" : "var(--foreground)",
        border: `1px solid ${ok ? "rgba(184,154,94,0.3)" : "var(--border)"}`,
      }}
    >
      {ok && <Check size={8} strokeWidth={2} />}
      {label}
    </span>
  );
}

function BookingCard({ b }: { b: (typeof BOOKINGS)[0] }) {
  const { Icon, type, title, status, details, cta } = b;
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Top bar */}
      <div
        style={{
          height: "2px",
          background: "linear-gradient(to right, var(--accent), transparent)",
        }}
      />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: "36px",
                height: "36px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <Icon size={14} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
            </div>
            <div>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                {type}
              </div>
              <h3
                className="font-medium"
                style={{ color: "var(--foreground)", fontSize: "0.9rem" }}
              >
                {title}
              </h3>
            </div>
          </div>
          <StatusBadge ok={true} label={status} />
        </div>

        {/* Details grid */}
        <div
          className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5"
          style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}
        >
          {details.map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.52rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                {label}
              </div>
              <div
                className="font-light"
                style={{
                  color: value === "Platzhalter" || value === "Demo-Platzhalter"
                    ? "var(--muted)"
                    : "var(--foreground)",
                  fontSize: "0.78rem",
                  fontStyle: value === "Platzhalter" || value === "Demo-Platzhalter" ? "italic" : "normal",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "8px 18px",
            fontSize: "0.62rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {cta}
          <ArrowRight size={10} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VaultPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── 1. Editorial Header ── */}
      <div
        className="px-7 md:px-10 py-8 md:py-10"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-7">
          <Link
            href="/"
            style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.06em" }}
          >
            Costa Rica 2026
          </Link>
          <ChevronRight size={10} strokeWidth={1.5} style={{ color: "var(--muted)" }} />
          <span
            style={{ color: "var(--foreground)", fontSize: "0.65rem", letterSpacing: "0.06em" }}
          >
            Travel Vault
          </span>
        </div>

        <EyebrowLabel>Alles, was eure Reise braucht</EyebrowLabel>
        <h1
          className="font-light leading-tight mb-2"
          style={{
            color: "var(--foreground)",
            fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            letterSpacing: "-0.01em",
          }}
        >
          Bereit zum Losfahren.
        </h1>
        <p
          className="mb-5 max-w-lg"
          style={{ color: "var(--muted)", fontSize: "0.82rem", fontWeight: 300, lineHeight: 1.6 }}
        >
          Buchungen, Dokumente und die kleinen Dinge, an die sonst jemand denken muss.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.08em" }}>
          23. Juli – 6. August 2026 · 5 Reisende
        </p>
      </div>

      {/* ── Content ── */}
      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-8 pb-20">

          {/* ── 2. Reisebereitschaft ── */}
          <section className="mt-10 mb-12">
            <p
              className="font-light mb-6"
              style={{
                color: "var(--foreground)",
                fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
                lineHeight: 1.6,
              }}
            >
              Die großen Dinge stehen. Drei kleine Punkte brauchen noch eure Aufmerksamkeit.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {READY_STATUS.map(({ label, status, ok }) => (
                <div
                  key={label}
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--surface)",
                    border: ok ? "1px solid rgba(184,154,94,0.2)" : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    className="flex items-center gap-1.5"
                    style={{
                      color: ok ? "var(--accent)" : "var(--foreground)",
                      fontSize: "0.8rem",
                      fontWeight: ok ? 400 : 300,
                    }}
                  >
                    {ok && <Check size={10} strokeWidth={2} />}
                    {status}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 3. Das Wichtigste auf einen Blick ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-7"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <SectionLabel>Wenn ihr morgen losfliegen würdet</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 mb-5">
                {KEY_FACTS.map(({ label, value }) => (
                  <div key={label}>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.52rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: "3px",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      className="font-light"
                      style={{ color: "var(--foreground)", fontSize: "0.85rem" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.72rem",
                  fontStyle: "italic",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "14px",
                }}
              >
                Alles Wesentliche ist an einem Ort.
              </p>
            </div>
          </section>

          {/* ── 4. Buchungen ── */}
          <section className="mb-12">
            <SectionLabel>Gebucht</SectionLabel>
            <div className="space-y-4">
              {BOOKINGS.map((b) => (
                <BookingCard key={b.type} b={b} />
              ))}
            </div>
          </section>

          {/* ── 5. Dokumente ── */}
          <section className="mb-12">
            <SectionLabel>Dokumente</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* General */}
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.55rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    marginBottom: "14px",
                  }}
                >
                  Für die ganze Reise
                </div>
                <div className="space-y-2.5">
                  {GENERAL_DOCS.map((doc) => (
                    <div
                      key={doc}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText
                          size={11}
                          strokeWidth={1.4}
                          style={{ color: "var(--muted)", flexShrink: 0 }}
                        />
                        <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>
                          {doc}
                        </span>
                      </div>
                      <Check size={10} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal */}
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.55rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    marginBottom: "14px",
                  }}
                >
                  Persönlich
                </div>
                <div className="space-y-2.5 mb-4">
                  {MEMBERS.map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div style={{ color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 400, marginBottom: "1px" }}>
                          {name}
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: "0.62rem" }}>
                          Reisepass · hinterlegt
                        </div>
                      </div>
                      <Check size={10} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.6rem",
                    fontStyle: "italic",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Gültigkeit später automatisch prüfen
                </p>
              </div>
            </div>
          </section>

          {/* ── 6. Offene Punkte ── */}
          <section className="mb-12">
            <SectionLabel>Noch zu erledigen</SectionLabel>
            <div className="space-y-3">
              {OPEN_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          style={{
                            fontSize: "0.52rem",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                            border: "1px solid rgba(184,154,94,0.3)",
                            padding: "2px 7px",
                            borderRadius: "10px",
                          }}
                        >
                          {item.context}
                        </span>
                      </div>
                      <h3
                        className="font-medium mb-1.5"
                        style={{ color: "var(--foreground)", fontSize: "0.88rem" }}
                      >
                        {item.title}
                      </h3>
                      <p
                        style={{
                          color: "var(--muted)",
                          fontSize: "0.72rem",
                          fontStyle: "italic",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.hint}
                      </p>
                    </div>
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "7px 14px",
                        fontSize: "0.58rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--foreground)",
                        cursor: "pointer",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Erledigen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 7. Packlisten ── */}
          <section className="mb-12">
            <SectionLabel>Was kommt mit?</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {PACKLISTEN.map(({ person, status, special }) => (
                <div
                  key={person}
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--surface)",
                    border: special
                      ? "1px solid rgba(184,154,94,0.3)"
                      : "1px solid var(--border)",
                  }}
                >
                  <div
                    className="font-medium mb-1.5"
                    style={{ color: "var(--foreground)", fontSize: "0.82rem" }}
                  >
                    {person}
                  </div>
                  <div
                    style={{
                      color: status === "Fast fertig" ? "var(--accent)" : "var(--muted)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {status}
                  </div>
                </div>
              ))}
            </div>

            {/* Lumi special note */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(184,154,94,0.05)",
                border: "1px solid rgba(184,154,94,0.2)",
              }}
            >
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.52rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Lumi · 2 Jahre
              </div>
              <p
                className="mb-4"
                style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.6 }}
              >
                Bei Lumi denken wir zusätzlich an Dinge, die unterwegs schwer spontan zu ersetzen sind.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {LUMI_CATEGORIES.map((cat) => (
                  <span
                    key={cat}
                    style={{
                      fontSize: "0.6rem",
                      letterSpacing: "0.08em",
                      color: "var(--muted)",
                      border: "1px solid var(--border)",
                      padding: "3px 10px",
                      borderRadius: "12px",
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
              <button
                style={{
                  background: "transparent",
                  border: "1px solid rgba(184,154,94,0.3)",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "0.58rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  cursor: "pointer",
                }}
              >
                Packlisten öffnen
              </button>
            </div>
          </section>

          {/* ── 8. Griffbereit / Offline ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-3 mb-5">
                <WifiOff
                  size={13}
                  strokeWidth={1.4}
                  style={{ color: "var(--muted)", marginTop: "2px", flexShrink: 0 }}
                />
                <SectionLabel>Unterwegs griffbereit</SectionLabel>
              </div>
              <div className="space-y-2 mb-5">
                {OFFLINE_ITEMS.map((item, idx) => (
                  <div
                    key={item}
                    className="flex items-center justify-between py-2.5"
                    style={{
                      borderBottom: idx < OFFLINE_ITEMS.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span style={{ color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 300 }}>
                      {item}
                    </span>
                    <span
                      style={{
                        fontSize: "0.52rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                        border: "1px solid var(--border)",
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      Geplant
                    </span>
                  </div>
                ))}
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.68rem",
                  fontStyle: "italic",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "14px",
                }}
              >
                Diese Informationen sollen später auch ohne Internet verfügbar sein.
              </p>
            </div>
          </section>

          {/* ── 9. Familien-Check ── */}
          <section className="mb-12">
            <SectionLabel>Für alle gedacht?</SectionLabel>
            <div className="space-y-3 mb-5">
              {FAMILY_CHECKS.map(({ who, text, special }) => (
                <div
                  key={who}
                  className="flex items-start gap-4 p-5 rounded-xl"
                  style={{
                    background: "var(--surface)",
                    border: special ? "1px solid rgba(184,154,94,0.2)" : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: "2px",
                      minHeight: "36px",
                      borderRadius: "2px",
                      background: special ? "var(--accent)" : "var(--surface-2)",
                      flexShrink: 0,
                      alignSelf: "stretch",
                    }}
                  />
                  <div>
                    <div
                      className="font-medium mb-1"
                      style={{ color: "var(--foreground)", fontSize: "0.82rem" }}
                    >
                      {who}
                    </div>
                    <p
                      style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.5 }}
                    >
                      {text}
                    </p>
                  </div>
                  <Check
                    size={12}
                    strokeWidth={1.8}
                    style={{ color: "var(--accent)", flexShrink: 0, marginLeft: "auto", marginTop: "2px" }}
                  />
                </div>
              ))}
            </div>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.8rem",
                fontStyle: "italic",
                textAlign: "center",
                paddingTop: "4px",
              }}
            >
              „Eine Reise ist erst vorbereitet, wenn sie für alle vorbereitet ist."
            </p>
          </section>

          {/* ── 10. Notfall ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <Shield
                  size={12}
                  strokeWidth={1.4}
                  style={{ color: "var(--muted)", flexShrink: 0 }}
                />
                <SectionLabel>Falls etwas passiert</SectionLabel>
              </div>
              <div className="space-y-0">
                {EMERGENCY_ITEMS.map(({ label, value }, idx) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-3"
                    style={{
                      borderBottom: idx < EMERGENCY_ITEMS.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span
                      style={{ color: "var(--muted)", fontSize: "0.72rem" }}
                    >
                      {label}
                    </span>
                    <span
                      className="font-light text-right"
                      style={{ color: "var(--foreground)", fontSize: "0.72rem", maxWidth: "55%" }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 11. Vault proaktiv ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <EyebrowLabel>Wir sagen euch, was noch fehlt.</EyebrowLabel>
              <p
                className="font-light mb-6"
                style={{ color: "var(--foreground)", fontSize: "0.9rem", lineHeight: 1.7 }}
              >
                Später prüft Family Travel OS eure Reise automatisch und erinnert nicht an alles –
                sondern nur an das, was wirklich relevant ist.
              </p>
              <div
                className="space-y-2.5"
                style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}
              >
                {PROACTIVE_EXAMPLES.map((ex) => (
                  <div
                    key={ex}
                    className="flex items-start gap-3 p-3 rounded-lg"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
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
                    <span
                      style={{ color: "var(--muted)", fontSize: "0.75rem", fontStyle: "italic" }}
                    >
                      {ex}
                    </span>
                  </div>
                ))}
              </div>
              <p
                className="mt-4"
                style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.08em" }}
              >
                Nur Demo-Beispiele · Keine echten Warnungen
              </p>
            </div>
          </section>

          {/* ── 12. Zeitliche Logik ── */}
          <section className="mb-12">
            <SectionLabel>Was wann wichtig wird</SectionLabel>
            <div className="space-y-px overflow-hidden rounded-xl">
              {TIME_PHASES.map(({ when, what }, idx) => (
                <div
                  key={when}
                  className="flex items-center gap-6 px-6 py-4"
                  style={{
                    background: "var(--surface)",
                    borderBottom: idx < TIME_PHASES.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      width: "130px",
                      color: "var(--muted)",
                      fontSize: "0.62rem",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {when}
                  </div>
                  <div
                    style={{
                      width: "1px",
                      height: "16px",
                      background: "var(--border)",
                      flexShrink: 0,
                    }}
                  />
                  <div
                    className="font-light"
                    style={{ color: "var(--foreground)", fontSize: "0.82rem" }}
                  >
                    {what}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 13. Abschluss ── */}
          <section>
            <div
              className="rounded-2xl p-8 md:p-10"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2
                className="font-light leading-tight mb-3"
                style={{
                  color: "var(--foreground)",
                  fontSize: "clamp(1.2rem, 3vw, 1.7rem)",
                  letterSpacing: "0.01em",
                }}
              >
                Gut vorbereitet fühlt sich nicht nach Organisation an.
              </h2>
              <p
                className="leading-relaxed mb-8 max-w-md"
                style={{ color: "var(--muted)", fontSize: "0.85rem" }}
              >
                Sondern danach, dass ihr einfach losfahren könnt.
              </p>
              <Link
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--foreground)",
                  color: "var(--surface)",
                  borderRadius: "6px",
                  padding: "12px 26px",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Zur Reise
                <ArrowRight size={11} strokeWidth={1.5} />
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
