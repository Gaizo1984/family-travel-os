import Link from "next/link";
import { Sun, Car, Clock, CloudRain, ArrowRight, MapPin, Compass } from "lucide-react";

// ── Verified Unsplash photos ──────────────────────────────────────────────────

const P = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const PHOTOS = {
  hero:     P("photo-1581129724980-2ab2153c3d8d", 1920), // palm tree, white sand beach, Costa Rica
  nature:   P("photo-1611222566512-cb8dd8e689e5"),        // green trees beside river, Costa Rica
  beach:    P("photo-1755259053539-16f470011a0d"),        // turquoise waves, sandy beach
  wildlife: P("photo-1580676916365-70b94de0aa79"),        // monkey in tree, Costa Rica
};

// ── Constants ─────────────────────────────────────────────────────────────────

const H_FG   = "#F0EBE3";
const H_MUTED = "#A89880";

// ── Data ─────────────────────────────────────────────────────────────────────

const DAY_VARIANTS = [
  {
    id: "natur",
    badge: "PASST BESONDERS GUT ZU EUCH",
    title: "Natur & Weite",
    character: "Der Tag, für den ihr das Auto genommen habt.",
    hint: "Genug zu sehen für Lia und Elias. Genug Pausen für Lumi. Und kein Tag, der sich nach Kilometer-Sammeln anfühlt.",
    photo: PHOTOS.nature,
    recommended: true,
  },
  {
    id: "meer",
    badge: null,
    title: "Meer & Genuss",
    character: "Weniger fahren. Mehr bleiben.",
    hint: "Die ruhigste Variante – perfekt, wenn ihr morgens merkt, dass niemand Lust auf einen langen Tag hat.",
    photo: PHOTOS.beach,
    recommended: false,
  },
  {
    id: "entdecken",
    badge: null,
    title: "Mehr entdecken",
    character: "Heute sehen wir etwas.",
    hint: "Für Lia und Elias die spannendste Variante. Mit Lumi machbar, aber der intensivste Tag.",
    photo: PHOTOS.wildlife,
    recommended: false,
  },
];

const TIMELINE = [
  {
    time: "08:30",
    title: "Ganz entspannt los",
    desc: "Abfahrt nach dem Frühstück.",
    meta: "Westin Reserva Conchal",
    hint: "Kein Wecker-Urlaub. Ihr habt genug Zeit.",
    size: "compact" as const,
  },
  {
    time: "09:30",
    title: "Der erste besondere Blick",
    desc: "Kurzer Natur- und Aussichtsstopp.",
    meta: "ca. 45 Minuten",
    hint: "Genug Bewegung nach der Fahrt – ohne direkt das große Programm zu starten.",
    size: "compact" as const,
  },
  {
    time: "11:00",
    title: "Etwas, das die Kinder nicht jeden Tag sehen",
    desc: "Natur- oder Tiererlebnis.",
    meta: "ca. 1,5 Stunden",
    hint: "Der aktivste Teil des Tages liegt bewusst vor dem Mittag.",
    size: "large" as const,
  },
  {
    time: "12:45",
    title: "Jetzt wird gegessen",
    desc: "Besonderes Restaurant oder entspannter lokaler Ort.",
    meta: "ca. 1,5 Stunden",
    hint: "Kein Essen zwischen zwei Programmpunkten. Zeit zum Sitzen.",
    size: "large" as const,
  },
  {
    time: "14:30",
    title: "Der Tag darf ruhiger werden",
    desc: "Kurzer Strandstopp, kleiner Ort, Café oder direkte Rückfahrt.",
    meta: "Flexible Phase",
    hint: "Guter Zeitpunkt für Schlaf im Auto oder eine ruhige Pause für Lumi.",
    size: "compact" as const,
    lumiNote: true,
  },
  {
    time: "16:15",
    title: "Zurück Richtung Conchal",
    desc: "Rückfahrt ohne Zeitdruck.",
    meta: null,
    hint: null,
    size: "compact" as const,
  },
  {
    time: "17:15",
    title: "Wieder da",
    desc: "Genug Zeit für Pool, Drink und Ankommen.",
    meta: "Westin Reserva Conchal",
    hint: null,
    size: "compact" as const,
  },
  {
    time: "17:58",
    title: "Sonnenuntergang",
    desc: "Der Tag endet dort, wo eure Reise gerade zu Hause ist.",
    meta: null,
    hint: null,
    size: "sunset" as const,
  },
];

