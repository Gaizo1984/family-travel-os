import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";

// ── Verified Unsplash photos ──────────────────────────────────────────────────

const P = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const HOTEL_PHOTOS = {
  chedi:    P("photo-1778655504565-5d70f77212cd"), // white building, wooden deck, calm
  mandarin: P("photo-1621293954908-907159247fc8"), // modern hotel lobby, designer furniture
  albustan: P("photo-1769149255670-aa0ad6428dd6"), // resort pool overlooking ocean and beach
};

const STATION_PHOTOS = {
  muscat: P("photo-1763544376715-2de79af4ff0c", 200),
  wueste: P("photo-1707720733106-803bb0808363", 200),
  jabal:  P("photo-1557671760-608f3439ae05",    200),
  meer:   P("photo-1598959626848-a16d4d0b2564", 200),
};

// ── Constants ─────────────────────────────────────────────────────────────────

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";

// ── Data ─────────────────────────────────────────────────────────────────────

const STATIONS = [
  { name: "Muscat",       nights: 4, photo: STATION_PHOTOS.muscat, hotel: null,          active: true  },
  { name: "Wüste",        nights: 2, photo: STATION_PHOTOS.wueste, hotel: null,          active: false },
  { name: "Jabal Akhdar", nights: 3, photo: STATION_PHOTOS.jabal,  hotel: null,          active: false },
  { name: "Meer",         nights: 5, photo: STATION_PHOTOS.meer,   hotel: null,          active: false },
];

const STATIONS_WITH_CHEDI = [
  { name: "Muscat",       nights: 4, photo: STATION_PHOTOS.muscat, hotel: "The Chedi",   active: true  },
  { name: "Wüste",        nights: 2, photo: STATION_PHOTOS.wueste, hotel: null,          active: false },
  { name: "Jabal Akhdar", nights: 3, photo: STATION_PHOTOS.jabal,  hotel: null,          active: false },
  { name: "Meer",         nights: 5, photo: STATION_PHOTOS.meer,   hotel: null,          active: false },
];

interface Hotel {
  id: string;
  name: string;
  location: string;
  character: string;
  desc: string;
  role: string;
  fits: string[];
  familyHint: string;
  photo: string;
  recommended: boolean;
}

const HOTELS: Hotel[] = [
  {
    id: "chedi",
    name: "The Chedi Muscat",
    location: "Muscat, Oman",
    character: "Ruhe von der ersten Minute.",
    desc: "Ein Hotel, das nicht laut beeindrucken muss. Architektur, Weite und ein perfekter Ort, um nach dem Flug wirklich anzukommen.",
    role: "Der ruhige Auftakt.",
    fits: ["Sarah & Marcel", "Ruhiger Reisestart", "Design & Atmosphäre", "Zeit am Pool und Meer"],
    familyHint:
      "Sehr entspannt mit Lumi. Für Lia und Elias eher ein Ort zum Genießen als für großes Programm.",
    photo: HOTEL_PHOTOS.chedi,
    recommended: true,
  },
  {
    id: "mandarin",
    name: "Mandarin Oriental Muscat",
    location: "Muscat, Oman",
    character: "Mehr Stadt. Mehr Leben.",
    desc: "Luxus mit stärkerem Zugang zu Muscat – für eine Reise, die direkt mit Restaurants, Stadt und Entdecken beginnt.",
    role: "Der lebendigere Auftakt.",
    fits: ["Aktiverer Start", "Restaurants & Stadtleben", "Kürzere Wege", "Stadtentdecken"],
    familyHint:
      "Mehr Abwechslung für Lia und Elias, aber weniger Rückzug als im Chedi.",
    photo: HOTEL_PHOTOS.mandarin,
    recommended: false,
  },
  {
    id: "albustan",
    name: "Al Bustan Palace",
    location: "Muscat, Oman",
    character: "Große Bühne.",
    desc: "Ein ikonisches Resort mit viel Raum, Meer und klassischem Grand-Hotel-Gefühl.",
    role: "Der große Resort-Auftakt.",
    fits: ["Resort-Erlebnis", "Großzügige Anlage", "Familienzeit", "Strand"],
    familyHint:
      "Viel Platz und unkompliziert für alle fünf. Weniger intim, dafür sehr komfortabel.",
    photo: HOTEL_PHOTOS.albustan,
    recommended: false,
  },
];

