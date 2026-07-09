import Link from "next/link";
import {
  Building2,
  Mountain,
  Waves,
  Landmark,
  Compass,
  Clock,
  Timer,
  Users,
  BookOpen,
  Map,
  Globe,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// ── Types & data ──────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  age?: string;
  description: string;
  tags: string[];
  image: string;
  lumiHints?: string[];
}

const FAMILY: FamilyMember[] = [
  {
    id: "marcel",
    name: "Marcel",
    role: "Der Entdecker",
    description:
      "Immer auf der Suche nach dem besonderen Ort – jenem Platz, der sich anders anfühlt als alles andere. Liebt es zu recherchieren, zu planen und dann loszulassen.",
    tags: ["Luxushotels", "Besondere Orte", "Gutes Essen"],
    image:
      "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "sarah",
    name: "Sarah",
    role: "Die Genießerin",
    description:
      "Reisen bedeutet für Sarah: ankommen, durchatmen, innehalten. Ein schönes Frühstück. Ein Pool. Ein Hotel, das man nie vergessen möchte.",
    tags: ["Design", "Entspannung", "Besondere Hotels"],
    image:
      "https://images.unsplash.com/photo-1532347922424-c652d9b7208e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "lia",
    name: "Lia",
    role: "Die Abenteurerin",
    description:
      "Raus in die Natur, höher hinauf, weiter hinein. Lia ist am glücklichsten, wenn sie klettern, reiten oder durch den Dschungel streifen kann.",
    tags: ["Pferde", "Natur", "Klettern"],
    image:
      "https://images.unsplash.com/photo-1478877144596-fb7ee516e462?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "elias",
    name: "Elias",
    role: "Der Aktive",
    description:
      "Überall dabei, immer in Bewegung. Elias saugt alles auf – neue Länder, andere Kulturen, unbekannte Gerichte. Entdecken ist seine Sprache.",
    tags: ["Abenteuer", "Sport", "Entdecken"],
    image:
      "https://images.unsplash.com/photo-1502933691298-84fc14542831?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "lumi",
    name: "Lumi",
    role: "Die Kleinste",
    age: "2 Jahre",
    description:
      "Strahlt. Liebt Strand, Tiere und alles Neue. Braucht Zeit, Nähe und einen entspannten Reiserhythmus.",
    tags: ["Strand", "Tiere", "Entdecken"],
    image:
      "https://images.unsplash.com/photo-1475503572774-15a45e5d60b9?auto=format&fit=crop&w=900&q=80",
    lumiHints: ["Kurze Transfers", "Flexibler Rhythmus", "Sichere Umgebung", "Zeit für Pausen"],
  },
];

const TRAVEL_PREFS = [
  {
    Icon: Building2,
    title: "Außergewöhnliche Hotels",
    desc: "Orte, die man nicht vergisst. Architektur, die atmet. Räume, die eine Geschichte erzählen.",
  },
  {
    Icon: Mountain,
    title: "Natur & besondere Landschaften",
    desc: "Reisfelder, Vulkane, Dschungel und Küsten. Je ursprünglicher, desto besser.",
  },
  {
    Icon: Waves,
    title: "Strand & Wasser",
    desc: "Türkises Wasser, ruhige Buchten und Strände, die noch niemand kennt.",
  },
  {
    Icon: Landmark,
    title: "Kultur in der richtigen Dosis",
    desc: "Geschichte spüren, nicht abarbeiten. Lieber einen Tempel tief erlebt als zehn oberflächlich.",
  },
  {
    Icon: Compass,
    title: "Aktivitäten für die Kinder",
    desc: "Surfen, Schnorcheln, Reiten – Erlebnisse, die Lia und Elias noch Jahre danach erzählen.",
  },
  {
    Icon: Clock,
    title: "Genug Zeit zum Genießen",
    desc: "Kein Tagesprogramm mit sieben Punkten. Morgens Frühstück. Dann schauen, was kommt.",
  },
];