const INSIGHTS = [
  {
    who: "Lumi",
    text: "Der aktivste Teil des Tages liegt vor dem Mittag. Der Nachmittag bleibt flexibel.",
  },
  {
    who: "Lia & Elias",
    text: "Es gibt ein echtes Erlebnis – aber keinen Tag voller Erwachsenen-Sehenswürdigkeiten.",
  },
  {
    who: "Sarah & Marcel",
    text: "Das Lunch ist ein eigener Teil des Tages und kein notwendiger Zwischenstopp.",
  },
  {
    who: "Für euch alle",
    text: "Ihr seid vor Sonnenuntergang zurück, ohne den ganzen Tag auf die Uhr schauen zu müssen.",
  },
];

const PRACTICAL = [
  { label: "Abfahrt",       value: "08:30 Uhr" },
  { label: "Tanken",        value: "Nicht nötig" },
  { label: "Mitnehmen",     value: "Wasser · Sonnenschutz · leichte Schuhe · Wechselkleidung für Lumi" },
  { label: "Kinderwagen",   value: "Nicht empfohlen" },
  { label: "Trage",         value: "Sinnvoll" },
  { label: "Reservierung",  value: "Lunch noch offen" },
];

const ADJUST_OPTS = [
  "Weniger fahren",
  "Mehr Natur",
  "Tiere einbauen",
  "Später starten",
  "Besser essen",
  "Mehr Abenteuer",
  "Früher zurück",
];

const NOW_OPTS = [
  "Wir haben noch drei Stunden.",
  "Die Kinder wollen raus.",
  "Wir wollen gut essen.",
  "Es regnet.",
  "Wir brauchen heute gar nichts Großes.",
];

