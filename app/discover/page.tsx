import Link from "next/link";
import { ArrowRight, Info, BookmarkPlus } from "lucide-react";

// ── Verified Unsplash photos ──────────────────────────────────────────────────
const P = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const PHOTOS = {
  srilanka:   P("photo-1519566335946-e6f65f0f4fdf"),       // Sri Lanka stilt fishermen beach
  seychellen: P("photo-1742664142349-cff27bcdbcfd"),       // Seychelles aerial tropical beach
  maldives:   P("photo-1590523277543-a94d2e4eb00b"),       // Maldives overwater bungalow
  costarica:  P("photo-1581129724980-2ab2153c3d8d"),       // Costa Rica palm beach
  oman:       P("photo-1707720733106-803bb0808363"),        // Oman desert dunes
  costarica2: P("photo-1611222566512-cb8dd8e689e5"),       // Costa Rica forest river
  japan:      P("photo-1558870832-c8db4b5b47d1"),          // Japan red temple water
  kapstadt:   P("photo-1580060839134-75a5edca2e99"),       // Cape Town aerial
  chedi:      P("photo-1778655504565-5d70f77212cd"),       // The Chedi Muscat
  omanmeer:   P("photo-1598959626848-a16d4d0b2564"),       // Oman coast/meer
};

// ── Light text constants ──────────────────────────────────────────────────────
const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";
const H_GOLD  = "#C9A96E";

// ── Data ─────────────────────────────────────────────────────────────────────

const REISEFENSTER = [
  {
    label:    "Herbstferien 2028",
    mood:     "Warm, besonders, etwa zwei Wochen",
    photo:    PHOTOS.srilanka,
    featured: true,
  },
  {
    label:    "Sommerferien 2029",
    mood:     "Große Reise, wenn ihr mehr Zeit habt",
    photo:    PHOTOS.maldives,
    featured: false,
  },
  {
    label:    "Kurzfristig",
    mood:     "Eine Woche raus, ohne zu viel Planung",
    photo:    PHOTOS.costarica,
    featured: false,
  },
];

const CURATED = [
  {
    dest:   "Oman",
    feel:   "Wüste, Berge und Meer – mit wenig Zeitverschiebung.",
    why:    "Abwechslungsreiche Route auf engem Raum. Lumi-freundlich.",
    watch:  "Hitze im Sommer – Oktober ist ideal.",
    photo:  PHOTOS.oman,
  },
  {
    dest:   "Costa Rica",
    feel:   "Natur, Tiere und ein Familienrhythmus, der funktioniert.",
    why:    "Wenig Transfers, viel Natur, gute Hotels für Familien.",
    watch:  "Regenzeit bis November – Timing wichtig.",
    photo:  PHOTOS.costarica2,
  },
  {
    dest:   "Seychellen",
    feel:   "Wenig Programm. Viel gemeinsames Erleben.",
    why:    "Einer der ruhigsten Familienurlaube überhaupt.",
    watch:  "Sehr begrenzte Direktflüge aus Deutschland.",
    photo:  PHOTOS.seychellen,
  },
  {
    dest:   "Japan & Okinawa",
    feel:   "Eine andere Welt mit Komfort und Strandabschluss.",
    why:    "Kulturell stark für Lia und Elias – Okinawa entspannt.",
    watch:  "Lange Flugzeit. Lumi dann 4 Jahre – gut machbar.",
    photo:  PHOTOS.japan,
  },
];

const GEFUEHLE = [
  { text: "Ans Ende der Welt",                      sub: "Weit weg. Wirklich weg." },
  { text: "Ein besonderes Hotel",                   sub: "Das Hotel ist das Erlebnis." },
  { text: "Natur, die Kinder nicht vergessen",      sub: "Tiere, Weite, echte Eindrücke." },
  { text: "Meer und sonst nichts",                  sub: "Ankommen. Bleiben. Genießen." },
  { text: "Kultur ohne Pflichtprogramm",            sub: "Verstehen statt abhaken." },
  { text: "Große Reise mit mehreren Kapiteln",      sub: "Eine Route, die erzählt." },
];

