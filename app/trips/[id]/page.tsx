import Link from "next/link";
import { notFound } from "next/navigation";
import { Plane, BedDouble, Compass, FileText, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateDE, getTripDuration } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { sortBookingsChronologically, BOOKING_CATEGORIES } from "@/lib/bookings";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import { BookingRowItem } from "./bookings/BookingRowItem";

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

type BookingRow = {
  id: string
  type: BookingType
  title: string
  provider: string | null
  status: BookingStatus
  amount: number | null
  currency: string
  start_datetime: string | null
  stage_id: string | null
  created_at: string
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
  bookings: BookingRow[]
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
  const dateRange = stage.start_date
    ? stage.end_date && stage.end_date !== stage.start_date
      ? `${formatDateDE(stage.start_date)} – ${formatDateDE(stage.end_date)}`
      : formatDateDE(stage.start_date)
    : "—";
  return (
    <div className="group relative shrink-0 overflow-hidden rounded-xl" style={{ width: 210, height: 285 }}>
      <Link href={`/trips/${slug}/stages/${stage.id}`} className="absolute inset-0 block">
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
            {stage.nights !== null ? `${stage.nights} ${stage.nights === 1 ? "Nacht" : "Nächte"}` : "—"}
          </div>
          <div style={{ borderTop: `1px solid ${H_BORDER}`, paddingTop: "10px" }}>
            <div style={{ color: "rgba(240,235,227,0.35)", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
              {dateRange}
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
    </div>
  );
}

function summarizeBookingsByTypes(
  bookings: BookingRow[],
  types: BookingType[],
  pluralLabel: string,
  emptyDetail: string,
  href: string,
): { status: string; statusColor: string; detail: string; href: string } {
  const active = bookings.filter((b) => types.includes(b.type) && b.status !== "cancelled");
  if (active.length === 0) {
    return { status: "Offen", statusColor: "#B5624A", detail: emptyDetail, href };
  }
  const allConfirmed = active.every((b) => b.status === "confirmed");
  const detail = active.length === 1
    ? (active[0].provider ? `${active[0].provider} · ${active[0].title}` : active[0].title)
    : `${active.length} ${pluralLabel} gebucht`;
  return {
    status: allConfirmed ? "Gebucht" : "In Planung",
    statusColor: "#B89A5E",
    detail,
    href,
  };
}

function OverviewCard({ title, detail, status, statusColor, Icon, href }: {
  title: string; detail: string; status: string; statusColor: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
        <span style={{ color: statusColor, fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {status}
        </span>
      </div>
      <div className="text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>{title}</div>
      <div className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{detail}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block p-5 rounded-xl transition-colors" style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
        {content}
      </Link>
    );
  }

  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {content}
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
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order ),
      bookings ( id, type, title, provider, status, amount, currency, start_datetime, stage_id, created_at )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!data) notFound();

  const trip = data as unknown as TripDetail;
  const members   = trip.trip_members.flatMap(tm => tm.persons ? [tm.persons] : []);
  const stages    = [...trip.stages].sort((a, b) => {
    if (a.start_date && b.start_date) {
      const cmp = a.start_date.localeCompare(b.start_date);
      return cmp !== 0 ? cmp : a.sort_order - b.sort_order;
    }
    if (a.start_date && !b.start_date) return -1;
    if (!a.start_date && b.start_date) return 1;
    return a.sort_order - b.sort_order;
  });
  const bookings  = sortBookingsChronologically(trip.bookings);
  const stageTitleById = new Map(stages.map((s) => [s.id, s.title]));

  const { count: documentsCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const flightsSummary = summarizeBookingsByTypes(
    bookings, BOOKING_CATEGORIES.flight.types, "Flüge", BOOKING_CATEGORIES.flight.emptyDetail,
    `/trips/${trip.slug}/bookings/category/flight`,
  );
  const hotelsSummary = summarizeBookingsByTypes(
    bookings, BOOKING_CATEGORIES.accommodation.types, "Unterkünfte", BOOKING_CATEGORIES.accommodation.emptyDetail,
    `/trips/${trip.slug}/bookings/category/accommodation`,
  );
  const activitiesSummary = summarizeBookingsByTypes(
    bookings, BOOKING_CATEGORIES.activity.types, "Aktivitäten", BOOKING_CATEGORIES.activity.emptyDetail,
    `/trips/${trip.slug}/bookings/category/activity`,
  );
  const moreSummary = summarizeBookingsByTypes(
    bookings, BOOKING_CATEGORIES.more.types, "weitere Buchungen", BOOKING_CATEGORIES.more.emptyDetail,
    `/trips/${trip.slug}/bookings/category/more`,
  );
  const documentsSummary = (documentsCount ?? 0) > 0
    ? { status: "Vorhanden", statusColor: "#B89A5E", detail: `${documentsCount} Dokument${documentsCount === 1 ? "" : "e"} hinterlegt` }
    : { status: "Offen", statusColor: "#B5624A", detail: "Noch keine Dokumente hinterlegt" };

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

        <div className="absolute top-5 right-7 flex items-center gap-2">
          <span style={{ fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#C8A96E", background: "rgba(184,154,94,0.14)", border: "1px solid rgba(184,154,94,0.2)", padding: "5px 12px", borderRadius: "20px" }}>
            {statusLabel}
          </span>

          <details className="menu-details relative">
            <summary
              style={{
                cursor: "pointer",
                color: "rgba(240,235,227,0.6)",
                fontSize: "0.9rem",
                lineHeight: 1,
                padding: "6px 10px",
                borderRadius: "20px",
                background: "rgba(10,9,7,0.35)",
                border: "1px solid rgba(240,235,227,0.15)",
              }}
            >
              ⋯
            </summary>
            <div
              className="absolute right-0 mt-2 rounded-lg overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: "170px", zIndex: 30 }}
            >
              <Link
                href={`/trips/${trip.slug}/edit`}
                style={{ display: "block", padding: "11px 16px", color: "var(--foreground)", fontSize: "0.78rem", textDecoration: "none" }}
              >
                Reise bearbeiten
              </Link>
              <Link
                href={`/trips/${trip.slug}/archive`}
                style={{ display: "block", padding: "11px 16px", color: "#B5624A", fontSize: "0.78rem", textDecoration: "none", borderTop: "1px solid var(--border)" }}
              >
                Reise archivieren
              </Link>
            </div>
          </details>
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

          <section>
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Etappen{stages.length > 0 ? ` · ${stages.length} ${stages.length === 1 ? "Destination" : "Destinationen"}` : ""}
              </h2>
              <Link
                href={`/trips/${trip.slug}/stages/new`}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                + Etappe hinzufügen
              </Link>
            </div>

            {stages.length > 0 ? (
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex gap-4 pb-3" style={{ width: "max-content" }}>
                  {stages.map((stage, idx) => (
                    <StageCard key={stage.id} stage={stage} idx={idx} slug={trip.slug} />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Noch keine Etappen angelegt. Jede Reise braucht mindestens eine Etappe.
                </p>
              </div>
            )}
          </section>

          <section id="buchungen">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Buchungen{bookings.length > 0 ? ` · ${bookings.length}` : ""}
              </h2>
              <Link
                href={`/trips/${trip.slug}/bookings/new`}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                + Buchung hinzufügen
              </Link>
            </div>

            {bookings.length > 0 ? (
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <BookingRowItem
                    key={booking.id}
                    booking={booking}
                    slug={trip.slug}
                    stageTitle={booking.stage_id ? stageTitleById.get(booking.stage_id) ?? null : null}
                  />
                ))}
              </div>
            ) : (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Noch keine Buchungen erfasst.
                </p>
                <Link
                  href={`/trips/${trip.slug}/bookings/new`}
                  style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
                >
                  Erste Buchung hinzufügen →
                </Link>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Reiseübersicht</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <OverviewCard title="Flüge" detail={flightsSummary.detail} status={flightsSummary.status} statusColor={flightsSummary.statusColor} Icon={Plane} href={flightsSummary.href} />
              <OverviewCard title="Hotels" detail={hotelsSummary.detail} status={hotelsSummary.status} statusColor={hotelsSummary.statusColor} Icon={BedDouble} href={hotelsSummary.href} />
              <OverviewCard title="Aktivitäten" detail={activitiesSummary.detail} status={activitiesSummary.status} statusColor={activitiesSummary.statusColor} Icon={Compass} href={activitiesSummary.href} />
              <OverviewCard title="Mehr" detail={moreSummary.detail} status={moreSummary.status} statusColor={moreSummary.statusColor} Icon={MoreHorizontal} href={moreSummary.href} />
              <OverviewCard title="Dokumente" detail={documentsSummary.detail} status={documentsSummary.status} statusColor={documentsSummary.statusColor} Icon={FileText} />
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