const OPEN_ITEMS = [
  {
    title: "Zimmer für fünf",
    desc: "Brauchen wir zwei Zimmer oder gibt es eine passende Familienlösung?",
  },
  {
    title: "Preis",
    desc: "Ist das Chedi den Aufpreis innerhalb der gesamten Reise wert?",
  },
  {
    title: "Verfügbarkeit",
    desc: "Sind unsere bevorzugten Zimmer im Oktober verfügbar?",
  },
  {
    title: "Stornierung",
    desc: "Wie flexibel können wir buchen?",
  },
];

const PRICE_FACTORS = [
  "Passende Zimmer für fünf Personen",
  "Frühstück oder Halbpension",
  "Steuern und Gebühren",
  "Stornierungsbedingungen",
  "Transfers ab / bis Hotel",
  "Tatsächliche Gesamtkosten",
];

const CHEDI_PERSPECTIVES = [
  {
    who: "Für Sarah & Marcel",
    text: "Architektur und Atmosphäre werden selbst Teil der Reise.",
  },
  {
    who: "Für Lia & Elias",
    text: "Genug Pool und Meer – die großen Abenteuer kommen später.",
  },
  {
    who: "Für Lumi",
    text: "Wenig Programm, ein ruhiger Rhythmus und kein unnötiger Ortswechsel direkt nach dem Flug.",
  },
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

type StationType = { name: string; nights: number; photo: string; hotel: string | null; active: boolean };

function RouteOverview({ stations, showChedi = false }: { stations: StationType[]; showChedi?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stations.map((s, idx) => (
        <div
          key={s.name}
          className="rounded-xl overflow-hidden"
          style={{
            border: s.active
              ? "1px solid var(--accent)"
              : "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Thumbnail */}
          <div className="relative" style={{ height: "70px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.photo}
              alt={s.name}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: "rgba(10,9,7,0.35)" }}
            />
            <div
              className="absolute top-2 left-3"
              style={{
                color: H_FG,
                fontSize: "0.52rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              {String(idx + 1).padStart(2, "0")}
            </div>
          </div>
          {/* Content */}
          <div className="p-3">
            <div
              className="text-sm font-medium mb-0.5"
              style={{ color: "var(--foreground)" }}
            >
              {s.name}
            </div>
            <div
              style={{ color: "var(--muted)", fontSize: "0.62rem" }}
            >
              {s.nights} {s.nights === 1 ? "Nacht" : "Nächte"}
            </div>
            <div
              className="mt-2"
              style={{
                color: s.hotel ? "var(--accent)" : "var(--muted)",
                fontSize: "0.58rem",
                letterSpacing: "0.08em",
                opacity: s.hotel ? 1 : 0.6,
              }}
            >
              {s.hotel ?? "Hotel noch offen"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: hotel.recommended
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Gold accent bar */}
      {hotel.recommended && (
        <div style={{ height: "3px", background: "var(--accent)" }} />
      )}

      {/* Hero photo */}
      <div className="relative" style={{ height: "300px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hotel.photo}
          alt={hotel.name}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,9,7,0.9) 0%, rgba(10,9,7,0.25) 55%, transparent 100%)",
          }}
        />

        {/* Overlay content */}
        <div className="absolute inset-x-0 bottom-0 px-7 pb-6 flex items-end justify-between gap-4">
          <div>
            {hotel.recommended && (
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.52rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Passt besonders gut zu euch
              </div>
            )}
            <h2
              className="font-light mb-1"
              style={{ color: H_FG, fontSize: "1.5rem", letterSpacing: "0.01em" }}
            >
              {hotel.name}
            </h2>
            <div
              style={{
                color: H_MUTED,
                fontSize: "0.62rem",
                letterSpacing: "0.1em",
              }}
            >
              {hotel.location}
            </div>
          </div>

          {/* Role badge */}
          <div
            style={{
              flexShrink: 0,
              padding: "5px 14px",
              borderRadius: "20px",
              background: "rgba(10,9,7,0.55)",
              border: "1px solid rgba(240,235,227,0.14)",
              color: H_MUTED,
              fontSize: "0.55rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              backdropFilter: "blur(4px)",
              whiteSpace: "nowrap",
            }}
          >
            {hotel.role}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

        {/* Left: character + description + fits */}
        <div
          className="p-7"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <p
            className="mb-4 font-light leading-tight"
            style={{ color: "var(--foreground)", fontSize: "1.05rem", fontStyle: "italic" }}
          >
            „{hotel.character}"
          </p>
          <p
            className="leading-relaxed mb-6"
            style={{ color: "var(--muted)", fontSize: "0.8rem" }}
          >
            {hotel.desc}
          </p>

          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Passt besonders zu
          </div>
          <div className="flex flex-wrap gap-2">
            {hotel.fits.map((f) => (
              <span
                key={f}
                style={{
                  fontSize: "0.68rem",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  letterSpacing: "0.02em",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Right: family hint */}
        <div className="p-7 flex flex-col">
          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Mit der Familie
          </div>
          <p
            className="leading-relaxed mb-6"
            style={{ color: "var(--foreground)", fontSize: "0.8rem" }}
          >
            {hotel.familyHint}
          </p>

          <div
            className="mt-auto pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.55rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Rolle in der Reise
            </div>
            <div
              style={{
                color: hotel.recommended ? "var(--accent)" : "var(--foreground)",
                fontSize: "0.85rem",
                fontWeight: 300,
                fontStyle: "italic",
              }}
            >
              {hotel.role}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-7 py-5 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          style={{
            background: hotel.recommended ? "var(--foreground)" : "transparent",
            color: hotel.recommended ? "var(--surface)" : "var(--muted)",
            border: hotel.recommended
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
          {hotel.recommended ? "The Chedi für Muscat wählen" : "Dieses Hotel wählen"}
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
          Mehr ansehen
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OmanHotelsPage() {
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
            <span style={{ color: "var(--foreground)" }}>Hotels</span>
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
            Jetzt wird aus der Route eure Reise
          </div>

          <h1
            className="font-light leading-tight mb-3"
            style={{
              color: "var(--foreground)",
              fontSize: "clamp(1.8rem, 4.5vw, 2.8rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Die richtigen Orte zum Bleiben.
          </h1>
          <p
            className="leading-relaxed mb-6 max-w-xl"
            style={{ color: "var(--muted)", fontSize: "0.9rem" }}
          >
            Nicht das beste Hotel auf dem Papier. Sondern das Hotel, das an dieser Stelle der Reise zu euch passt.
          </p>
          <span
            style={{ color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.06em" }}
          >
            14 Nächte · 4 Stationen · 5 Reisende
          </span>
        </div>

        {/* ── 2. Gesamte Hotelreise ── */}
        <section className="mb-14">
          <SectionLabel>Eure Hotelreise im Überblick</SectionLabel>
          <RouteOverview stations={STATIONS} />
        </section>

        {/* ── 3. Fokus Muscat ── */}
        <section className="mb-10">
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
                marginBottom: "12px",
              }}
            >
              Muscat · 4 Nächte · Station 01
            </div>
            <h2
              className="font-light mb-3"
              style={{
                color: "var(--foreground)",
                fontSize: "1.4rem",
                letterSpacing: "0.01em",
              }}
            >
              Wie soll eure Reise beginnen?
            </h2>
            <p
              className="leading-relaxed max-w-xl"
              style={{ color: "var(--muted)", fontSize: "0.85rem" }}
            >
              Die ersten Tage entscheiden, wie sich eine Reise anfühlt. Nach dem Flug braucht
              ihr keinen Programmmarathon – sondern einen Ort, an dem ihr ankommt.
            </p>
          </div>
        </section>

        {/* ── 4. Drei Hoteloptionen ── */}
        <section className="mb-14">
          <SectionLabel>Drei Hotelcharaktere für Muscat</SectionLabel>
          <div className="space-y-6">
            {HOTELS.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        </section>

        {/* ── 5. Warum wir das Chedi empfehlen ── */}
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
              Warum wir hier zum Chedi tendieren
            </div>
            <p
              className="leading-relaxed mb-8 max-w-xl"
              style={{ color: "var(--foreground)", fontSize: "0.88rem", fontStyle: "italic", fontWeight: 300 }}
            >
              „Eure Reise wird später noch Wüste, Berge und Meer bieten. Deshalb muss Muscat
              nicht schon alles gleichzeitig sein. Das Chedi gibt euch genau das, was am Anfang
              wertvoll ist: ankommen, durchatmen und gemeinsam in die Reise finden."
            </p>

            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}
            >
              {CHEDI_PERSPECTIVES.map((p) => (
                <div key={p.who}>
                  <div
                    style={{
                      color: "var(--accent)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    {p.who}
                  </div>
                  <p
                    style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}
                  >
                    {p.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. Was wir noch prüfen müssen ── */}
        <section className="mb-14">
          <SectionLabel>Was wir noch prüfen müssen</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPEN_ITEMS.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 p-5 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    border: "1px solid var(--muted)",
                    flexShrink: 0,
                    marginTop: "4px",
                  }}
                />
                <div>
                  <div
                    className="text-sm font-medium mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    {item.title}
                  </div>
                  <p
                    style={{ color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.6 }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Preis kommt später ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              opacity: 0.75,
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
              Was kostet diese Entscheidung?
            </div>
            <p
              className="mb-6"
              style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}
            >
              Sobald echte Preise verfügbar sind, vergleichen wir nicht nur den Zimmerpreis.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRICE_FACTORS.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2.5 py-1"
                >
                  <div
                    style={{
                      width: "3px",
                      height: "3px",
                      borderRadius: "50%",
                      background: "var(--muted)",
                      flexShrink: 0,
                      opacity: 0.5,
                    }}
                  />
                  <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. Hotel auswählen ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--accent)" }}
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
              Muscat · Hotel wählen
            </div>
            <h2
              className="font-light mb-6"
              style={{ color: "var(--foreground)", fontSize: "1.1rem" }}
            >
              The Chedi für Muscat – ist das euer Auftakt?
            </h2>
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
                The Chedi für Muscat wählen
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
                Noch offen lassen
              </button>
            </div>
          </div>
        </section>

        {/* ── 9. Blick auf die gesamte Reise ── */}
        <section className="mb-14">
          <div
            style={{
              color: "var(--foreground)",
              fontSize: "1rem",
              fontWeight: 300,
              fontStyle: "italic",
              marginBottom: "20px",
              letterSpacing: "0.01em",
            }}
          >
            „Ein Hotel steht nie allein."
          </div>
          <SectionLabel>So sieht eure Reise jetzt aus</SectionLabel>
          <RouteOverview stations={STATIONS_WITH_CHEDI} showChedi />

          <p
            className="mt-6"
            style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.7 }}
          >
            Als Nächstes suchen wir den Ort, der sich nach der Ruhe von Muscat vollkommen anders anfühlt.
          </p>
        </section>

        {/* ── 10. Abschluss ── */}
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
              Nächste Schritte
            </div>
            <h2
              className="font-light mb-3 max-w-md"
              style={{
                color: "var(--foreground)",
                fontSize: "1.3rem",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              Nach dem ruhigen Auftakt kommt die Wüste.
            </h2>
            <p
              className="leading-relaxed mb-8 max-w-md"
              style={{ color: "var(--muted)", fontSize: "0.78rem" }}
            >
              Zwei Nächte. Stille. Sand bis zum Horizont. Wir suchen einen Ort, der Lia und Elias begeistert – und Lumi trotzdem genug Raum lässt.
            </p>
            <div
              className="flex flex-wrap items-center gap-3 mb-7 pb-7"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <Link
                href="/plan/oman/flights"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 18px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--foreground)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Flüge planen
              </Link>
              <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                Parallel: Flugentscheidung für Oman in Balance
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/plan/oman/budget"
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
                Budget-Überblick ansehen
                <ArrowRight size={11} strokeWidth={1.5} />
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