const PRIORITIES = [
  {
    Icon: Building2,
    title: "Hotels",
    desc: "Besondere Architektur, großzügige Zimmer und Orte mit Charakter. Das Hotel ist für uns kein Ort zum Schlafen – es ist Teil der Reise.",
  },
  {
    Icon: Timer,
    title: "Reisetempo",
    desc: "Lieber weniger Stationen und dafür genug Zeit vor Ort. Immer Spielraum für das Unerwartete – und Flexibilität für Tage, die einfach langsamer sein dürfen.",
  },
  {
    Icon: Users,
    title: "Als Familie",
    desc: "Erlebnisse für Lia und Elias, genug Freiheit für die Erwachsenen – und ein Reisetempo, das auch mit Lumi als Zweijähriger funktioniert, ohne dass sich die Reise wie ein Kinderprogramm anfühlt.",
  },
  {
    Icon: BookOpen,
    title: "Erinnerungen",
    desc: "Nicht möglichst viele Orte sammeln, sondern Reisen schaffen, über die wir Jahre später noch sprechen.",
  },
];

const HISTORY = [
  { year: "2024", destination: "Sardinien", next: false },
  { year: "2025", destination: "Japan", next: false },
  { year: "2026", destination: "Costa Rica", next: false },
  { year: "2028", destination: "Indonesien", next: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: "0.6rem",
        letterSpacing: "0.07em",
        color: "var(--muted)",
        background: "var(--background)",
        padding: "3px 10px",
        borderRadius: "20px",
        border: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ParentCard({ member }: { member: FamilyMember }) {
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: "220px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.image}
          alt={member.name}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 55%, rgba(243,239,232,0.35) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <h3
            className="text-lg font-light"
            style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
          >
            {member.name}
          </h3>
        </div>
        <div
          className="mb-4"
          style={{
            color: "var(--accent)",
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {member.role}
        </div>
        <p
          className="leading-relaxed mb-5"
          style={{ color: "var(--muted)", fontSize: "0.78rem" }}
        >
          {member.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {member.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KidCard({ member }: { member: FamilyMember }) {
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ height: "170px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.image}
          alt={member.name}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 55%, rgba(243,239,232,0.35) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <h3
            className="text-base font-light"
            style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
          >
            {member.name}
          </h3>
          {member.age && (
            <span
              style={{
                color: "var(--muted)",
                fontSize: "0.6rem",
                letterSpacing: "0.08em",
              }}
            >
              {member.age}
            </span>
          )}
        </div>
        <div
          className="mb-3"
          style={{
            color: "var(--accent)",
            fontSize: "0.58rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {member.role}
        </div>
        <p
          className="leading-relaxed mb-4"
          style={{ color: "var(--muted)", fontSize: "0.74rem" }}
        >
          {member.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {member.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>

        {/* Lumi – travel notes */}
        {member.lumiHints && (
          <div
            className="mt-4 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="mb-3"
              style={{
                color: "var(--accent)",
                fontSize: "0.57rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Reisen mit Lumi
            </div>
            <p
              className="leading-relaxed mb-3"
              style={{
                color: "var(--muted)",
                fontSize: "0.72rem",
                fontStyle: "italic",
              }}
            >
              „Braucht Zeit, Nähe und einen entspannten Reiserhythmus."
            </p>
            <div className="flex flex-wrap gap-1.5">
              {member.lumiHints.map((hint) => (
                <Tag key={hint} label={hint} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FamilyPage() {
  const parents = FAMILY.filter((m) => m.id === "marcel" || m.id === "sarah");
  const kids = FAMILY.filter((m) => m.id === "lia" || m.id === "elias" || m.id === "lumi");

  const supabase = await createClient();
  const { data: persons } = await supabase.from("persons").select("id, name");
  const personIdByName: Record<string, string> = Object.fromEntries(
    (persons ?? []).map((p) => [p.name, p.id])
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-16 max-w-4xl w-full mx-auto">

        {/* ── Header ── */}
        <header className="flex items-start justify-between pt-9 pb-9">
          <div>
            <h1
              className="text-2xl font-light mb-1"
              style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
            >
              Unsere Familie
            </h1>
            <p
              className="text-xs"
              style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}
            >
              Fünf Menschen. Fünf Arten zu reisen.
            </p>
          </div>
          <button className="btn-neue-reise">Familie bearbeiten</button>
        </header>

        {/* ── Familienporträts ── */}
        <section className="mb-14">
          <div
            className="mb-6"
            style={{
              color: "var(--muted)",
              fontSize: "0.6rem",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
            }}
          >
            Familienporträts
          </div>

          {/* Parents — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {parents.map((m) => {
              const personId = personIdByName[m.name];
              const card = <ParentCard key={m.id} member={m} />;
              return personId ? (
                <Link key={m.id} href={`/family/${personId}`} style={{ textDecoration: "none" }}>
                  {card}
                </Link>
              ) : card;
            })}
          </div>

          {/* Kids — 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kids.map((m) => {
              const personId = personIdByName[m.name];
              const card = <KidCard key={m.id} member={m} />;
              return personId ? (
                <Link key={m.id} href={`/family/${personId}`} style={{ textDecoration: "none" }}>
                  {card}
                </Link>
              ) : card;
            })}
          </div>
        </section>

        {/* ── So reisen wir ── */}
        <section className="mb-14">
          <div className="mb-2">
            <h2
              className="text-xl font-light"
              style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
            >
              So reisen wir
            </h2>
          </div>
          <p
            className="text-xs mb-7"
            style={{ color: "var(--muted)", fontSize: "0.72rem", letterSpacing: "0.04em" }}
          >
            Was uns auf Reisen wichtig ist – und was eine Reise zu unserer macht.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {TRAVEL_PREFS.map(({ Icon, title, desc }) => (
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
                <div
                  className="text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  {title}
                </div>
                <p
                  className="leading-relaxed"
                  style={{ color: "var(--muted)", fontSize: "0.72rem" }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Was uns wichtig ist ── */}
        <section className="mb-14">
          <h2
            className="text-xl font-light mb-7"
            style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
          >
            Was uns wichtig ist
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRIORITIES.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {title}
                  </h3>
                </div>
                <p
                  className="leading-relaxed"
                  style={{ color: "var(--muted)", fontSize: "0.78rem" }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Gemeinsam unterwegs ── */}
        <section className="mb-14">
          <h2
            className="text-xl font-light mb-7"
            style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
          >
            Gemeinsam unterwegs
          </h2>

          {/* Stats */}
          <div className="flex gap-12 md:gap-20 mb-10">
            {[
              { Icon: Map, value: 3, label: "Reisen" },
              { Icon: Globe, value: 6, label: "Länder" },
              { Icon: CalendarDays, value: 30, label: "Reisetage" },
            ].map(({ Icon, value, label }) => (
              <div key={label} className="flex items-center gap-4">
                <Icon
                  size={13}
                  strokeWidth={1.4}
                  style={{ color: "var(--accent)", flexShrink: 0 }}
                />
                <div>
                  <div
                    className="text-4xl font-light leading-none mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div
            className="rounded-xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="mb-7"
              style={{
                color: "var(--muted)",
                fontSize: "0.6rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Reisehistorie
            </div>

            <div className="flex items-start">
              {HISTORY.flatMap((h, idx) => [
                <div
                  key={h.destination}
                  className="flex flex-col items-center"
                  style={{ minWidth: "80px" }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mb-3"
                    style={{
                      background: h.next ? "var(--accent)" : "transparent",
                      border: `1.5px solid ${h.next ? "var(--accent)" : "var(--muted)"}`,
                      boxShadow: h.next
                        ? "0 0 0 4px rgba(184,154,94,0.12)"
                        : "none",
                    }}
                  />
                  <div
                    className="text-sm font-light text-center"
                    style={{ color: h.next ? "var(--foreground)" : "var(--muted)" }}
                  >
                    {h.destination}
                  </div>
                  <div
                    className="text-center mt-1"
                    style={{
                      color: h.next ? "var(--accent)" : "var(--muted)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {h.next ? `${h.year} · Nächste Reise` : h.year}
                  </div>
                </div>,
                idx < HISTORY.length - 1 ? (
                  <div
                    key={`sep-${idx}`}
                    className="flex-1"
                    style={{
                      height: "1px",
                      background: "var(--border)",
                      marginTop: "5px",
                      minWidth: "24px",
                    }}
                  />
                ) : null,
              ])}
            </div>
          </div>
        </section>

        {/* ── Persönliche Notiz ── */}
        <section>
          <div
            className="py-14"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="mb-9"
              style={{
                color: "var(--muted)",
                fontSize: "0.6rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
              }}
            >
              Was eine perfekte Reise für uns bedeutet
            </div>
            <blockquote
              className="font-light leading-relaxed"
              style={{
                color: "var(--foreground)",
                fontSize: "1.45rem",
                letterSpacing: "0.01em",
                maxWidth: "600px",
                lineHeight: 1.55,
              }}
            >
              „Ein besonderer Ort. Zeit füreinander. Etwas, das wir noch nie gesehen haben. Und am Ende Geschichten, die nur uns gehören."
            </blockquote>
            <div className="pt-8">
              <Link
                href="/concierge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  color: "var(--muted)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "2px",
                }}
              >
                Reiseentscheidungen mit dem Concierge klären
                <ArrowRight size={10} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