const FAMILY_WANTS = [
  { who: "Elias",          want: "Tiere" },
  { who: "Lia",            want: "Etwas erleben" },
  { who: "Sarah",          want: "Nicht den ganzen Tag Auto" },
  { who: "Marcel",         want: "Ein Ort, den wir nicht vergessen" },
  { who: "Lumi · 2 J.",    want: "Einen Rhythmus, der funktioniert" },
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

function DayVariantCard({ v }: { v: (typeof DAY_VARIANTS)[0] }) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl"
      style={{
        height: "240px",
        border: v.recommended ? "1px solid var(--accent)" : "1px solid transparent",
        cursor: "pointer",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={v.photo}
        alt={v.title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,7,0.95) 0%, rgba(10,9,7,0.35) 55%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        {v.badge && (
          <div
            style={{
              color: "var(--accent)",
              fontSize: "0.5rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: "5px",
            }}
          >
            {v.badge}
          </div>
        )}
        <div
          className="text-lg font-light mb-1"
          style={{ color: H_FG, letterSpacing: "0.01em" }}
        >
          {v.title}
        </div>
        <div
          style={{
            color: H_MUTED,
            fontSize: "0.68rem",
            fontStyle: "italic",
            marginBottom: "8px",
          }}
        >
          „{v.character}"
        </div>
        <p
          style={{ color: H_MUTED, fontSize: "0.65rem", lineHeight: 1.5, opacity: 0.9 }}
        >
          {v.hint}
        </p>
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: (typeof TIMELINE)[0] }) {
  const isSunset = item.size === "sunset";
  const isLarge  = item.size === "large";

  return (
    <div className="relative flex items-start gap-0">
      {/* Time */}
      <div
        className="hidden sm:block shrink-0 text-right pr-5"
        style={{ width: "80px", paddingTop: isSunset ? "0" : "14px" }}
      >
        <span
          style={{
            color: isSunset ? "var(--accent)" : "var(--muted)",
            fontSize: "0.68rem",
            letterSpacing: "0.04em",
            fontWeight: isSunset ? 400 : 300,
          }}
        >
          {item.time}
        </span>
      </div>

      {/* Dot */}
      <div
        className="hidden sm:block shrink-0 relative z-10"
        style={{ paddingTop: "16px", marginRight: "16px" }}
      >
        <div
          style={{
            width: isSunset ? "10px" : "8px",
            height: isSunset ? "10px" : "8px",
            borderRadius: "50%",
            background: isSunset ? "var(--accent)" : "var(--surface)",
            border: `1.5px solid ${isSunset ? "var(--accent)" : "var(--border)"}`,
            marginTop: isSunset ? "-1px" : "0",
          }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 pb-1">
        {/* Mobile time */}
        <div
          className="sm:hidden mb-1"
          style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.08em" }}
        >
          {item.time}
        </div>

        {isSunset ? (
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(184,154,94,0.12) 0%, rgba(181,98,74,0.08) 100%)",
              border: "1px solid rgba(184,154,94,0.3)",
            }}
          >
            <div
              className="text-lg font-light mb-1"
              style={{ color: "var(--accent)", letterSpacing: "0.01em" }}
            >
              {item.title}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{item.desc}</p>
          </div>
        ) : (
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              ...(isLarge ? { paddingTop: "20px", paddingBottom: "20px" } : {}),
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <h3
                className={`font-medium leading-snug ${isLarge ? "text-base" : "text-sm"}`}
                style={{ color: "var(--foreground)" }}
              >
                {item.title}
              </h3>
              {item.meta && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "0.55rem",
                    letterSpacing: "0.1em",
                    color: "var(--muted)",
                    border: "1px solid var(--border)",
                    padding: "2px 8px",
                    borderRadius: "20px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.meta}
                </span>
              )}
            </div>
            <p
              className="leading-relaxed"
              style={{ color: "var(--muted)", fontSize: "0.75rem" }}
            >
              {item.desc}
            </p>
            {item.hint && (
              <p
                className="mt-2"
                style={{
                  color: "var(--muted)",
                  fontSize: "0.68rem",
                  fontStyle: "italic",
                  opacity: 0.8,
                  lineHeight: 1.5,
                }}
              >
                {item.hint}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── 1. Cinematic Hero ── */}
      <div className="relative" style={{ height: "420px", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PHOTOS.hero}
          alt="Costa Rica · Playa Conchal"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.6) 45%, rgba(10,9,7,0.18) 100%)",
          }}
        />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 px-7 md:px-10 pb-8 md:pb-10">
          <div
            style={{
              color: "var(--accent)",
              fontSize: "0.55rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Costa Rica · Playa Conchal
          </div>
          <h1
            className="text-4xl md:text-5xl font-light leading-tight mb-2"
            style={{ color: H_FG, letterSpacing: "-0.01em" }}
          >
            Was machen wir morgen?
          </h1>
          <p
            className="mb-6"
            style={{ color: H_MUTED, fontSize: "0.88rem", fontWeight: 300 }}
          >
            Ihr habt ein Auto. Der Tag gehört euch.
          </p>

          <div className="mb-5" style={{ height: "1px", background: "rgba(240,235,227,0.1)" }} />

          {/* Meta row */}
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { Icon: null,       text: "Dienstag, 28. Juli 2026" },
              { Icon: Sun,        text: "28 °C · Sonne und einzelne Wolken" },
              { Icon: Clock,      text: "Sonnenuntergang 17:58 Uhr" },
              { Icon: Car,        text: "Mietwagen verfügbar" },
            ].map(({ Icon, text }, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {Icon && <Icon size={10} strokeWidth={1.5} style={{ color: H_MUTED }} />}
                <span style={{ color: H_MUTED, fontSize: "0.68rem", letterSpacing: "0.04em" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Light content ── */}
      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-8 pb-20">

          {/* ── 2. Der Wunsch ── */}
          <section className="mt-10 mb-12">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <textarea
                rows={4}
                defaultValue="Wir wollen einen Tag die Umgebung erkunden. Natur sehen, irgendwo richtig gut essen und spätestens zum Sonnenuntergang zurück sein. Nicht zu viel Fahrerei."
                style={{
                  width: "100%",
                  padding: "24px 28px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                  lineHeight: 1.75,
                  fontWeight: 300,
                  letterSpacing: "0.01em",
                }}
              />
              <div
                className="flex items-center justify-between px-6 pb-5 pt-1"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.68rem",
                    fontStyle: "italic",
                  }}
                >
                  Erzählt einfach, worauf ihr Lust habt.
                </p>
                <button
                  style={{
                    background: "var(--foreground)",
                    color: "var(--surface)",
                    border: "none",
                    borderRadius: "6px",
                    padding: "10px 22px",
                    fontSize: "0.65rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Unseren Tag planen
                </button>
              </div>
            </div>
          </section>

          {/* ── 3. Was wir bereits wissen ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6"
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
                Ihr müsst uns nicht alles noch einmal erzählen.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-5">
                {[
                  { label: "Reisende",       value: "5 Personen" },
                  { label: "Lumi",           value: "2 Jahre" },
                  { label: "Mietwagen",      value: "ganztägig" },
                  { label: "Start",          value: "Westin Reserva Conchal" },
                  { label: "Zurück",         value: "vor Sonnenuntergang" },
                  { label: "Reisetempo",     value: "entspannt" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.55rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: "2px",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      className="font-light"
                      style={{ color: "var(--foreground)", fontSize: "0.8rem" }}
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
                  borderTop: "1px solid var(--border)",
                  paddingTop: "14px",
                  fontStyle: "italic",
                }}
              >
                Wir berücksichtigen euren Familienrhythmus automatisch.
              </p>
            </div>
          </section>

          {/* ── 4. Drei Tagesideen ── */}
          <section className="mb-12">
            <SectionLabel>Drei Arten, den Tag zu erleben</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {DAY_VARIANTS.map((v) => (
                <DayVariantCard key={v.id} v={v} />
              ))}
            </div>
          </section>

          {/* ── 5 & 6. Empfohlene Variante als Storyline ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8 mb-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Natur & Weite · Euer empfohlener Tag
              </div>
              <h2
                className="font-light mb-1"
                style={{ color: "var(--foreground)", fontSize: "1.35rem", letterSpacing: "0.01em" }}
              >
                So könnte euer Tag aussehen.
              </h2>
              <p
                style={{ color: "var(--muted)", fontSize: "0.8rem", fontStyle: "italic" }}
              >
                Ein echter Ausflug. Kein Tagesmarathon.
              </p>
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical connector */}
              <div
                className="absolute hidden sm:block"
                style={{
                  left: "80px",
                  top: "8px",
                  bottom: "8px",
                  width: "1px",
                  background: "var(--border)",
                }}
              />
              <div className="space-y-3">
                {TIMELINE.map((item, idx) => (
                  <TimelineItem key={idx} item={item} />
                ))}
              </div>
            </div>
          </section>

          {/* ── 7. Fahrzeit ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <SectionLabel>Wie viel sitzt ihr wirklich im Auto?</SectionLabel>
              <div className="grid grid-cols-3 gap-5 mb-5">
                {[
                  { label: "Gesamte Fahrzeit",          value: "ca. 2 Std. 20 Min." },
                  { label: "Längste Strecke",           value: "ca. 50 Min." },
                  { label: "Stopps",                    value: "3" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div
                      className="font-light mb-1"
                      style={{ color: "var(--foreground)", fontSize: "1.1rem" }}
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
                ))}
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  fontStyle: "italic",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "14px",
                }}
              >
                Für einen ganzen Ausflugstag finden wir das für euch gut vertretbar.
              </p>
            </div>
          </section>

          {/* ── 8. Für euch mitgedacht ── */}
          <section className="mb-12">
            <SectionLabel>Für euch mitgedacht</SectionLabel>
            <div className="space-y-3">
              {INSIGHTS.map((ins) => (
                <div
                  key={ins.who}
                  className="flex gap-5 p-5 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="shrink-0"
                    style={{
                      width: "2px",
                      borderRadius: "2px",
                      background: "var(--accent)",
                      alignSelf: "stretch",
                      minHeight: "36px",
                    }}
                  />
                  <div>
                    <div
                      className="text-sm font-medium mb-1.5"
                      style={{ color: "var(--foreground)" }}
                    >
                      {ins.who}
                    </div>
                    <p
                      className="leading-relaxed"
                      style={{ color: "var(--muted)", fontSize: "0.78rem" }}
                    >
                      {ins.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 9. Nicht ganz euer Tag? ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <SectionLabel>Nicht ganz euer Tag?</SectionLabel>
              <div className="flex flex-wrap gap-2 mb-7">
                {ADJUST_OPTS.map((opt) => (
                  <button
                    key={opt}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "20px",
                      padding: "7px 16px",
                      fontSize: "0.72rem",
                      letterSpacing: "0.04em",
                      color: "var(--foreground)",
                      cursor: "pointer",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div
                style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}
              >
                <p
                  className="mb-3"
                  style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}
                >
                  Oder sagt einfach, was anders werden soll.
                </p>
                <div
                  className="rounded-xl overflow-hidden mb-4"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <input
                    type="text"
                    placeholder="Elias möchte unbedingt Tiere sehen."
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--foreground)",
                      fontSize: "0.82rem",
                      fontWeight: 300,
                    }}
                  />
                </div>
                <button
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "10px 22px",
                    fontSize: "0.65rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--foreground)",
                    cursor: "pointer",
                  }}
                >
                  Tag neu denken
                </button>
              </div>
            </div>
          </section>

          {/* ── 10. Plan B ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-4">
                <CloudRain
                  size={14}
                  strokeWidth={1.4}
                  style={{ color: "var(--muted)", flexShrink: 0, marginTop: "3px" }}
                />
                <div className="flex-1">
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    Falls morgen anders wird
                  </div>
                  <p
                    className="leading-relaxed mb-5"
                    style={{ color: "var(--muted)", fontSize: "0.8rem" }}
                  >
                    Am Nachmittag ziehen stärkere Schauer auf.
                  </p>
                  <div
                    className="p-4 rounded-xl mb-4"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <div
                      style={{
                        color: "var(--accent)",
                        fontSize: "0.55rem",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Alternative
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
                      Wir kürzen den letzten Stopp, essen etwas früher und sind gegen 16:00 Uhr zurück.
                    </p>
                  </div>
                  <p
                    style={{
                      color: "var(--foreground)",
                      fontSize: "1rem",
                      fontWeight: 300,
                      fontStyle: "italic",
                      letterSpacing: "0.01em",
                    }}
                  >
                    „Der Tag bleibt gut. Nur anders."
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 11. Praktische Details ── */}
          <section className="mb-12">
            <SectionLabel>Damit ihr morgen einfach losfahren könnt</SectionLabel>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {PRACTICAL.map(({ label, value }, idx) => (
                <div
                  key={label}
                  className="flex items-start gap-4 px-6 py-4"
                  style={{
                    background: "var(--surface)",
                    borderBottom: idx < PRACTICAL.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.58rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      width: "100px",
                      flexShrink: 0,
                      paddingTop: "2px",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    className="font-light"
                    style={{ color: "var(--foreground)", fontSize: "0.8rem" }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 12. Heute-Modus ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
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
                Und wenn ihr nicht bis morgen warten wollt?
              </div>
              <h2
                className="font-light mb-6"
                style={{ color: "var(--foreground)", fontSize: "1.2rem" }}
              >
                Was machen wir jetzt?
              </h2>
              <div className="space-y-2 mb-6">
                {NOW_OPTS.map((opt) => (
                  <div
                    key={opt}
                    className="flex items-center justify-between px-5 py-3 rounded-xl"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>
                      {opt}
                    </span>
                    <ArrowRight
                      size={11}
                      strokeWidth={1.5}
                      style={{ color: "var(--muted)", flexShrink: 0 }}
                    />
                  </div>
                ))}
              </div>
              <button
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "10px 22px",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                Etwas für jetzt finden
              </button>
            </div>
          </section>

          {/* ── 13. Familie will unterschiedliches ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  marginBottom: "18px",
                }}
              >
                Und wenn nicht alle dasselbe wollen?
              </div>

              <div className="space-y-3 mb-7">
                {FAMILY_WANTS.map(({ who, want }) => (
                  <div
                    key={who}
                    className="flex items-baseline justify-between gap-4"
                    style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}
                  >
                    <span
                      style={{ color: "var(--muted)", fontSize: "0.72rem", flexShrink: 0 }}
                    >
                      {who}
                    </span>
                    <span
                      className="text-right font-light"
                      style={{ color: "var(--foreground)", fontSize: "0.85rem" }}
                    >
                      „{want}"
                    </span>
                  </div>
                ))}
              </div>

              <p
                className="mb-2"
                style={{ color: "var(--muted)", fontSize: "0.8rem" }}
              >
                Dann suchen wir nicht nach dem Durchschnitt.
              </p>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
                  fontWeight: 300,
                  fontStyle: "italic",
                  lineHeight: 1.4,
                  letterSpacing: "0.01em",
                }}
              >
                „Wir suchen nach einem Tag, der für alle etwas hat."
              </p>
            </div>
          </section>

          {/* Travel Vault link */}
          <section className="mb-10">
            <Link
              href="/trips/costa-rica-2026/vault"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 22px",
                borderRadius: "12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                textDecoration: "none",
              }}
            >
              <div>
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.52rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    marginBottom: "3px",
                  }}
                >
                  Costa Rica 2026
                </div>
                <div style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>
                  Travel Vault · Buchungen, Dokumente, Packlisten
                </div>
              </div>
              <ArrowRight size={13} strokeWidth={1.4} style={{ color: "var(--muted)", flexShrink: 0 }} />
            </Link>
          </section>

          {/* ── 14. Abschluss ── */}
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
                Der beste Reisetag beginnt nicht mit einer Liste.
              </h2>
              <p
                className="leading-relaxed mb-8 max-w-md"
                style={{ color: "var(--muted)", fontSize: "0.85rem" }}
              >
                Sondern mit der Frage: Worauf habt ihr heute wirklich Lust?
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
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Morgen planen
                  <ArrowRight size={11} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
