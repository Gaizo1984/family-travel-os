import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";

// ── Verified Unsplash photos ──────────────────────────────────────────────────

const P = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const PHOTOS = {
  muscat: P("photo-1763544376715-2de79af4ff0c"), // Muscat cityscape at sunrise
  wueste: P("photo-1707720733106-803bb0808363"), // desert dunes and clouds
  jabal:  P("photo-1557671760-608f3439ae05"),    // Jabal Akhdar mountain, Oman
  meer:   P("photo-1598959626848-a16d4d0b2564"), // rocky coast, Arabian Sea
  wadi:   P("photo-1763377357842-039959a0012a"), // sunlit canyon, turquoise pool
};

// ── Constants ─────────────────────────────────────────────────────────────────

const H_FG   = "#F0EBE3";
const H_MUTED = "#A89880";

// ── Data ─────────────────────────────────────────────────────────────────────

interface Station {
  name: string;
  nights: number;
  photo: string;
  transfer?: string;
}

interface Route {
  id: string;
  badge: string;
  badgeColor: string;
  name: string;
  tagline: string;
  total: string;
  recommended: boolean;
  reason?: string;
  stations: Station[];
  feel: string[];
  familyHint: string;
}

const ROUTES: Route[] = [
  {
    id: "entspannt",
    badge: "MAXIMAL ENTSPANNT",
    badgeColor: "var(--muted)",
    name: "Weniger Orte. Mehr Oman.",
    tagline:
      "Viel Zeit. Wenig Kofferpacken. Genug Raum, um besondere Hotels wirklich zu erleben.",
    total: "14 Nächte · 3 Stationen",
    recommended: false,
    stations: [
      { name: "Muscat", nights: 5, photo: PHOTOS.muscat },
      { name: "Jabal Akhdar", nights: 4, photo: PHOTOS.jabal, transfer: "ca. 2 Std. 30 Min." },
      { name: "Muscat / Meer", nights: 5, photo: PHOTOS.meer, transfer: "ca. 3 Std." },
    ],
    feel: ["Ruhige Tage", "Kurze Planung", "Wenige Hotelwechsel", "Viel gemeinsame Zeit"],
    familyHint:
      "Besonders angenehm mit Lumi, weil nur zwei größere Ortswechsel nötig sind.",
  },
  {
    id: "ausgewogen",
    badge: "PASST BESONDERS GUT ZU EUCH",
    badgeColor: "var(--accent)",
    name: "Oman in Balance",
    tagline:
      "Große Landschaften, echte Abwechslung und trotzdem genug Zeit zum Ankommen.",
    total: "14 Nächte · 4 Stationen",
    recommended: true,
    reason:
      "Diese Route verbindet genau das, was euch wichtig ist: außergewöhnliche Hotels, große Landschaften, Erlebnisse für die Kinder und genug Zeit, damit die Reise nicht in Stress kippt.",
    stations: [
      { name: "Muscat", nights: 4, photo: PHOTOS.muscat },
      { name: "Wüste", nights: 2, photo: PHOTOS.wueste, transfer: "ca. 3 Std." },
      { name: "Jabal Akhdar", nights: 3, photo: PHOTOS.jabal, transfer: "ca. 2 Std." },
      { name: "Meer", nights: 5, photo: PHOTOS.meer, transfer: "ca. 4 Std." },
    ],
    feel: ["Stadt", "Wüste", "Berge", "Meer"],
    familyHint:
      "Lia und Elias erleben jeden Teil des Oman. Lumi bekommt zwischen den intensiveren Etappen genug ruhige Tage.",
  },
  {
    id: "entdecken",
    badge: "MEHR ENTDECKEN",
    badgeColor: "var(--muted)",
    name: "Der große Oman",
    tagline: "Mehr Oman. Mehr Kontraste. Mehr Bewegung.",
    total: "14 Nächte · 5 Stationen",
    recommended: false,
    stations: [
      { name: "Muscat", nights: 3, photo: PHOTOS.muscat },
      { name: "Wadi / Küste", nights: 2, photo: PHOTOS.wadi, transfer: "ca. 1 Std. 30 Min." },
      { name: "Wüste", nights: 2, photo: PHOTOS.wueste, transfer: "ca. 3 Std." },
      { name: "Jabal Akhdar", nights: 3, photo: PHOTOS.jabal, transfer: "ca. 2 Std." },
      { name: "Meer", nights: 4, photo: PHOTOS.meer, transfer: "ca. 4 Std." },
    ],
    feel: ["Abwechslungsreich", "Intensiver", "Mehr Landschaften", "Mehr Ortswechsel"],
    familyHint:
      "Für Lia und Elias besonders spannend. Mit Lumi machbar, aber deutlich anspruchsvoller.",
  },
];

