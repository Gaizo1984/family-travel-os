import Link from "next/link";
import { ChevronRight, ArrowRight, Info, TrendingDown, Clock } from "lucide-react";

// ── Demo data ─────────────────────────────────────────────────────────────────
// ALLE ZAHLEN SIND DEMO-DATEN — keine echten Preise, keine echte Kalkulation

const DEMO_LABEL = "Demo-Daten · keine echten Preise";

const STATIONS = [
  { name: "Muscat",       nights: 4, hotel: "The Chedi Muscat",    status: "gebucht",    demoNight: 620,  demoTotal: 2480 },
  { name: "Wüste",        nights: 2, hotel: "Boutique Wüstencamp", status: "offen",       demoNight: 650,  demoTotal: 1300 },
  { name: "Jabal Akhdar", nights: 3, hotel: "Bergresort",          status: "offen",       demoNight: 490,  demoTotal: 1470 },
  { name: "Meer",         nights: 5, hotel: "Strandresort",        status: "offen",       demoNight: 520,  demoTotal: 2600 },
];

const DEMO_FLIGHTS  = 4850;
const DEMO_HOTELS   = STATIONS.reduce((s, st) => s + st.demoTotal, 0); // 7850
const DEMO_LOCAL    = 3900;
const DEMO_TOTAL    = DEMO_FLIGHTS + DEMO_HOTELS + DEMO_LOCAL; // 16600

const LOCAL_ITEMS = [
  { label: "Essen & Restaurants",       demo: 2100, note: "ca. 150 € / Tag · Demo" },
  { label: "Aktivitäten & Ausflüge",    demo:  820, note: "Demo-Schätzung" },
  { label: "Transfers & Mietwagen",     demo:  620, note: "Demo-Schätzung" },
  { label: "Diverses & Unvorhergesehenes", demo: 360, note: "Demo-Puffer" },
];

const MEMBERS = ["Sarah", "Marcel", "Lia", "Elias", "Lumi"];

const PER_PERSON = Math.round(DEMO_TOTAL / 5);
const PER_DAY    = Math.round(DEMO_TOTAL / 14);
const PER_NIGHT  = Math.round(DEMO_HOTELS / 14);

const PAYMENT_PHASES = [
  {
    when:    "Bei Buchung",
    what:    "Flug",
    amount:  "4.850 €",
    note:    "In der Regel sofort fällig",
  },
  {
    when:    "6 Wochen vor Reise",
    what:    "Hotel-Anzahlungen",
    amount:  "~30–50 %",
    note:    "Je nach Hotel und Buchungsbedingungen",
  },
  {
    when:    "Bei Anreise",
    what:    "Hotel-Restzahlungen",
    amount:  "variiert",
    note:    "Oft bei Check-in fällig",
  },
  {
    when:    "Vor Ort",
    what:    "Tageskosten",
    amount:  "laufend",
    note:    "Essen, Aktivitäten, Transfers",
  },
];

const OPEN_COST_ITEMS = [
  { item: "Hotels Wüste · Jabal Akhdar · Meer", why: "Preise stehen nach Buchung fest" },
  { item: "Aktivitäten und Ausflüge",            why: "Abhängig von Tagesplänen" },
  { item: "Transfers zwischen Etappen",          why: "Fahrzeug oder geführter Transfer offen" },
  { item: "Restaurantreservierungen",            why: "Werden später konkret" },
];

const SAVE_OPTIONS = [
  {
    option:  "Umstieg statt Direktflug",
    saving:  "ca. 1.200 €",
    tradeoff: "Längere Reisezeit · Umstieg in Doha für drei Kinder",
  },
  {
    option:  "Alternative zu The Chedi in Muscat",
    saving:  "ca. 800 – 1.200 €",
    tradeoff: "Weniger ikonisches Ankommen · andere Poolatmosphäre",
  },
  {
    option:  "12 statt 14 Nächte",
    saving:  "ca. 2 Hotelnächte",
    tradeoff: "Kürzere Etappe Meer · weniger Ankommen im letzten Teil",
  },
  {
    option:  "Meer-Etappe auf 3 statt 5 Nächte",
    saving:  "ca. 1.000 €",
    tradeoff: "Weniger Zeit zum Ankommen am Ende der Reise",
  },
];

