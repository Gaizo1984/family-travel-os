import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  BedDouble,
  Plane,
  Car,
  Waves,
  Sparkles,
  Compass,
  MapPin,
  CalendarDays,
  Clock,
  CreditCard,
  Wind,
} from "lucide-react";
import { getTripById, formatDateDE, getTripDuration } from "@/lib/demo-data";

const H_FG = "#F0EBE3";
const H_MUTED = "#A89880";
const H_BORDER = "rgba(240,235,227,0.1)";

// Verified hero: horses running on beach — iconic Nihi Sumba
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1678150913309-cbebdf17d804?auto=format&fit=crop&w=1920&q=80";

// ── Static demo content (Sumba / Nihi Sumba) ─────────────────────────────────

const HOTEL = {
  name: "Nihi Sumba",
  tagline: "Eines der außergewöhnlichsten Resorts der Welt",
  description:
    "Nihi Sumba liegt an der Südwestküste der Insel Sumba – weit abseits des Massentourismus. Das Resort wurde mehrfach zum besten Hotel der Welt gewählt: für seinen langen wilden Strand, die eigenen Pferde, das üppige Dschungelgelände und eine Stille, die man in dieser Form nur noch an wenigen Orten findet.",
  room: "Safari Tent · 2 Zimmer · Meerblick",
  status: "Verfügbarkeit prüfen",
};

const ACTIVITIES = [
  {
    Icon: Waves,
    title: "Strand & Pool",
    desc: "Nihi Umbu Beach — langer weißer Sand, unberührtes Wasser, hauseigener Infinitypool mit Blick auf den Indischen Ozean.",
  },
  {
    Icon: Wind,
    title: "Reiten am Strand",
    desc: "Sonnenuntergangsritt mit den Nihi-Pferden entlang des langen Strandes. Eines der stillen Highlights der gesamten Reise.",
  },
  {
    Icon: Sparkles,
    title: "Spa & Erholung",
    desc: "Ana Mandara Spa im Dschungel: Massage, Yoga und Atemübungen. Tage, die sich nach dem Aufwachen noch langsamer anfühlen.",
  },
  {
    Icon: Compass,
    title: "Sumba erkunden",
    desc: "Waingarpu Wasserfall, traditionelle Megalith-Dörfer, lokale Märkte. Sumba zeigt sich abseits des Resorts von seiner ursprünglichsten Seite.",
  },
];

const DAY_IDEAS = [
  {
    day: "Tag 1",
    title: "Ankommen",
    desc: "Landen, durchatmen, ankommen. Erster Blick aufs Meer vom Zimmer. Abendessen im Resort, früh ins Bett.",
  },
  {
    day: "Tag 2",
    title: "Resort genießen",
    desc: "Pferde am Strand beim Sonnenuntergang. Nachmittag am Pool. Dinner unter Sternen auf der Holzterrasse.",
  },
  {
    day: "Tag 3",
    title: "Sumba erkunden",
    desc: "Ausflug in die Insel. Wasserfall, Dörfer. Zurück rechtzeitig zum Sonnenuntergang. Abschiedsabend.",
  },
];

const COSTS = [
  { label: "Hotel – Nihi Sumba (3 Nächte)", value: "—" },
  { label: "Privatflug Bali → Sumba (Hin & Zurück)", value: "—" },
  { label: "Aktivitäten & Ausflüge", value: "—" },
  { label: "Spa & Extras", value: "—" },
];

