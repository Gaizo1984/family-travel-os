import { Film, Camera, BookOpen, Layers, Smartphone, ArrowRight, Clock, Sparkles, Image } from "lucide-react";

// ── Verified Unsplash photo ───────────────────────────────────────────────────
// photo-1581129724980-2ab2153c3d8d – palm tree, white sand beach, Costa Rica

const DEMO_PHOTO =
  "https://images.unsplash.com/photo-1581129724980-2ab2153c3d8d?auto=format&fit=crop&w=1200&q=80";

// ── Data ─────────────────────────────────────────────────────────────────────

const PROJECT_STATS = [
  { n: "14", label: "Reisetage" },
  { n: "5",  label: "Content-Ideen" },
  { n: "3",  label: "mögliche Reels" },
  { n: "2",  label: "Hotel-Posts" },
  { n: "1",  label: "Familien-Recap" },
];

const CONTENT_IDEAS = [
  {
    Icon: Film,
    format: "Reel",
    title: "Ein Tag an der Pazifikküste",
    hook: '„Nicht jeder gute Tag sieht nach Plan aus."',
    idea: "Kurze Clips vom Morgen am Hotel bis zum Sonnenuntergang am Strand – ohne Kommentar, nur Atmosphäre.",
    images: "8–12 kurze Clips",
    status: "Idee",
  },
  {
    Icon: Layers,
    format: "Carousel",
    title: "Warum Costa Rica mit Kindern funktioniert",
    hook: '„Wir haben uns gefragt, ob das realistisch ist. Es ist."',
    idea: "7 Slides mit ehrlichen Einschätzungen: Wege, Wasser, Klima, Essen, Tempo, Hotel, Fazit.",
    images: "7 Bilder",
    status: "Idee",
  },
  {
    Icon: Smartphone,
    format: "Story-Serie",
    title: "Unser Mietwagen-Tag",
    hook: '„Wir hatten kein festes Ziel. Das war die beste Entscheidung."',
    idea: "10–15 spontane Story-Clips entlang der Route – Straße, Natur, Lunch, Rückkehr.",
    images: "10–15 Stories",
    status: "Idee",
  },
  {
    Icon: Camera,
    format: "Hotelpost",
    title: "Westin Reserva Conchal – was für Familien zählt",
    hook: '„Nicht alles an einem Luxushotel funktioniert mit drei Kindern. Das hier schon."',
    idea: "Ehrlicher Hotelreview-Post: Pool, Zimmer, Essen, Service, was wirklich geholfen hat.",
    images: "4–6 Bilder",
    status: "Idee",
  },
  {
    Icon: BookOpen,
    format: "Reisejournal",
    title: "Der Moment, an dem wir angekommen sind",
    hook: '„Es war nicht die Ankunft am Flughafen."',
    idea: "Persönlicher Textpost über den Moment, in dem die Reise sich wirklich angefühlt hat – mit einem einzigen Bild.",
    images: "1–2 Bilder",
    status: "Idee",
  },
];

const CAPTIONS = [
  {
    style: "Emotional",
    text: "Manchmal ist ein Reisetag perfekt, weil nichts Spektakuläres passiert – außer, dass alle für einen Moment genau dort sind, wo sie sein sollen.",
    recommended: false,
  },
  {
    style: "Informativ",
    text: "Playa Conchal ist einer dieser Orte, die mit Kindern erstaunlich gut funktionieren: kurze Wege, warmes Wasser und genug Ruhe zwischen den Erlebnissen.",
    recommended: false,
  },
  {
    style: "Luxus-Reisejournal",
    text: "Costa Rica zeigt sich hier nicht laut, sondern weich: warmes Licht, weiter Strand und dieses seltene Gefühl, dass ein Ort die Familie sofort langsamer werden lässt.",
    recommended: true,
  },
];

const REEL_SCENES = [
  { label: "Hook",    text: "Ein Tag Costa Rica, der nicht nach Tourprogramm aussieht." },
  { label: "Szene 1", text: "Hotel am Morgen – Frühstück, ruhige Atmosphäre, keine Eile." },
  { label: "Szene 2", text: "Fahrt durch grüne Landschaft – Fenster offen, Kinder schauen raus." },
  { label: "Szene 3", text: "Naturstopp – Bewegung, Staunen, kurze Pause." },
  { label: "Szene 4", text: "Lunch – Tisch im Freien, gutes Essen, Zeit lassen." },
  { label: "Szene 5", text: "Rückkehr zum Sonnenuntergang – letztes Licht am Strand." },
  { label: "Outro",   text: "Nicht alles sehen. Das Richtige erleben." },
];