const PERSPECTIVES = [
  {
    who: "Für Sarah & Marcel",
    views: [
      { id: "entspannt", label: "Maximal entspannt", text: "Die Hotels selbst werden Teil der Reise." },
      { id: "ausgewogen", label: "Ausgewogen", text: "Genug besondere Orte, ohne ständig weiterzumüssen." },
      { id: "entdecken", label: "Mehr entdecken", text: "Mehr Eindrücke, aber weniger Zeit zum Genießen." },
    ],
  },
  {
    who: "Für Lia & Elias",
    views: [
      { id: "entspannt", label: "Maximal entspannt", text: "Mehr freie Zeit und weniger unterschiedliche Abenteuer." },
      { id: "ausgewogen", label: "Ausgewogen", text: "Wüste, Berge und Meer." },
      { id: "entdecken", label: "Mehr entdecken", text: "Die größte Abwechslung." },
    ],
  },
  {
    who: "Für Lumi · 2 Jahre",
    views: [
      { id: "entspannt", label: "Maximal entspannt", text: "Der ruhigste Rhythmus." },
      { id: "ausgewogen", label: "Ausgewogen", text: "Gut machbar mit bewussten Pausen." },
      { id: "entdecken", label: "Mehr entdecken", text: "Mehr Transfers und häufigere neue Umgebungen." },
    ],
  },
  {
    who: "Für euch als Familie",
    views: [
      { id: "entspannt", label: "Maximal entspannt", text: "Tiefes Ankommen statt Reisemarathon." },
      { id: "ausgewogen", label: "Ausgewogen", text: "Das Beste aus allen Welten – bewusst zusammengestellt." },
      { id: "entdecken", label: "Mehr entdecken", text: "Eine intensive Reise, die viele Eindrücke hinterlässt." },
    ],
  },
];

const THOUGHTS = [
  "Keine unnötigen Ein-Nacht-Stopps",
  "Zeit nach längeren Transfers",
  "Genug freie Tage ohne festes Programm",
  "Erlebnisse für Lia und Elias",
  "Ein Rhythmus, der mit Lumi funktioniert",
  "Besondere Hotels als Teil der Reise",
];

