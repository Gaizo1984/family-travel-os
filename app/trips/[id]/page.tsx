import Link from "next/link";
import { notFound } from "next/navigation";
import { Plane, BedDouble, Compass, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateDE, getTripDuration } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";
const H_BORDER = "rgba(240,235,227,0.1)";

const TRIP_IMAGES: Record<string, string> = {
  "costa-rica-2026":
    "https://images.unsplash.com/photo-1611222566512-cb8dd8e689e5?auto=format&fit=crop&w=1920&q=80",
  "indonesien-2028":
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80",
  "japan-2025":
    "https://images.unsplash.com/photo-1757220306353-2282322ac464?auto=format&fit=crop&w=1920&q=80",
  "sardinien-2024":
    "https://images.unsplash.com/photo-1780581800373-4fd4961743cd?auto=format&fit=crop&w=1920&q=80",
};

const STAGE_IMAGES = [
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1476673160081-cf065607f449?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1592364395653-83e648b20cc2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
];

const NEXT_STEPS = [
  "Flüge buchen und Reiseversicherung abschließen",
  "Hotels und Unterkünfte finalisieren",
  "Aktivitäten und Ausflüge planen",
  "Dokumente und Visa beantragen",
  "Packliste erstellen",
];

type PersonRow = { id: string; name: string; initials: string; color: string }

type StageRow = {
  id: string
  title: string
  location: string | null
  nights: number | null
  start_date: string | null
  end_date: string | null
  accommodation: string | null
  sort_order: number
}

type TripDetail = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  status: string
  start_date: string | null
  end_date: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: StageRow[]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-medium mb-5"
      style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
    >
      {children}
    </h2>
  );
}