const PROACTIVE_NOTES = [
  "Der Direktflug kostet 1.200 € mehr als der günstigste Umstieg – das ist bei dieser Familiensituation unserer Meinung nach gut begründet.",
  "The Chedi Muscat ist die teuerste Hotelnacht eurer Reise – und sie setzt den Ton für alles Weitere.",
  "Die Vor-Ort-Kosten sind Demo-Schätzungen. Bei einer Luxusreise mit drei Kindern kann dieser Anteil deutlich variieren.",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE") + " €";
}

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

function DemoTag() {
  return (
    <span
      style={{
        fontSize: "0.5rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--muted)",
        border: "1px solid var(--border)",
        padding: "2px 8px",
        borderRadius: "20px",
        whiteSpace: "nowrap",
      }}
    >
      Demo
    </span>
  );
}

function BigNumber({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
          fontWeight: 200,
          letterSpacing: "-0.02em",
          color: accent ? "var(--accent)" : "var(--foreground)",
          lineHeight: 1.1,
          marginBottom: "4px",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "var(--muted)",
          fontSize: "0.6rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── 1. Header ── */}
      <div
        className="px-7 md:px-10 py-8 md:py-10"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-7 flex-wrap">
          {["Neue Reise", "Oman", "Oman in Balance"].map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={10} strokeWidth={1.5} style={{ color: "var(--muted)" }} />}
              <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>{crumb}</span>
            </span>
          ))}
          <ChevronRight size={10} strokeWidth={1.5} style={{ color: "var(--muted)" }} />
          <span style={{ color: "var(--foreground)", fontSize: "0.65rem" }}>Budget</span>
        </div>

        <EyebrowLabel>Was kostet diese Reise wirklich?</EyebrowLabel>
        <h1
          className="font-light leading-tight mb-2"
          style={{
            color: "var(--foreground)",
            fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            letterSpacing: "-0.01em",
          }}
        >
          Oman in Balance · Kostenbild.
        </h1>
        <p
          className="mb-5 max-w-lg"
          style={{ color: "var(--muted)", fontSize: "0.82rem", fontWeight: 300, lineHeight: 1.6 }}
        >
          Kein Angebotsvergleich. Kein Sparrechner. Ein ehrliches Bild davon, was diese
          Reise für euch kosten wird – und was ihr dafür bekommt.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
          Oktober 2028 · 14 Nächte · 5 Reisende · {DEMO_LABEL}
        </p>
      </div>

      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-8 pb-20">

          {/* ── 2. Gesamtbild ── */}
          <section className="mt-10 mb-12">
            <div
              className="rounded-2xl p-7 md:p-9"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <EyebrowLabel>Gesamtbild der Reise</EyebrowLabel>
                <DemoTag />
              </div>

              {/* Big total */}
              <div className="mb-7">
                <div
                  style={{
                    fontSize: "clamp(2.2rem, 6vw, 3.4rem)",
                    fontWeight: 200,
                    letterSpacing: "-0.03em",
                    color: "var(--foreground)",
                    lineHeight: 1,
                    marginBottom: "6px",
                  }}
                >
                  {fmt(DEMO_TOTAL)}
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                  Gesamtkosten Demo · 5 Personen · 14 Nächte
                </p>
              </div>

              {/* Three pillars */}
              <div
                className="grid grid-cols-3 gap-px overflow-hidden rounded-xl"
                style={{ background: "var(--border)" }}
              >
                {[
                  { label: "Flüge",          value: fmt(DEMO_FLIGHTS), sub: "Direktflug · 5 Personen" },
                  { label: "Hotels",         value: fmt(DEMO_HOTELS),  sub: "14 Nächte · 4 Etappen" },
                  { label: "Vor Ort",        value: fmt(DEMO_LOCAL),   sub: "Essen · Ausflüge · Transfer" },
                ].map(({ label, value, sub }) => (
                  <div
                    key={label}
                    className="p-4 md:p-5"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.52rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: "8px",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      className="font-light mb-1"
                      style={{
                        color: "var(--foreground)",
                        fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {value}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.58rem" }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 3. Kennzahlen ── */}
          <section className="mb-12">
            <SectionLabel>Pro Person · Pro Tag · Pro Nacht</SectionLabel>
            <div className="grid grid-cols-3 gap-4">
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <BigNumber value={fmt(PER_PERSON)} label="Pro Person · Demo" />
              </div>
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <BigNumber value={fmt(PER_DAY)} label="Pro Tag · Demo" />
              </div>
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <BigNumber value={fmt(PER_NIGHT)} label="Ø Hotelkosten / Nacht · Demo" />
              </div>
            </div>
          </section>

          {/* ── 4. Flug Detail ── */}
          <section className="mb-12">
            <SectionLabel>Flüge</SectionLabel>
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                style={{
                  height: "2px",
                  background: "linear-gradient(to right, var(--accent), transparent)",
                  marginBottom: "20px",
                  borderRadius: "2px",
                }}
              />
              <div className="flex items-start justify-between gap-6 mb-5">
                <div>
                  <div
                    className="font-medium mb-1"
                    style={{ color: "var(--foreground)", fontSize: "0.95rem" }}
                  >
                    Direktflug Frankfurt → Muscat
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                    Hin- und Rückflug · 5 Personen · ca. 7 Stunden
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className="font-light mb-1"
                    style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "-0.01em" }}
                  >
                    {fmt(DEMO_FLIGHTS)}
                  </div>
                  <DemoTag />
                </div>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-2">
                  <Info size={11} strokeWidth={1.4} style={{ color: "var(--muted)", flexShrink: 0, marginTop: "3px" }} />
                  <p style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.55 }}>
                    Der günstigere Umstiegsflug liegt Demo bei ca. 3.650 € – das sind 1.200 € weniger.
                    Bei dieser Familiensituation haben wir den Direktflug empfohlen.
                    Die Entscheidung ist offen.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 5. Hotels Station für Station ── */}
          <section className="mb-12">
            <SectionLabel>Hotels · Station für Station</SectionLabel>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {STATIONS.map((st, idx) => (
                <div
                  key={st.name}
                  className="flex items-center gap-5 px-6 py-5"
                  style={{
                    background: "var(--surface)",
                    borderBottom: idx < STATIONS.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {/* Station */}
                  <div style={{ width: "100px", flexShrink: 0 }}>
                    <div
                      className="font-medium mb-0.5"
                      style={{ color: "var(--foreground)", fontSize: "0.82rem" }}
                    >
                      {st.name}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.6rem" }}>
                      {st.nights} {st.nights === 1 ? "Nacht" : "Nächte"}
                    </div>
                  </div>

                  {/* Hotel name */}
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        color: st.status === "gebucht" ? "var(--foreground)" : "var(--muted)",
                        fontSize: "0.78rem",
                        fontStyle: st.status === "offen" ? "italic" : "normal",
                        fontWeight: 300,
                      }}
                    >
                      {st.hotel}
                    </div>
                    <span
                      style={{
                        fontSize: "0.5rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: st.status === "gebucht" ? "var(--accent)" : "var(--muted)",
                        marginTop: "2px",
                        display: "block",
                      }}
                    >
                      {st.status === "gebucht" ? "Gebucht" : "Noch offen · Demo-Schätzung"}
                    </span>
                  </div>

                  {/* Per night */}
                  <div
                    className="text-right"
                    style={{ flexShrink: 0 }}
                  >
                    <div style={{ color: "var(--muted)", fontSize: "0.58rem", marginBottom: "2px" }}>
                      {fmt(st.demoNight)} / Nacht
                    </div>
                    <div
                      className="font-light"
                      style={{ color: "var(--foreground)", fontSize: "0.88rem" }}
                    >
                      {fmt(st.demoTotal)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Total row */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{
                  background: "var(--surface-2)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Gesamt Hotels · Demo
                </span>
                <span
                  className="font-light"
                  style={{ color: "var(--foreground)", fontSize: "1rem" }}
                >
                  {fmt(DEMO_HOTELS)}
                </span>
              </div>
            </div>
          </section>

          {/* ── 6. Vor-Ort-Kosten ── */}
          <section className="mb-12">
            <SectionLabel>Vor-Ort-Kosten · Demo-Schätzung</SectionLabel>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {LOCAL_ITEMS.map(({ label, demo, note }, idx) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                  style={{
                    background: "var(--surface)",
                    borderBottom: idx < LOCAL_ITEMS.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div>
                    <div style={{ color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 300 }}>
                      {label}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.6rem", fontStyle: "italic" }}>
                      {note}
                    </div>
                  </div>
                  <div
                    className="font-light"
                    style={{ color: "var(--foreground)", fontSize: "0.88rem", flexShrink: 0 }}
                  >
                    {fmt(demo)}
                  </div>
                </div>
              ))}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}
              >
                <span
                  style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase" }}
                >
                  Gesamt Vor Ort · Demo
                </span>
                <span className="font-light" style={{ color: "var(--foreground)", fontSize: "1rem" }}>
                  {fmt(DEMO_LOCAL)}
                </span>
              </div>
            </div>
          </section>

          {/* ── 7. Pro-Person-Ansicht ── */}
          <section className="mb-12">
            <SectionLabel>Pro Person · Demo</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {MEMBERS.map((name) => (
                <div
                  key={name}
                  className="rounded-xl p-4 text-center"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="font-medium mb-1.5"
                    style={{ color: "var(--foreground)", fontSize: "0.78rem" }}
                  >
                    {name}
                  </div>
                  <div
                    className="font-light"
                    style={{ color: "var(--accent)", fontSize: "0.88rem" }}
                  >
                    {name === "Lumi" ? "~" : ""}{fmt(PER_PERSON)}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.52rem", marginTop: "2px" }}>
                    {name === "Lumi" ? "Kinder oft günstiger" : "Demo-Anteil"}
                  </div>
                </div>
              ))}
            </div>
            <p
              className="mt-3"
              style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}
            >
              Hinweis: Kinder zahlen bei Flug und Hotel oft reduzierten Preis. Diese Demo rechnet gleichmäßig.
            </p>
          </section>

          {/* ── 8. Was ist noch offen? ── */}
          <section className="mb-12">
            <SectionLabel>Was ist kostenseitig noch offen?</SectionLabel>
            <div className="space-y-2">
              {OPEN_COST_ITEMS.map(({ item, why }) => (
                <div
                  key={item}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: "var(--muted)",
                      flexShrink: 0,
                      marginTop: "7px",
                    }}
                  />
                  <div>
                    <div style={{ color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 300, marginBottom: "2px" }}>
                      {item}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.65rem", fontStyle: "italic" }}>
                      {why}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 9. Wann zahlt ihr was? ── */}
          <section className="mb-12">
            <SectionLabel>Wann zahlt ihr was?</SectionLabel>
            <div className="relative">
              {/* Vertical line */}
              <div
                className="absolute hidden sm:block"
                style={{
                  left: "110px",
                  top: 0,
                  bottom: 0,
                  width: "1px",
                  background: "var(--border)",
                }}
              />
              <div className="space-y-3">
                {PAYMENT_PHASES.map(({ when, what, amount, note }, idx) => (
                  <div key={idx} className="flex gap-0 items-start">
                    {/* When */}
                    <div
                      className="hidden sm:block shrink-0 text-right pr-4"
                      style={{ width: "110px", paddingTop: "14px" }}
                    >
                      <span style={{ color: "var(--muted)", fontSize: "0.6rem", lineHeight: 1.3 }}>
                        {when}
                      </span>
                    </div>
                    {/* Dot */}
                    <div className="hidden sm:block shrink-0 relative z-10" style={{ paddingTop: "16px", marginRight: "14px" }}>
                      <div
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: "var(--surface)",
                          border: "1.5px solid var(--border)",
                        }}
                      />
                    </div>
                    {/* Content */}
                    <div
                      className="flex-1 rounded-xl p-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="sm:hidden mb-1" style={{ color: "var(--muted)", fontSize: "0.6rem" }}>{when}</div>
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <div className="font-medium" style={{ color: "var(--foreground)", fontSize: "0.82rem", marginBottom: "2px" }}>
                            {what}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: "0.65rem", fontStyle: "italic" }}>
                            {note}
                          </div>
                        </div>
                        <div
                          className="font-light shrink-0"
                          style={{ color: "var(--foreground)", fontSize: "0.9rem" }}
                        >
                          {amount}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 10. Was bekommt ihr dafür? ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <SectionLabel>Was bekommt ihr dafür?</SectionLabel>
              <div className="space-y-4 mb-6">
                {[
                  { text: "14 Tage, die Lia und Elias mit 20 noch erzählen werden.", em: true },
                  { text: `14 Nächte auf höchstem Niveau – Oman in der besten Jahreszeit für Familien mit kleinen Kindern.` },
                  { text: "Eine Route, die atmet: Wüste, Berge, Meer – ohne einen einzigen Tag zu viel." },
                  { text: "Lumi in einem Rhythmus, der für alle funktioniert." },
                ].map(({ text, em }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      style={{
                        width: "2px",
                        minHeight: "16px",
                        background: "var(--accent)",
                        borderRadius: "2px",
                        flexShrink: 0,
                        marginTop: "4px",
                      }}
                    />
                    <p
                      style={{
                        color: em ? "var(--foreground)" : "var(--muted)",
                        fontSize: em ? "0.88rem" : "0.78rem",
                        fontStyle: em ? "italic" : "normal",
                        lineHeight: 1.6,
                      }}
                    >
                      {text}
                    </p>
                  </div>
                ))}
              </div>
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>
                      Pro Reisetag · Demo
                    </div>
                    <div className="font-light" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>
                      {fmt(PER_DAY)}
                    </div>
                  </div>
                  <div
                    style={{ width: "1px", height: "36px", background: "var(--border)", flexShrink: 0, margin: "0 8px" }}
                  />
                  <p style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic", lineHeight: 1.5 }}>
                    Für fünf Menschen, die gemeinsam etwas sehen – und es nicht vergessen werden.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 11. Wo lässt sich anpassen? ── */}
          <section className="mb-12">
            <SectionLabel>Wo lässt sich anpassen?</SectionLabel>
            <div className="space-y-3">
              {SAVE_OPTIONS.map(({ option, saving, tradeoff }) => (
                <div
                  key={option}
                  className="rounded-xl p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown
                        size={11}
                        strokeWidth={1.4}
                        style={{ color: "var(--muted)", flexShrink: 0 }}
                      />
                      <span className="font-medium" style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
                        {option}
                      </span>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        color: "var(--accent)",
                        fontSize: "0.78rem",
                        fontWeight: 300,
                      }}
                    >
                      {saving}
                    </span>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic", lineHeight: 1.5 }}>
                    {tradeoff}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 12. Preistransparenz ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <SectionLabel>Was wir euch sagen wollen</SectionLabel>
              <div className="space-y-4">
                {PROACTIVE_NOTES.map((note, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Info
                      size={11}
                      strokeWidth={1.4}
                      style={{ color: "var(--muted)", flexShrink: 0, marginTop: "3px" }}
                    />
                    <p style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.6 }}>
                      {note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 13. Zeitliche Logik / Wann muss man sich entscheiden? ── */}
          <section className="mb-12">
            <SectionLabel>Wann sind welche Kosten relevant?</SectionLabel>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {[
                { when: "Jetzt",              what: "Flug buchen – sichert den Preis und die Verbindung", icon: Clock },
                { when: "In 2–3 Monaten",     what: "Hotels Wüste, Jabal Akhdar und Meer festlegen", icon: Clock },
                { when: "4 Wochen vorher",    what: "Aktivitäten und Restaurantreservierungen", icon: Clock },
                { when: "Vor Ort",            what: "Tageskosten laufen – kein Planungsstress mehr", icon: Clock },
              ].map(({ when, what }, idx) => (
                <div
                  key={when}
                  className="flex items-center gap-5 px-6 py-4"
                  style={{
                    background: "var(--surface)",
                    borderBottom: idx < 3 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ width: "120px", flexShrink: 0, color: "var(--muted)", fontSize: "0.62rem" }}>
                    {when}
                  </div>
                  <div style={{ width: "1px", height: "16px", background: "var(--border)", flexShrink: 0 }} />
                  <div className="font-light" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
                    {what}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 14. Editorial: Eine Reise ist keine Excel-Tabelle ── */}
          <section className="mb-12">
            <div
              className="rounded-2xl p-8 md:p-10"
              style={{
                background: "linear-gradient(135deg, rgba(184,154,94,0.07) 0%, var(--surface) 60%)",
                border: "1px solid rgba(184,154,94,0.2)",
              }}
            >
              <EyebrowLabel>Eine Reise ist keine Excel-Tabelle.</EyebrowLabel>
              <h2
                className="font-light leading-tight mb-5"
                style={{
                  color: "var(--foreground)",
                  fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
                  letterSpacing: "0.01em",
                }}
              >
                Ihr könnt eine Reise nicht optimieren wie ein Budget.
              </h2>
              <div className="space-y-4 mb-6 max-w-lg">
                <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.75 }}>
                  Was kostet es, wenn Lia und Elias diese zwei Wochen nicht haben?
                  Was kostet es, wenn Lumi auf halbem Weg zusammenbricht, weil die Route zu viel war?
                  Was kostet die Erinnerung an den Sonnenuntergang in der Wüste, wenn sie mit 30 Jahren noch da ist?
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.75, fontStyle: "italic" }}>
                  Kein Tabellenkalkulationsprogramm kann diese Fragen beantworten.
                  Family Travel OS versucht es auch nicht.
                </p>
              </div>
              <div
                style={{
                  height: "1px",
                  background: "rgba(184,154,94,0.2)",
                  marginBottom: "20px",
                }}
              />
              <p style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.6 }}>
                Was ihr hier seht, sind Demo-Zahlen für eine Reise, die es so noch nicht gibt.
                Später werden echte Buchungen, echte Preise und echte Entscheidungen an ihre Stelle treten.
                Dieses Kostenbild soll zeigen, wie Family Travel OS damit umgeht: ehrlich, vollständig, ohne zu erschrecken.
              </p>
            </div>
          </section>

          {/* ── 15. Abschluss ── */}
          <section>
            <div
              className="rounded-2xl p-8 md:p-10"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2
                className="font-light leading-tight mb-2"
                style={{
                  color: "var(--foreground)",
                  fontSize: "clamp(1.2rem, 3vw, 1.7rem)",
                  letterSpacing: "0.01em",
                }}
              >
                Das Ziel ist nicht die günstigste Reise.
              </h2>
              <p
                className="mb-8"
                style={{
                  color: "var(--muted)",
                  fontSize: "clamp(0.88rem, 2vw, 1.05rem)",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}
              >
                Sondern die beste Reise für das Geld, das ihr dafür ausgeben wollt.
              </p>
              <Link
                href="/plan/oman/flights"
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
                Zur Reise zurück
                <ArrowRight size={11} strokeWidth={1.5} />
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