const HOTELS = [
  {
    name:    "Nihi Sumba",
    tag:     "Indonesien",
    mood:    "Wenn das Hotel selbst das Erlebnis ist.",
    photo:   PHOTOS.omanmeer,
  },
  {
    name:    "The Chedi Muscat",
    tag:     "Oman",
    mood:    "Ruhe, Architektur und Ankommen.",
    photo:   PHOTOS.chedi,
  },
  {
    name:    "One&Only Mandarina",
    tag:     "Mexiko",
    mood:    "Dschungel, Meer und dieses Gefühl von Wegsein.",
    photo:   PHOTOS.costarica2,
  },
  {
    name:    "Six Senses Zighy Bay",
    tag:     "Oman",
    mood:    "Spektakulär – aber nicht für jede Route sinnvoll.",
    photo:   PHOTOS.oman,
  },
];

const NOT_SHOWN = [
  "Zu viele Ortswechsel mit Lumi",
  "Zu lange Transfers ohne echten Mehrwert",
  "Hotels, die schön aussehen, aber als Familie schwierig sind",
  "Ziele, die zur falschen Reisezeit glänzen",
  "Reisen, die mehr Organisation brauchen als sie zurückgeben",
];

const DNA_LIKES = [
  "Besondere Hotels",
  "Natur und Weite",
  "Hochwertige, aber nicht steife Orte",
  "Reisen mit echten Erinnerungen",
  "Genug Zeit vor Ort",
];

const DNA_AVOIDS = [
  "Hektische Rundreisen",
  "Sterile Familienresorts",
  "Zu viele Ein-Nacht-Stopps",
  "Reine Strandreisen ohne Erlebnis",
];

const SEASONS = [
  {
    month:  "Juli",
    dests:  ["Costa Rica", "Seychellen", "Mauritius"],
  },
  {
    month:  "Oktober",
    dests:  ["Oman", "Sri Lanka", "Seychellen"],
    active: true,
  },
  {
    month:  "Januar",
    dests:  ["Dubai", "Oman", "Malediven"],
  },
  {
    month:  "April",
    dests:  ["Japan", "Südafrika", "Brasilien"],
  },
];