function StageCard({ stage, idx, slug }: { stage: StageRow; idx: number; slug: string }) {
  const imgUrl = STAGE_IMAGES[idx % STAGE_IMAGES.length];
  return (
    <Link
      href={`/trips/${slug}/stages/${stage.id}`}
      className="group relative shrink-0 overflow-hidden rounded-xl block"
      style={{ width: 210, height: 285 }}
    >
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={stage.title} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.38) 55%, transparent 100%)" }}
      />
      <div className="absolute top-4 left-4">
        <span style={{ color: "rgba(240,235,227,0.4)", fontSize: "0.6rem", letterSpacing: "0.14em" }}>
          {String(idx + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="absolute top-3 right-3">
        <span style={{ display: "inline-block", fontSize: "0.56rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#C8A96E", background: "rgba(10,9,7,0.55)", padding: "3px 8px", borderRadius: "20px", backdropFilter: "blur(4px)" }}>
          In Planung
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="text-base font-light mb-0.5" style={{ color: H_FG }}>{stage.title}</div>
        <div className="text-xs mb-3" style={{ color: H_MUTED, letterSpacing: "0.08em", fontSize: "0.68rem" }}>
          {stage.nights ?? 0} {stage.nights === 1 ? "Nacht" : "Nächte"}
        </div>
        <div style={{ borderTop: `1px solid ${H_BORDER}`, paddingTop: "10px" }}>
          <div style={{ color: "rgba(240,235,227,0.35)", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
            {stage.start_date ? formatDateDE(stage.start_date) : "—"}
          </div>
          {stage.accommodation && (
            <div className="mt-0.5" style={{ color: H_MUTED, fontSize: "0.62rem" }}>
              {stage.accommodation}
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <ChevronRight size={12} strokeWidth={1.5} style={{ color: H_MUTED }} />
      </div>
    </Link>
  );
}

function OverviewCard({ title, detail, status, statusColor, Icon }: {
  title: string; detail: string; status: string; statusColor: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
}) {
  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
        <span style={{ color: statusColor, fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {status}
        </span>
      </div>
      <div className="text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>{title}</div>
      <div className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{detail}</div>
    </div>
  );
}

function NextStepItem({ text, isLast }: { text: string; isLast: boolean }) {
  return (
    <div className="flex items-start gap-4 py-4" style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div className="w-5 h-5 rounded-full shrink-0 mt-0.5" style={{ border: "1px solid var(--border)", flexShrink: 0 }} />
      <span className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{text}</span>
    </div>
  );
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      trip_members ( persons ( id, name, initials, color ) ),
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!data) notFound();

  const trip = data as unknown as TripDetail;
  const members   = trip.trip_members.flatMap(tm => tm.persons ? [tm.persons] : []);
  const stages    = [...trip.stages].sort((a, b) => a.sort_order - b.sort_order);
  const duration  = trip.start_date && trip.end_date
    ? getTripDuration(trip.start_date, trip.end_date) : 0;
  const heroImage = TRIP_IMAGES[trip.slug]
    ?? "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80";

  const statusLabel = trip.status === "active" ? "Aktive Reise"
    : trip.status === "completed" ? "Erlebt"
    : "In Planung";

  return (
    <div className="flex-1 flex flex-col">

      {/* ── CINEMATIC HERO ── */}
      <div className="relative" style={{ height: 450 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt={trip.title} className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.62) 45%, rgba(10,9,7,0.18) 100%)" }}
        />

        <div className="absolute top-6 left-7">
          <Link
            href="/trips"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
            style={{ color: "rgba(240,235,227,0.5)", fontSize: "0.78rem", letterSpacing: "0.04em" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            Alle Reisen
          </Link>
        </div>

        <div className="absolute top-5 right-7">
          <span style={{ fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#C8A96E", background: "rgba(184,154,94,0.14)", border: "1px solid rgba(184,154,94,0.2)", padding: "5px 12px", borderRadius: "20px" }}>
            {statusLabel}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-7 md:px-10 pb-8 md:pb-10">
          <h1
            className="text-4xl md:text-5xl font-light leading-tight mb-2"
            style={{ color: H_FG, letterSpacing: "-0.01em" }}
          >
            {trip.title}
          </h1>
          <p className="text-sm font-light mb-6" style={{ color: H_MUTED, letterSpacing: "0.04em" }}>
            {trip.start_date ? formatDateDE(trip.start_date) : "—"}
            {trip.end_date ? ` – ${formatDateDE(trip.end_date)}` : ""}
            {duration ? ` · ${duration} Tage` : ""}
          </p>

          <div className="mb-5" style={{ height: "1px", background: H_BORDER }} />

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(240,235,227,0.1)", color: H_FG, border: "1px solid rgba(240,235,227,0.2)", backdropFilter: "blur(6px)", fontSize: "0.6rem", letterSpacing: "0.04em" }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <span style={{ color: H_MUTED, fontSize: "0.68rem", letterSpacing: "0.08em" }}>
              {members.length} Reisende
            </span>
          </div>
        </div>
      </div>

      {/* ── LIGHT CONTENT ── */}
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 space-y-14">

          {stages.length > 0 && (
            <section>
              <SectionLabel>Etappen · {stages.length} {stages.length === 1 ? "Destination" : "Destinationen"}</SectionLabel>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex gap-4 pb-3" style={{ width: "max-content" }}>
                  {stages.map((stage, idx) => (
                    <StageCard key={stage.id} stage={stage} idx={idx} slug={trip.slug} />
                  ))}
                </div>
              </div>
            </section>
          )}

          <section>
            <SectionLabel>Reiseübersicht</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <OverviewCard title="Flüge" detail="Noch keine Flüge gebucht" status="Offen" statusColor="#B5624A" Icon={Plane} />
              <OverviewCard title="Hotels" detail="Unterkünfte noch offen" status="In Planung" statusColor="#B89A5E" Icon={BedDouble} />
              <OverviewCard title="Aktivitäten" detail="Ideen sammeln" status="In Planung" statusColor="#B89A5E" Icon={Compass} />
              <OverviewCard title="Dokumente" detail="Visum, Versicherung, Buchungen" status="Offen" statusColor="#B5624A" Icon={FileText} />
            </div>
          </section>

          <section>
            <SectionLabel>Nächste Schritte</SectionLabel>
            <div className="rounded-xl px-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {NEXT_STEPS.map((step, idx) => (
                <NextStepItem key={idx} text={step} isLast={idx === NEXT_STEPS.length - 1} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