const MEMBERS = [
  { initials: "SA", name: "Sarah" },
  { initials: "MA", name: "Marcel" },
  { initials: "LI", name: "Lia" },
  { initials: "EL", name: "Elias" },
  { initials: "LU", name: "Lumi", note: "2 J." },
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

function RouteTimeline({ stations }: { stations: Station[] }) {
  return (
    <div>
      {stations.map((station, idx) => (
        <div key={station.name}>
          {/* Station */}
          <div className="flex items-center gap-3">
            <div
              className="relative overflow-hidden rounded-lg shrink-0"
              style={{ width: "52px", height: "52px" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={station.photo}
                alt={station.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {station.name}
              </div>
              <div
                style={{ color: "var(--muted)", fontSize: "0.68rem" }}
              >
                {station.nights}{" "}
                {station.nights === 1 ? "Nacht" : "Nächte"}
              </div>
            </div>
          </div>

          {/* Transfer connector */}
          {idx < stations.length - 1 && (
            <div className="flex items-start gap-3 my-2.5 ml-0">
              <div
                className="flex justify-center shrink-0"
                style={{ width: "52px" }}
              >
                <div
                  style={{
                    width: "1px",
                    height: "28px",
                    background: "var(--border)",
                  }}
                />
              </div>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.06em",
                  paddingTop: "6px",
                  opacity: 0.75,
                }}
              >
                {station.transfer}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RouteCard({ route }: { route: Route }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: route.recommended
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Recommended accent bar */}
      {route.recommended && (
        <div
          style={{ height: "3px", background: "var(--accent)", width: "100%" }}
        />
      )}

      {/* Card header */}
      <div
        className="px-7 pt-7 pb-6"
        style={{
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span
              style={{
                color: route.badgeColor,
                fontSize: "0.55rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
              }}
            >
              {route.badge}
            </span>
            <h2
              className="font-light mt-2 mb-1"
              style={{
                color: "var(--foreground)",
                fontSize: "1.4rem",
                letterSpacing: "0.01em",
              }}
            >
              {route.name}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.82rem",
                lineHeight: 1.6,
                maxWidth: "460px",
              }}
            >
              {route.tagline}
            </p>
          </div>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: route.recommended
                ? "1px solid rgba(184,154,94,0.35)"
                : "1px solid var(--border)",
              color: route.recommended ? "var(--accent)" : "var(--muted)",
              fontSize: "0.6rem",
              letterSpacing: "0.12em",
              whiteSpace: "nowrap",
              alignSelf: "flex-start",
              flexShrink: 0,
            }}
          >
            {route.total}
          </div>
        </div>
      </div>

      {/* Card body: route + description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

        {/* Route timeline */}
        <div
          className="p-7"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "20px",
            }}
          >
            Route
          </div>
          <RouteTimeline stations={route.stations} />
        </div>

        {/* Description */}
        <div className="p-7 flex flex-col">
          {/* Feel characteristics */}
          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "14px",
            }}
          >
            Reisegefühl
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {route.feel.map((f) => (
              <span
                key={f}
                style={{
                  fontSize: "0.68rem",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  letterSpacing: "0.04em",
                }}
              >
                {f}
              </span>
            ))}
          </div>

          {/* Recommendation reason (recommended only) */}
          {route.recommended && route.reason && (
            <div
              className="p-4 rounded-xl mb-5"
              style={{
                background: "rgba(184,154,94,0.07)",
                border: "1px solid rgba(184,154,94,0.2)",
              }}
            >
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "7px",
                }}
              >
                Warum diese Route zu euch passt
              </div>
              <p
                style={{
                  color: "var(--foreground)",
                  fontSize: "0.75rem",
                  lineHeight: 1.7,
                  fontStyle: "italic",
                }}
              >
                {route.reason}
              </p>
            </div>
          )}

          {/* Family hint */}
          <div
            className="mt-auto pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.55rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Für eure Familie
            </div>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.78rem",
                lineHeight: 1.6,
              }}
            >
              {route.familyHint}
            </p>
          </div>
        </div>
      </div>

      {/* Card footer with CTA */}
      <div
        className="px-7 py-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          style={{
            background: route.recommended ? "var(--foreground)" : "transparent",
            color: route.recommended ? "var(--surface)" : "var(--muted)",
            border: route.recommended
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
          Diese Reise weiterdenken
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
          Route anpassen
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OmanPlanPage() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-5 md:px-8 pb-24">

        {/* ── 1. Editorial Header ── */}
        <div className="pt-10 pb-10">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 mb-7"
            style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em" }}
          >
            <Link href="/plan" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Neue Reise
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <span style={{ color: "var(--foreground)" }}>Oman</span>
          </div>

          {/* Eyebrow */}
          <div
            style={{
              color: "var(--accent)",
              fontSize: "0.55rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              marginBottom: "14px",
            }}
          >
            Eure Reise nimmt Form an
          </div>

          {/* Headline */}
          <h1
            className="font-light leading-tight mb-3"
            style={{
              color: "var(--foreground)",
              fontSize: "clamp(1.8rem, 4.5vw, 2.8rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Drei Arten, Oman zu erleben.
          </h1>
          <p
            className="leading-relaxed mb-8 max-w-lg"
            style={{ color: "var(--muted)", fontSize: "0.9rem" }}
          >
            Gleicher Ort. Unterschiedlicher Rhythmus. Welche Reise fühlt sich nach euch an?
          </p>

          {/* Meta + family */}
          <div className="flex items-center gap-6 flex-wrap">
            <span
              style={{ color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.06em" }}
            >
              Oktober 2028 · etwa 14 Tage · 5 Reisende
            </span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {MEMBERS.map((m) => (
                  <div
                    key={m.initials}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      fontSize: "0.52rem",
                      letterSpacing: "0.04em",
                      color: "var(--foreground)",
                    }}
                  >
                    {m.initials}
                  </div>
                ))}
              </div>
              <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.06em" }}>
                inkl. Lumi · 2 J.
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Persönlicher Hinweis ── */}
        <section className="mb-12">
          <div
            className="rounded-xl p-7"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p
              className="leading-relaxed mb-4"
              style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 300 }}
            >
              Wir haben bei allen drei Varianten darauf geachtet, dass ihr außergewöhnliche
              Orte erlebt, ohne die Reise zu überladen.
            </p>
            <p
              style={{
                color: "var(--accent)",
                fontSize: "1.05rem",
                fontWeight: 300,
                fontStyle: "italic",
                lineHeight: 1.5,
                letterSpacing: "0.01em",
              }}
            >
              „Der größte Unterschied ist nicht, was ihr seht – sondern wie sich die Reise anfühlt."
            </p>
          </div>
        </section>

        {/* ── 3. Drei Routenvarianten ── */}
        <section className="mb-14">
          <SectionLabel>Eure drei Reiseentwürfe</SectionLabel>
          <div className="space-y-6">
            {ROUTES.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        </section>

        {/* ── 4. Wie fühlen sich die drei Reisen für euch an? ── */}
        <section className="mb-14">
          <SectionLabel>Wie fühlen sich die drei Reisen für euch an?</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PERSPECTIVES.map((p) => (
              <div
                key={p.who}
                className="rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="text-sm font-medium mb-5"
                  style={{ color: "var(--foreground)" }}
                >
                  {p.who}
                </div>
                <div className="space-y-4">
                  {p.views.map((v) => (
                    <div key={v.id}>
                      <div
                        style={{
                          color: v.id === "ausgewogen" ? "var(--accent)" : "var(--muted)",
                          fontSize: "0.55rem",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          marginBottom: "3px",
                        }}
                      >
                        {v.label}
                      </div>
                      <p
                        style={{
                          color: "var(--foreground)",
                          fontSize: "0.78rem",
                          fontWeight: v.id === "ausgewogen" ? 400 : 300,
                          lineHeight: 1.5,
                        }}
                      >
                        {v.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Was wir mitgedacht haben ── */}
        <section className="mb-14">
          <SectionLabel>Bei allen drei Routen mitgedacht</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {THOUGHTS.map((thought) => (
              <div
                key={thought}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    flexShrink: 0,
                    marginTop: "7px",
                  }}
                />
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.78rem",
                    lineHeight: 1.5,
                  }}
                >
                  {thought}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. Abschluss ── */}
        <section>
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.55rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Die Route ist noch nicht die Reise.
            </div>
            <h2
              className="font-light mb-3 max-w-lg"
              style={{
                color: "var(--foreground)",
                fontSize: "1.3rem",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              Als Nächstes finden wir die Orte und Hotels, die aus dieser Linie auf der Karte eure Reise machen.
            </h2>
            <p
              className="leading-relaxed mb-8 max-w-md"
              style={{ color: "var(--muted)", fontSize: "0.78rem" }}
            >
              Hotels, die zu euch passen. Erlebnisse, die Lia und Elias in Erinnerung bleiben. Und ein Rhythmus, der auch mit Lumi funktioniert.
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
                Oman in Balance weiterentwickeln
                <ArrowRight size={11} strokeWidth={1.5} />
              </Link>
              <Link
                href="/plan"
                style={{
                  color: "var(--muted)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
              >
                Andere Reiseidee wählen
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
