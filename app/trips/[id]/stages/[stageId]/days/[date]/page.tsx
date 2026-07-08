import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Clock,
  Car,
  CalendarDays,
  CloudRain,
  BookOpen,
  MapPin,
} from "lucide-react";
import { getTripById } from "@/lib/demo-data";

const H_FG = "#F0EBE3";
const H_MUTED = "#A89880";

// Verified Unsplash photos
const PHOTO_EXPLORE =
  "https://images.unsplash.com/photo-1590324571844-dd64c19c2ded?auto=format&fit=crop&w=1200&q=80";
const PHOTO_SUNSET =
  "https://images.unsplash.com/photo-1616484173745-07f25fd0547f?auto=format&fit=crop&w=1200&q=80";

// ── Demo data (hardcoded for Sumba · 24. Juli 2028) ────────────────────────

const DAY = {
  date: "24. Juli 2028",
  weekday: "Mittwoch",
  tagline: "Heute wird entdeckt.",
  intro:
    "Ein ruhiger Morgen am Meer, Sumba am Nachmittag und genug Zeit, um einfach hier zu sein.",
  weather: "29 °C · sonnig",
  sunset: "18:12 Uhr",
  mood: "Entdecken & Genießen",
  tempo: "Entspannt",
  dayNumber: 3,
  totalDays: 4,
};

type ItemSize = "compact" | "large";
type ItemStatus = "flexibel" | "zu-planen" | "reservierung-offen" | "fix";

interface TimelineItem {
  time: string;
  title: string;
  desc: string;
  meta?: string;
  size: ItemSize;
  status?: ItemStatus;
  photo?: string;
}

const TIMELINE: TimelineItem[] = [
  {
    time: "07:30",
    title: "Langsam ankommen",
    desc: "Frühstück mit Blick aufs Meer.",
    meta: "Nihi Sumba · ca. 1,5 Stunden",
    size: "compact",
    status: "flexibel",
  },
  {
    time: "09:30",
    title: "Zeit am Meer",
    desc: "Strand, Pool und kein fester Plan.",
    meta: "Ideal für die ganze Familie",
    size: "compact",
    status: "flexibel",
  },
  {
    time: "12:30",
    title: "Lunch im Resort",
    desc: "Gemeinsames Mittagessen. Danach Zeit für Lumis Mittagsschlaf.",
    meta: "Nihi Sumba · Flexibel",
    size: "compact",
    status: "flexibel",
  },
  {
    time: "14:30",
    title: "Sumba entdecken",
    desc: "Private Tour mit Fahrer durch Dörfer, Landschaft und Aussichtspunkte.",
    meta: "ca. 3 Stunden · Dorf · Landschaft · Aussichtspunkt",
    size: "large",
    status: "zu-planen",
    photo: PHOTO_EXPLORE,
  },
  {
    time: "18:00",
    title: "Zurück zum Sonnenuntergang",
    desc: "Ankommen, duschen, nichts verpassen.",
    size: "large",
    status: "flexibel",
    photo: PHOTO_SUNSET,
  },
  {
    time: "19:30",
    title: "Dinner",
    desc: "Restaurant im Resort.",
    meta: "Reservierung noch offen",
    size: "compact",
    status: "reservierung-offen",
  },
];

const STATUS_CFG: Record<ItemStatus, { label: string; color: string; border: string }> = {
  flexibel: { label: "Flexibel", color: "var(--muted)", border: "rgba(124,112,99,0.25)" },
  "zu-planen": { label: "Noch zu planen", color: "#B5624A", border: "rgba(181,98,74,0.3)" },
  "reservierung-offen": { label: "Reservierung offen", color: "#B5624A", border: "rgba(181,98,74,0.3)" },
  fix: { label: "Bestätigt", color: "var(--accent)", border: "rgba(184,154,94,0.35)" },
};

const INSIGHTS = [
  {
    title: "Guter Rhythmus",
    desc: "Der längere Ausflug startet erst nach Lumis Mittagsschlaf. Der Tag hält genau diesen Spielraum frei.",
  },
  {
    title: "Genug Luft",
    desc: "Zwischen Rückkehr und Dinner bleiben 90 Minuten ohne Programm. Kein Hetzen, kein Stress.",
  },
  {
    title: "Für alle",
    desc: "Die Tour verbindet Landschaft für Sarah und Marcel mit genug Bewegung für Lia und Elias.",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--muted)",
        fontSize: "0.6rem",
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: "0.55rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        padding: "2px 9px",
        borderRadius: "20px",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

function CompactItem({ item }: { item: TimelineItem }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>
          {item.title}
        </h3>
        {item.status && <StatusBadge status={item.status} />}
      </div>
      <p
        className="leading-relaxed"
        style={{ color: "var(--muted)", fontSize: "0.75rem" }}
      >
        {item.desc}
      </p>
      {item.meta && (
        <p
          className="mt-1.5"
          style={{
            color: "var(--muted)",
            fontSize: "0.62rem",
            letterSpacing: "0.04em",
            opacity: 0.7,
          }}
        >
          {item.meta}
        </p>
      )}
    </div>
  );
}