const OPEN_ITEMS = [
  "Verfügbarkeit Nihi Sumba für 22.–25. Juli 2028 anfragen",
  "Privatflug oder Charter-Transfer von Bali organisieren",
  "Zimmerkategorie wählen: Safari Tent oder privates Baumhaus",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        color: "var(--muted)",
        fontSize: "0.6rem",
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        marginBottom: "20px",
      }}
    >
      {children}
    </h2>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          color: "var(--muted)",
          fontSize: "0.58rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>
      <div className="text-sm font-light" style={{ color: "var(--foreground)" }}>
        {value}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ id: string; stageId: string }>;
}) {
  const { id, stageId } = await params;
  const trip = getTripById(id);
  if (!trip) notFound();

  const stageIdx = trip.stages.findIndex((s) => s.id === stageId);
  if (stageIdx === -1) notFound();
  const stage = trip.stages[stageIdx];
  const duration = getTripDuration(stage.startDate, stage.endDate);

  return (
    <div className="flex-1 flex flex-col">

      {/* ── CINEMATIC HERO ── */}
      <div className="relative shrink-0" style={{ height: 400 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt={stage.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.55) 45%, rgba(10,9,7,0.12) 100%)",
          }}
        />

        {/* Back */}
        <div className="absolute top-6 left-7">
          <Link
            href={`/trips/${id}`}
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
            style={{ color: "rgba(240,235,227,0.5)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            {trip.title}
          </Link>
        </div>

        {/* Stage badge */}
        <div className="absolute top-5 right-7">
          <span
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#C8A96E",
              background: "rgba(184,154,94,0.14)",
              border: "1px solid rgba(184,154,94,0.2)",
              padding: "5px 12px",
              borderRadius: "20px",
            }}
          >
            Etappe {String(stageIdx + 1).padStart(2, "0")} · In Planung
          </span>
        </div>

        {/* Hero content */}
        <div className="absolute inset-x-0 bottom-0 px-7 md:px-10 pb-8 md:pb-10">
          <div
            className="mb-2"
            style={{
              color: H_MUTED,
              fontSize: "0.6rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            <MapPin size={9} strokeWidth={1.5} style={{ display: "inline", marginRight: "5px", verticalAlign: "middle" }} />
            {stage.location}
          </div>
          <h1
            className="text-4xl md:text-5xl font-light leading-tight mb-2"
            style={{ color: H_FG, letterSpacing: "-0.01em" }}
          >
            {stage.title}
          </h1>
          <p
            className="text-sm font-light"
            style={{ color: H_MUTED, letterSpacing: "0.04em" }}
          >
            {formatDateDE(stage.startDate)} – {formatDateDE(stage.endDate)} · {duration} {duration === 1 ? "Nacht" : "Nächte"}
          </p>
        </div>
      </div>

      {/* ── LIGHT CONTENT ── */}
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-4xl mx-auto px-5 md:px-10 py-10 space-y-14">

          {/* ── Etappenübersicht ── */}
          <section>
            <SectionLabel>Etappenübersicht</SectionLabel>
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetaItem label="Ankunft" value={formatDateDE(stage.startDate)} />
                <MetaItem label="Abreise" value={formatDateDE(stage.endDate)} />
                <MetaItem label="Nächte" value={`${duration} Nächte`} />
                <MetaItem label="Hotel" value={stage.accommodation ?? "—"} />
              </div>
              {stage.notes && (
                <>
                  <div className="my-5" style={{ height: "1px", background: "var(--border)" }} />
                  <p className="text-sm font-light leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    {stage.notes}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* ── Hotel ── */}
          <section>
            <SectionLabel>Hotel</SectionLabel>
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <BedDouble size={14} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <h3 className="text-base font-light" style={{ color: "var(--foreground)" }}>
                      {HOTEL.name}
                    </h3>
                  </div>
                  <p
                    style={{
                      color: "var(--accent)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      marginLeft: "26px",
                    }}
                  >
                    {HOTEL.tagline}
                  </p>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    color: "#B5624A",
                    fontSize: "0.58rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(181,98,74,0.25)",
                    padding: "4px 10px",
                    borderRadius: "20px",
                  }}
                >
                  {HOTEL.status}
                </span>
              </div>

              <p
                className="leading-relaxed mb-5"
                style={{ color: "var(--muted)", fontSize: "0.78rem" }}
              >
                {HOTEL.description}
              </p>

              <div style={{ height: "1px", background: "var(--border)", marginBottom: "16px" }} />

              <div className="flex items-center gap-3">
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Zimmer
                </span>
                <span
                  style={{
                    color: "var(--foreground)",
                    fontSize: "0.78rem",
                    fontWeight: 300,
                  }}
                >
                  {HOTEL.room}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--muted)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontStyle: "italic",
                  }}
                >
                  Platzhalter · noch nicht gewählt
                </span>
              </div>
            </div>
          </section>

          {/* ── Transfer ── */}
          <section>
            <SectionLabel>Transfer</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="p-5 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Plane size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  <h3 className="text-sm font-light" style={{ color: "var(--foreground)" }}>
                    Flug Bali → Sumba
                  </h3>
                </div>
                <p className="leading-relaxed mb-3" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  Privatflug oder Chartermaschine ab Ngurah Rai (DPS) nach Tambolaka (TMC). Flugdauer ca. 1,5 Stunden.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    color: "#B5624A",
                    fontSize: "0.58rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(181,98,74,0.25)",
                    padding: "3px 10px",
                    borderRadius: "20px",
                  }}
                >
                  Noch zu organisieren
                </span>
              </div>

              <div
                className="p-5 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Car size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  <h3 className="text-sm font-light" style={{ color: "var(--foreground)" }}>
                    Transfer zum Resort
                  </h3>
                </div>
                <p className="leading-relaxed mb-3" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  Fahrt vom Flughafen Tambolaka zum Nihi Sumba Resort. Ca. 1 Stunde, Hotelshuttle verfügbar.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    color: "var(--accent)",
                    fontSize: "0.58rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(184,154,94,0.3)",
                    padding: "3px 10px",
                    borderRadius: "20px",
                  }}
                >
                  Im Resort buchbar
                </span>
              </div>
            </div>
          </section>

          {/* ── Aktivitäten ── */}
          <section>
            <SectionLabel>Aktivitäten</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ACTIVITIES.map(({ Icon, title, desc }) => (
                <div
                  key={title}
                  className="p-5 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <Icon
                    size={14}
                    strokeWidth={1.4}
                    style={{ color: "var(--accent)", marginBottom: "14px", display: "block" }}
                  />
                  <div className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    {title}
                  </div>
                  <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Tagesideen ── */}
          <section>
            <SectionLabel>Tagesideen</SectionLabel>
            <div className="space-y-3">
              {DAY_IDEAS.map((d, idx) => (
                <div
                  key={d.day}
                  className="flex items-start gap-6 p-5 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="shrink-0 text-right" style={{ minWidth: "56px" }}>
                    <div
                      className="text-2xl font-light leading-none"
                      style={{ color: "var(--border)", letterSpacing: "-0.02em" }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.55rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginTop: "3px",
                      }}
                    >
                      {d.day}
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "20px" }}>
                    <div className="text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                      {d.title}
                    </div>
                    <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                      {d.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Tagesplanung ── */}
          <section>
            <SectionLabel>Tagesplanung</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { date: "2028-07-22", label: "22. Juli", sub: "Ankunft", active: false },
                { date: "2028-07-23", label: "23. Juli", sub: "Resort", active: false },
                { date: "2028-07-24", label: "24. Juli", sub: "Entdecken", active: true },
                { date: "2028-07-25", label: "25. Juli", sub: "Abreise", active: false },
              ].map(({ date, label, sub, active }) => (
                <Link
                  key={date}
                  href={`/trips/${id}/stages/${stageId}/days/${date}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: "var(--surface)",
                      border: active ? `1px solid var(--accent)` : "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="text-sm font-medium mb-0.5"
                      style={{ color: "var(--foreground)" }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        color: active ? "var(--accent)" : "var(--muted)",
                        fontSize: "0.62rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: active ? "8px" : "0",
                      }}
                    >
                      {sub}
                    </div>
                    {active && (
                      <div
                        style={{
                          fontSize: "0.55rem",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "var(--accent)",
                          border: "1px solid rgba(184,154,94,0.3)",
                          padding: "2px 8px",
                          borderRadius: "20px",
                          display: "inline-block",
                        }}
                      >
                        Tagesplan ansehen
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Kostenübersicht ── */}
          <section>
            <SectionLabel>Kostenübersicht</SectionLabel>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {COSTS.map((row, idx) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    background: "var(--surface)",
                    borderBottom: idx < COSTS.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={12} strokeWidth={1.4} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{row.label}</span>
                  </div>
                  <span
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.78rem",
                      letterSpacing: "0.06em",
                      fontStyle: "italic",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}
              >
                <span
                  style={{
                    color: "var(--foreground)",
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                  }}
                >
                  Total Etappe
                </span>
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.78rem",
                    fontStyle: "italic",
                  }}
                >
                  Noch nicht kalkuliert
                </span>
              </div>
            </div>
          </section>

          {/* ── Offene Punkte ── */}
          <section>
            <SectionLabel>Offene Punkte</SectionLabel>
            <div
              className="rounded-xl px-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {OPEN_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 py-4"
                  style={{
                    borderBottom: idx < OPEN_ITEMS.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full shrink-0 mt-0.5"
                    style={{ border: "1px solid var(--border)" }}
                  />
                  <span
                    className="leading-relaxed"
                    style={{ color: "var(--muted)", fontSize: "0.78rem" }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