const CAROUSEL_SLIDES = [
  "Der erste Eindruck",
  "Warum Playa Conchal gut funktioniert",
  "Was Lia und Elias mochten",
  "Was mit Lumi wichtig war",
  "Unser schönster Tagesmoment",
  "Was wir anders machen würden",
  "Für wen diese Reise passt",
];

const DURING_POSTS = [
  "Stories – spontane Momente",
  "Kurze Reels – Atmosphäre",
  "Tägliche Story-Updates",
];

const AFTER_POSTS = [
  "Hotelreview",
  "Route & Planung",
  "Kosten & Ehrlichkeit",
  "Familien-Recap",
  "Best-of-Carousel",
];

const BRAND_STYLES = [
  { label: "Emotional & hochwertig",          recommended: false },
  { label: "Informativ & hilfreich",          recommended: false },
  { label: "Luxusreise mit Familie",           recommended: true  },
  { label: "Persönlich, aber nicht privat",   recommended: false },
  { label: "Weniger Influencer. Mehr Reisejournal.", recommended: false },
];

const AI_CAPS = [
  "Bilder beschreiben und kategorisieren",
  "Passende Captions in eurem Stil",
  "Reel-Strukturen entwickeln",
  "Carousel-Slides vorbereiten",
  "Hashtags vorschlagen",
  "Orte und Stimmung erkennen",
  "Content einer Reise zuordnen",
  "Private und öffentliche Inhalte trennen",
  "Hotelreviews vorbereiten",
  "Aus einer Reise ein digitales Journal bauen",
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

function FormatBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: "0.5rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--accent)",
        border: "1px solid rgba(184,154,94,0.35)",
        padding: "2px 9px",
        borderRadius: "20px",
      }}
    >
      {label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContentStudioPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── 1. Header ── */}
      <div
        className="px-7 md:px-10 py-10 md:py-12"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <EyebrowLabel>Reisen, die bleiben</EyebrowLabel>
        <h1
          className="font-light leading-tight mb-2"
          style={{
            color: "var(--foreground)",
            fontSize: "clamp(1.8rem, 5vw, 2.6rem)",
            letterSpacing: "-0.02em",
          }}
        >
          Aus euren Reisen wird eine Geschichte.
        </h1>
        <p
          className="max-w-xl"
          style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 300, lineHeight: 1.7 }}
        >
          Content-Ideen, Captions, Reels und Erinnerungen –
          vorbereitet aus euren echten Reisemomenten.
        </p>
      </div>

      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-8 pb-20">

          {/* ── 2. Aktives Projekt ── */}
          <section className="mt-10 mb-12">
            <SectionLabel>Aktives Projekt</SectionLabel>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* Project header */}
              <div
                className="px-6 py-5"
                style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    height: "2px",
                    background: "linear-gradient(to right, var(--accent), transparent)",
                    marginBottom: "16px",
                    borderRadius: "2px",
                  }}
                />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      className="font-medium mb-0.5"
                      style={{ color: "var(--foreground)", fontSize: "1rem" }}
                    >
                      Costa Rica 2026
                    </h2>
                    <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                      Playa Conchal · 23. Juli – 6. August
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.52rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--accent)",
                      border: "1px solid rgba(184,154,94,0.3)",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Content wird vorbereitet
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div
                className="grid grid-cols-5 divide-x"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                {PROJECT_STATS.map(({ n, label }) => (
                  <div key={label} className="px-4 py-4 text-center">
                    <div
                      className="font-light mb-0.5"
                      style={{ color: "var(--foreground)", fontSize: "1.2rem" }}
                    >
                      {n}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.52rem", lineHeight: 1.3 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 3. Bildanalyse-Rohling ── */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <SectionLabel>Bildanalyse · Demo</SectionLabel>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="flex flex-col md:flex-row">
                {/* Photo */}
                <div className="md:w-2/5 shrink-0" style={{ minHeight: "220px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DEMO_PHOTO}
                    alt="Demo-Reisefoto Costa Rica"
                    className="w-full h-full object-cover"
                    style={{ display: "block", minHeight: "220px" }}
                  />
                </div>

                {/* Analysis */}
                <div
                  className="flex-1 p-6"
                  style={{ background: "var(--surface)" }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.5rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      marginBottom: "10px",
                    }}
                  >
                    Was ist auf dem Bild zu sehen? · Demo
                  </div>
                  <p
                    className="leading-relaxed mb-5"
                    style={{ color: "var(--foreground)", fontSize: "0.82rem", fontStyle: "italic", fontWeight: 300 }}
                  >
                    „Ein ruhiger Strandmoment kurz vor Sonnenuntergang. Warmes Licht, flaches Wasser,
                    entspannte Familienatmosphäre. Das Bild wirkt weniger wie ein klassisches
                    Urlaubsfoto und mehr wie ein stiller Erinnerungsmoment."
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Erkannter Ort",        value: "Playa Conchal" },
                      { label: "Stimmung",              value: "Ruhig · warm · hochwertig" },
                      { label: "Mögliche Verwendung",  value: "Story · Carousel-Cover · Reisejournal" },
                      { label: "Passt zu",              value: "Costa Rica 2026" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-baseline gap-3">
                        <span
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.55rem",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                            width: "130px",
                          }}
                        >
                          {label}
                        </span>
                        <span style={{ color: "var(--foreground)", fontSize: "0.75rem", fontWeight: 300 }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p
                    className="mt-4"
                    style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.1em" }}
                  >
                    Keine echte Bildanalyse · Demo-Beschreibung
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. Content-Ideen ── */}
          <section className="mb-12">
            <SectionLabel>Was daraus werden könnte</SectionLabel>
            <div className="space-y-3">
              {CONTENT_IDEAS.map(({ Icon, format, title, hook, idea, images, status }) => (
                <div
                  key={title}
                  className="rounded-xl p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex items-center justify-center rounded-lg shrink-0"
                      style={{
                        width: "36px",
                        height: "36px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <Icon size={13} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <FormatBadge label={format} />
                        <span
                          style={{
                            fontSize: "0.5rem",
                            letterSpacing: "0.1em",
                            color: "var(--muted)",
                            border: "1px solid var(--border)",
                            padding: "2px 8px",
                            borderRadius: "20px",
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      <h3
                        className="font-medium mb-1"
                        style={{ color: "var(--foreground)", fontSize: "0.88rem" }}
                      >
                        {title}
                      </h3>
                      <p
                        className="mb-2"
                        style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}
                      >
                        {hook}
                      </p>
                      <p style={{ color: "var(--muted)", fontSize: "0.7rem", lineHeight: 1.55 }}>
                        {idea}
                      </p>
                    </div>
                    <div
                      className="shrink-0 text-right"
                      style={{ paddingTop: "2px" }}
                    >
                      <div style={{ color: "var(--muted)", fontSize: "0.55rem", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                        {images}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 5. Caption-Vorschläge ── */}
          <section className="mb-12">
            <SectionLabel>Caption-Vorschläge · Demo</SectionLabel>
            <div className="space-y-3">
              {CAPTIONS.map(({ style, text, recommended }) => (
                <div
                  key={style}
                  className="rounded-xl p-5"
                  style={{
                    background: "var(--surface)",
                    border: recommended ? "1px solid rgba(184,154,94,0.35)" : "1px solid var(--border)",
                  }}
                >
                  {recommended && (
                    <div
                      style={{
                        height: "2px",
                        background: "linear-gradient(to right, var(--accent), transparent)",
                        marginBottom: "14px",
                        borderRadius: "2px",
                      }}
                    />
                  )}
                  <div
                    style={{
                      color: recommended ? "var(--accent)" : "var(--muted)",
                      fontSize: "0.52rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    {style}
                    {recommended && " · Euer Stil"}
                  </div>
                  <p
                    style={{
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                      fontStyle: "italic",
                      fontWeight: 300,
                      lineHeight: 1.7,
                    }}
                  >
                    „{text}"
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 6. Reel-Planer ── */}
          <section className="mb-12">
            <SectionLabel>Reel-Struktur · Demo</SectionLabel>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* Reel header */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
              >
                <Film size={13} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
                <div>
                  <div className="font-medium" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>
                    Ein Tag mit dem Mietwagen
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.62rem" }}>
                    Costa Rica 2026 · ca. 30–60 Sek.
                  </div>
                </div>
              </div>

              {/* Scenes */}
              <div style={{ background: "var(--surface)" }}>
                {REEL_SCENES.map(({ label, text }, idx) => (
                  <div
                    key={label}
                    className="flex items-start gap-4 px-6 py-3.5"
                    style={{
                      borderBottom: idx < REEL_SCENES.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: "60px",
                        color: label === "Hook" || label === "Outro" ? "var(--accent)" : "var(--muted)",
                        fontSize: "0.55rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        paddingTop: "2px",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ width: "1px", background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }} />
                    <p
                      style={{
                        color: label === "Hook" || label === "Outro"
                          ? "var(--foreground)"
                          : "var(--muted)",
                        fontSize: "0.78rem",
                        fontStyle: label === "Hook" || label === "Outro" ? "italic" : "normal",
                        fontWeight: label === "Hook" || label === "Outro" ? 300 : 300,
                        lineHeight: 1.5,
                      }}
                    >
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 7. Carousel-Planer ── */}
          <section className="mb-12">
            <SectionLabel>Carousel-Idee · Demo</SectionLabel>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div
                className="px-6 py-4"
                style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <Layers size={12} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
                  <div>
                    <div className="font-medium" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>
                      Costa Rica mit Kindern: Was wirklich zählt
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.62rem" }}>
                      {CAROUSEL_SLIDES.length} Slides
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)" }}>
                {CAROUSEL_SLIDES.map((slide, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 px-6 py-3"
                    style={{
                      borderBottom: idx < CAROUSEL_SLIDES.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: "20px",
                        color: "var(--accent)",
                        fontSize: "0.7rem",
                        fontWeight: 300,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem", fontWeight: 300 }}>
                      {slide}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 8. Content-Kalender ── */}
          <section className="mb-12">
            <SectionLabel>Wann posten?</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={11} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    Während der Reise
                  </div>
                </div>
                <div className="space-y-2.5">
                  {DURING_POSTS.map((p) => (
                    <div key={p} className="flex items-start gap-2.5">
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
                      <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="rounded-xl p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={11} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    Nach der Reise
                  </div>
                </div>
                <div className="space-y-2.5">
                  {AFTER_POSTS.map((p) => (
                    <div key={p} className="flex items-start gap-2.5">
                      <div
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          background: "var(--muted)",
                          flexShrink: 0,
                          marginTop: "6px",
                        }}
                      />
                      <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── 9. Reisejournal ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <EyebrowLabel>Nicht jeder Moment muss gepostet werden.</EyebrowLabel>
              <p
                className="font-light mb-6"
                style={{ color: "var(--foreground)", fontSize: "1rem", fontStyle: "italic" }}
              >
                Manche Bilder sind für Instagram. Andere nur für euch.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    label: "Für den Kanal",
                    items: ["Hotelmomente", "Route & Empfehlungen", "Tipps & Erfahrungen", "Reels & Atmosphäre", "Carousels"],
                    accent: true,
                  },
                  {
                    label: "Für euch",
                    items: ["Kleine Geschichten", "Kinderzitate", "Lieblingsmomente", "Familienfotos", "Private Erinnerungen"],
                    accent: false,
                  },
                ].map(({ label, items, accent }) => (
                  <div key={label}>
                    <div
                      style={{
                        color: accent ? "var(--accent)" : "var(--muted)",
                        fontSize: "0.55rem",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        marginBottom: "12px",
                      }}
                    >
                      {label}
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item} className="flex items-center gap-2.5">
                          <div
                            style={{
                              width: "4px",
                              height: "4px",
                              borderRadius: "50%",
                              background: accent ? "var(--accent)" : "var(--border)",
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
                ))}
              </div>
            </div>
          </section>

          {/* ── 10. Markenstil ── */}
          <section className="mb-12">
            <SectionLabel>Euer Stil</SectionLabel>
            <div className="space-y-2">
              {BRAND_STYLES.map(({ label, recommended }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-5 py-4 rounded-xl"
                  style={{
                    background: recommended
                      ? "rgba(184,154,94,0.07)"
                      : "var(--surface)",
                    border: recommended
                      ? "1px solid rgba(184,154,94,0.35)"
                      : "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      color: recommended ? "var(--foreground)" : "var(--muted)",
                      fontSize: "0.85rem",
                      fontWeight: recommended ? 400 : 300,
                    }}
                  >
                    {label}
                  </span>
                  {recommended && (
                    <span
                      style={{
                        fontSize: "0.5rem",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                        border: "1px solid rgba(184,154,94,0.3)",
                        padding: "2px 8px",
                        borderRadius: "20px",
                        flexShrink: 0,
                        marginLeft: "12px",
                      }}
                    >
                      Ausgewählt
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── 11. Was die KI können soll ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <Sparkles size={13} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
                <EyebrowLabel>Was Family Travel OS später kann</EyebrowLabel>
              </div>
              <p
                className="mb-6"
                style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.65 }}
              >
                Für diesen Schritt ist alles ein visueller Rohling. Keine echte Bildanalyse,
                keine KI-Generierung. Aber so soll es sich anfühlen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AI_CAPS.map((cap) => (
                  <div key={cap} className="flex items-start gap-3">
                    <div
                      style={{
                        width: "2px",
                        minHeight: "14px",
                        background: "var(--accent)",
                        borderRadius: "2px",
                        flexShrink: 0,
                        marginTop: "4px",
                      }}
                    />
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                      {cap}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 12. Abschluss ── */}
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
                Aus Erlebnissen werden Erinnerungen.
              </h2>
              <p
                className="mb-8"
                style={{
                  color: "var(--muted)",
                  fontSize: "clamp(0.85rem, 2vw, 1rem)",
                  fontStyle: "italic",
                }}
              >
                Aus Erinnerungen wird Content.
              </p>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
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
                Content-Idee erstellen
                <ArrowRight size={11} strokeWidth={1.5} />
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