function LargeItem({ item }: { item: TimelineItem }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {item.photo && (
        <div className="relative" style={{ height: "210px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.photo}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(10,9,7,0.88) 0%, rgba(10,9,7,0.22) 55%, transparent 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-4 flex items-end justify-between gap-3">
            <h3
              className="text-xl font-light leading-tight"
              style={{ color: H_FG, letterSpacing: "0.01em" }}
            >
              {item.title}
            </h3>
            {item.status && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "0.55rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: H_MUTED,
                  background: "rgba(10,9,7,0.55)",
                  border: "1px solid rgba(240,235,227,0.12)",
                  padding: "3px 9px",
                  borderRadius: "20px",
                  backdropFilter: "blur(4px)",
                }}
              >
                {STATUS_CFG[item.status].label}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="p-4" style={{ background: "var(--surface)" }}>
        <p
          className="leading-relaxed"
          style={{ color: "var(--muted)", fontSize: "0.78rem" }}
        >
          {item.desc}
        </p>
        {item.meta && (
          <p
            className="mt-2"
            style={{
              color: "var(--muted)",
              fontSize: "0.62rem",
              letterSpacing: "0.04em",
              opacity: 0.7,
            }}
          >
            {item.meta}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DayPlanPage({
  params,
}: {
  params: Promise<{ id: string; stageId: string; date: string }>;
}) {
  const { id, stageId, date } = await params;
  const trip = getTripById(id);
  if (!trip) notFound();

  const stage = trip.stages.find((s) => s.id === stageId);
  if (!stage) notFound();

  const prevDate = "2028-07-23";
  const nextDate = "2028-07-25";

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl w-full mx-auto px-5 md:px-8 pb-16">

        {/* ── Header ── */}
        <div className="pt-8 pb-9">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 mb-6"
            style={{
              color: "var(--muted)",
              fontSize: "0.62rem",
              letterSpacing: "0.1em",
            }}
          >
            <Link
              href={`/trips/${id}`}
              style={{ color: "var(--muted)", textDecoration: "none" }}
            >
              {trip.title}
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <Link
              href={`/trips/${id}/stages/${stageId}`}
              style={{ color: "var(--muted)", textDecoration: "none" }}
            >
              {stage.title}
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <span style={{ color: "var(--foreground)" }}>24. Juli</span>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-2xl font-light mb-1"
                style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
              >
                Ein Tag auf Sumba
              </h1>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                }}
              >
                {DAY.weekday}, {DAY.date}
              </p>
            </div>

            {/* Day navigation */}
            <div
              className="flex items-center gap-4"
              style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.06em" }}
            >
              <Link
                href={`/trips/${id}/stages/${stageId}/days/${prevDate}`}
                className="flex items-center gap-1 transition-colors hover:text-foreground"
                style={{ color: "var(--muted)", textDecoration: "none" }}
              >
                <ChevronLeft size={11} strokeWidth={1.5} />
                Vortag
              </Link>
              <span
                style={{
                  padding: "3px 12px",
                  borderRadius: "20px",
                  border: "1px solid var(--border)",
                  fontSize: "0.58rem",
                  letterSpacing: "0.14em",
                  color: "var(--accent)",
                }}
              >
                Tag {DAY.dayNumber} von {DAY.totalDays}
              </span>
              <Link
                href={`/trips/${id}/stages/${stageId}/days/${nextDate}`}
                className="flex items-center gap-1"
                style={{ color: "var(--muted)", textDecoration: "none" }}
              >
                Nächster Tag
                <ChevronRight size={11} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Tagesauftakt ── */}
        <section className="mb-14">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p
              className="text-3xl md:text-4xl font-light mb-4 leading-tight"
              style={{
                color: "var(--foreground)",
                letterSpacing: "-0.01em",
              }}
            >
              {DAY.tagline}
            </p>
            <p
              className="leading-relaxed mb-8 max-w-lg"
              style={{ color: "var(--muted)", fontSize: "0.85rem" }}
            >
              {DAY.intro}
            </p>

            {/* Meta grid */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-5"
              style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}
            >
              {[
                { Icon: Sun, label: "Wetter", value: DAY.weather },
                { Icon: Clock, label: "Sonnenuntergang", value: DAY.sunset },
                { Icon: MapPin, label: "Tagesgefühl", value: DAY.mood },
                { Icon: null, label: "Tempo", value: DAY.tempo },
              ].map(({ Icon, label, value }) => (
                <div key={label}>
                  <div
                    className="flex items-center gap-1.5 mb-1"
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.58rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {Icon && <Icon size={9} strokeWidth={1.5} />}
                    {label}
                  </div>
                  <div
                    className="text-sm font-light"
                    style={{ color: "var(--foreground)" }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Der Tag als visuelle Reise ── */}
        <section className="mb-14">
          <SectionLabel>Der Tag</SectionLabel>

          <div className="relative">
            {/* Vertical connector line */}
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

            <div className="space-y-4">
              {TIMELINE.map((item, idx) => (
                <div key={idx} className="relative flex items-start gap-0">
                  {/* Time column (hidden on mobile, shown sm+) */}
                  <div
                    className="hidden sm:block shrink-0 text-right pr-5"
                    style={{ width: "80px", paddingTop: "14px" }}
                  >
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.68rem",
                        letterSpacing: "0.04em",
                        fontWeight: 300,
                      }}
                    >
                      {item.time}
                    </span>
                  </div>

                  {/* Dot (hidden on mobile) */}
                  <div
                    className="hidden sm:block shrink-0 relative z-10"
                    style={{ paddingTop: "16px", marginRight: "16px" }}
                  >
                    <div
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        background:
                          item.status === "zu-planen" || item.status === "reservierung-offen"
                            ? "transparent"
                            : "var(--accent)",
                        border: `1.5px solid ${
                          item.status === "zu-planen" || item.status === "reservierung-offen"
                            ? "var(--muted)"
                            : "var(--accent)"
                        }`,
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Mobile: time above card */}
                    <div
                      className="sm:hidden mb-1.5"
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.65rem",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {item.time}
                    </div>
                    {item.size === "large" ? (
                      <LargeItem item={item} />
                    ) : (
                      <CompactItem item={item} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Family Travel Intelligence ── */}
        <section className="mb-14">
          <SectionLabel>Für euch mitgedacht</SectionLabel>

          <div className="space-y-3">
            {INSIGHTS.map((insight) => (
              <div
                key={insight.title}
                className="flex gap-5 p-5 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {/* Gold accent bar */}
                <div
                  className="shrink-0 mt-0.5"
                  style={{
                    width: "2px",
                    borderRadius: "2px",
                    background: "var(--accent)",
                    alignSelf: "stretch",
                    minHeight: "40px",
                  }}
                />
                <div>
                  <div
                    className="text-sm font-medium mb-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    {insight.title}
                  </div>
                  <p
                    className="leading-relaxed"
                    style={{ color: "var(--muted)", fontSize: "0.78rem" }}
                  >
                    {insight.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Plan B ── */}
        <section className="mb-14">
          <SectionLabel>Falls der Tag anders kommt</SectionLabel>

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
              <div>
                <p
                  className="leading-relaxed mb-4"
                  style={{ color: "var(--muted)", fontSize: "0.82rem" }}
                >
                  Bei Regen oder müden Kindern bleibt der Nachmittag bewusst flexibel.
                </p>
                <div
                  className="pt-4"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <div
                    className="mb-1.5"
                    style={{
                      color: "var(--accent)",
                      fontSize: "0.58rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    Alternative
                  </div>
                  <p
                    className="font-light"
                    style={{
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                      fontStyle: "italic",
                    }}
                  >
                    „Resort, Spa und früher Sonnenuntergang am Strand."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Praktische Details ── */}
        <section className="mb-14">
          <SectionLabel>Praktische Details</SectionLabel>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            {[
              {
                Icon: Car,
                label: "Transport",
                value: "Privater Fahrer · ca. 45 Minuten je Strecke",
              },
              {
                Icon: MapPin,
                label: "Mitnehmen",
                value: "Sonnenschutz · Wasser · leichte Schuhe",
              },
              {
                Icon: CalendarDays,
                label: "Reservierungen",
                value: "Dinner noch offen",
              },
            ].map(({ Icon, label, value }, idx) => (
              <div
                key={label}
                className="flex items-center gap-4 px-6 py-4"
                style={{
                  background: "var(--surface)",
                  borderBottom: idx < 2 ? "1px solid var(--border)" : "none",
                }}
              >
                <Icon
                  size={13}
                  strokeWidth={1.4}
                  style={{ color: "var(--accent)", flexShrink: 0 }}
                />
                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.58rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      marginBottom: "2px",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    className="font-light"
                    style={{ color: "var(--foreground)", fontSize: "0.78rem" }}
                  >
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tagesnotiz ── */}
        <section>
          <div
            className="rounded-xl p-8 md:p-10 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="mb-3 text-xl font-light"
              style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
            >
              Dieser Tag gehört später euch.
            </div>
            <p
              className="leading-relaxed mb-8 mx-auto"
              style={{
                color: "var(--muted)",
                fontSize: "0.78rem",
                maxWidth: "400px",
              }}
            >
              Nach der Reise können hier Fotos, Erinnerungen und kleine Geschichten dieses Tages leben.
            </p>
            <button className="btn-neue-reise inline-flex items-center gap-2">
              <BookOpen size={11} strokeWidth={1.5} />
              Erinnerung hinzufügen
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