const INBOX_ITEMS = [
  { label: "Nihi Sumba",                 tag: "Hotel" },
  { label: "The Chedi Muscat",           tag: "Hotel" },
  { label: "Seychellen Inselhopping",    tag: "Idee"  },
  { label: "Safari mit Kindern",         tag: "Thema" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{
      color: light ? H_GOLD : "var(--accent)",
      fontSize: "0.55rem",
      letterSpacing: "0.26em",
      textTransform: "uppercase",
      marginBottom: "10px",
    }}>
      {children}
    </div>
  );
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: "var(--muted)",
      fontSize: "0.58rem",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      marginBottom: "18px",
    }}>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── 1. Editorial Header ── */}
      <div
        className="px-7 md:px-10 py-10 md:py-12"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <Eyebrow>Kuratiert für euch</Eyebrow>
        <h1
          className="font-light leading-tight mb-2"
          style={{
            color: "var(--foreground)",
            fontSize: "clamp(1.9rem, 5vw, 2.8rem)",
            letterSpacing: "-0.02em",
          }}
        >
          Wohin, wenn ihr noch gar nicht sucht?
        </h1>
        <p
          className="mb-5 max-w-lg"
          style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 300, lineHeight: 1.65 }}
        >
          Reiseideen, die zu eurer Familie passen – nicht zu irgendeinem Trend.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.12em" }}>
          Sarah · Marcel · Lia · Elias · Lumi
        </p>
      </div>

      <div className="max-w-3xl mx-auto w-full px-5 md:px-8 pb-20">

        {/* ── 2. Hauptempfehlung ── */}
        <section className="mt-10 mb-12">
          <div
            className="group relative overflow-hidden rounded-2xl"
            style={{ height: "420px", cursor: "pointer" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PHOTOS.srilanka}
              alt="Sri Lanka & Malediven"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(10,9,7,0.98) 0%, rgba(10,9,7,0.5) 50%, rgba(10,9,7,0.1) 100%)",
              }}
            />
            {/* Recommended badge */}
            <div
              className="absolute top-5 left-5"
              style={{
                background: "var(--accent)",
                borderRadius: "20px",
                padding: "4px 13px",
                fontSize: "0.5rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#1a1714",
                fontWeight: 500,
              }}
            >
              Empfehlung für Herbstferien 2028
            </div>

            <div className="absolute inset-x-0 bottom-0 p-7 md:p-9">
              <p
                className="mb-1"
                style={{ color: H_MUTED, fontSize: "0.7rem", fontStyle: "italic" }}
              >
                Erleben. Staunen. Ankommen.
              </p>
              <h2
                className="font-light leading-tight mb-2"
                style={{ color: H_FG, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", letterSpacing: "-0.01em" }}
              >
                Sri Lanka & Malediven
              </h2>
              <p
                className="mb-1"
                style={{ color: H_MUTED, fontSize: "0.68rem" }}
              >
                Kulturelles Dreieck · Hochland · Südküste · Malediven
              </p>
              <p
                className="mb-5 max-w-md"
                style={{ color: H_MUTED, fontSize: "0.75rem", fontStyle: "italic", lineHeight: 1.6 }}
              >
                Genug Abenteuer für Lia und Elias, Tiere und Strand für Lumi und ein
                ruhiger Abschluss für Sarah und Marcel.
              </p>
              <Link
                href="/trips/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(240,235,227,0.12)",
                  border: "1px solid rgba(240,235,227,0.25)",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  fontSize: "0.62rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: H_FG,
                  textDecoration: "none",
                }}
              >
                Reiseidee ansehen
                <ArrowRight size={10} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 3. Drei Reisefenster ── */}
        <section className="mb-12">
          <SecLabel>Wann wollt ihr reisen?</SecLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {REISEFENSTER.map((r) => (
              <div
                key={r.label}
                className="group relative overflow-hidden rounded-xl"
                style={{
                  height: "200px",
                  cursor: "pointer",
                  border: r.featured ? "1px solid rgba(184,154,94,0.4)" : "1px solid transparent",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.photo}
                  alt={r.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.3) 65%, transparent 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  {r.featured && (
                    <div
                      style={{
                        color: H_GOLD,
                        fontSize: "0.48rem",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Nächste Ferien
                    </div>
                  )}
                  <div
                    className="font-medium mb-1"
                    style={{ color: H_FG, fontSize: "0.85rem" }}
                  >
                    {r.label}
                  </div>
                  <p style={{ color: H_MUTED, fontSize: "0.62rem", fontStyle: "italic" }}>
                    {r.mood}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. Für eure Familie gerade spannend ── */}
        <section className="mb-12">
          <SecLabel>Für eure Familie gerade spannend</SecLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CURATED.map((c) => (
              <div
                key={c.dest}
                className="group relative overflow-hidden rounded-xl"
                style={{ height: "260px", cursor: "pointer" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.photo}
                  alt={c.dest}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.35) 55%, transparent 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3
                    className="font-medium mb-1.5"
                    style={{ color: H_FG, fontSize: "1rem" }}
                  >
                    {c.dest}
                  </h3>
                  <p
                    className="mb-1.5"
                    style={{ color: H_MUTED, fontSize: "0.68rem", fontStyle: "italic" }}
                  >
                    {c.feel}
                  </p>
                  <p style={{ color: H_MUTED, fontSize: "0.62rem", opacity: 0.8 }}>
                    {c.why}
                  </p>
                  {/* Watch-out pill */}
                  <div
                    className="mt-2 inline-flex items-center gap-1.5"
                    style={{
                      background: "rgba(10,9,7,0.5)",
                      border: "1px solid rgba(240,235,227,0.15)",
                      borderRadius: "20px",
                      padding: "3px 9px",
                    }}
                  >
                    <Info size={8} strokeWidth={1.5} style={{ color: H_MUTED, flexShrink: 0 }} />
                    <span style={{ color: H_MUTED, fontSize: "0.55rem" }}>{c.watch}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Reisegefühle ── */}
        <section className="mb-12">
          <SecLabel>Wonach fühlt es sich gerade an?</SecLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {GEFUEHLE.map(({ text, sub }) => (
              <button
                key={text}
                className="rounded-xl p-5 text-left"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div
                  className="font-medium leading-tight mb-1.5"
                  style={{ color: "var(--foreground)", fontSize: "0.82rem" }}
                >
                  {text}
                </div>
                <div style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}>
                  {sub}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── 6. Hotel-Inspiration ── */}
        <section className="mb-12">
          <SecLabel>Hotels, für die man eine Reise baut</SecLabel>
          <div className="grid grid-cols-2 gap-4">
            {HOTELS.map((h) => (
              <div
                key={h.name}
                className="group relative overflow-hidden rounded-xl"
                style={{ height: "220px", cursor: "pointer" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.photo}
                  alt={h.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.2) 60%, transparent 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div
                    style={{
                      color: H_GOLD,
                      fontSize: "0.48rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    {h.tag}
                  </div>
                  <div
                    className="font-medium mb-1"
                    style={{ color: H_FG, fontSize: "0.88rem" }}
                  >
                    {h.name}
                  </div>
                  <p style={{ color: H_MUTED, fontSize: "0.62rem", fontStyle: "italic" }}>
                    {h.mood}
                  </p>
                </div>
                {/* Bookmark icon */}
                <button
                  className="absolute top-3 right-3"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <BookmarkPlus
                    size={14}
                    strokeWidth={1.4}
                    style={{ color: "rgba(240,235,227,0.5)" }}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Was wir euch nicht zeigen ── */}
        <section className="mb-12">
          <div
            className="rounded-xl p-6 md:p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2
              className="font-light mb-5"
              style={{ color: "var(--foreground)", fontSize: "1.05rem" }}
            >
              Nicht jede schöne Reise passt zu euch.
            </h2>
            <div className="space-y-3">
              {NOT_SHOWN.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div
                    style={{
                      width: "1px",
                      minHeight: "14px",
                      background: "var(--border)",
                      borderRadius: "2px",
                      flexShrink: 0,
                      marginTop: "4px",
                    }}
                  />
                  <p style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.55 }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. Reise-DNA ── */}
        <section className="mb-12">
          <SecLabel>Was wir aus euren Reisen lernen</SecLabel>
          <div
            className="rounded-xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div
                  style={{
                    color: "var(--accent)",
                    fontSize: "0.52rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Ihr mögt
                </div>
                <div className="space-y-2.5">
                  {DNA_LIKES.map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          background: "var(--accent)",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.52rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Ihr vermeidet eher
                </div>
                <div className="space-y-2.5">
                  {DNA_AVOIDS.map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          background: "var(--border)",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: "var(--muted)", fontSize: "0.78rem", fontWeight: 300 }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. Saison-Radar ── */}
        <section className="mb-12">
          <SecLabel>Wann wohin? · Demo</SecLabel>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {SEASONS.map(({ month, dests, active }, idx) => (
              <div
                key={month}
                className="flex items-center gap-5 px-6 py-4"
                style={{
                  background: active ? "rgba(184,154,94,0.05)" : "var(--surface)",
                  borderBottom: idx < SEASONS.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: "72px",
                    color: active ? "var(--accent)" : "var(--muted)",
                    fontSize: "0.72rem",
                    fontWeight: active ? 400 : 300,
                  }}
                >
                  {month}
                </div>
                <div style={{ width: "1px", height: "16px", background: "var(--border)", flexShrink: 0 }} />
                <div className="flex flex-wrap gap-2">
                  {dests.map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: "0.7rem",
                        color: active ? "var(--foreground)" : "var(--muted)",
                        fontWeight: active ? 400 : 300,
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p
            className="mt-3"
            style={{ color: "var(--muted)", fontSize: "0.58rem", fontStyle: "italic" }}
          >
            Demo-Daten · keine echte Wetter-API
          </p>
        </section>

        {/* ── 10. Ideen-Inbox ── */}
        <section className="mb-12">
          <div
            className="rounded-xl p-6 md:p-7"
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
              Merken, sammeln, später verstehen
            </div>
            <h2
              className="font-light mb-2"
              style={{ color: "var(--foreground)", fontSize: "1.05rem" }}
            >
              Eure Ideen-Inbox
            </h2>
            <p
              className="mb-6"
              style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.65, maxWidth: "480px" }}
            >
              Schickt Hotels, Instagram-Posts, Artikel oder Orte in eure Ideen-Inbox.
              Family Travel OS erkennt, ob daraus eine echte Reiseidee werden könnte.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {INBOX_ITEMS.map(({ label, tag }) => (
                <div
                  key={label}
                  className="rounded-xl p-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div
                    style={{
                      fontSize: "0.48rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--accent)",
                      marginBottom: "4px",
                    }}
                  >
                    {tag}
                  </div>
                  <div
                    className="font-light leading-tight"
                    style={{ color: "var(--foreground)", fontSize: "0.72rem" }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}
            >
              Noch keine echte Import-Funktion · Demo-Karten
            </p>
          </div>
        </section>

        {/* ── 11. Abschluss ── */}
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
              Manchmal beginnt eine Reise nicht mit einem Ziel.
            </h2>
            <p
              className="mb-8"
              style={{
                color: "var(--muted)",
                fontSize: "0.88rem",
                fontStyle: "italic",
                lineHeight: 1.6,
              }}
            >
              Sondern mit einem Gefühl, das immer wieder auftaucht.
            </p>
            <Link
              href="/plan"
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
              Reise jetzt konkret planen
              <ArrowRight size={11} strokeWidth={1.5} />
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
