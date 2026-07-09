import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_TYPE_CONFIG, BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatDateTimeDE } from "@/lib/bookings";
import type { BookingType, BookingStatus, PaymentStatus } from "@/lib/supabase/types";

type BookingDetail = {
  id: string;
  trip_id: string;
  stage_id: string | null;
  type: BookingType;
  title: string;
  provider: string | null;
  booking_reference: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  amount: number | null;
  currency: string;
  start_datetime: string | null;
  end_datetime: string | null;
  notes: string | null;
  details: Record<string, string> | null;
  stages: { id: string; title: string } | null;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
        {label}
      </div>
      <div className="text-sm font-light" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string; bookingId: string }>;
}) {
  const { id, bookingId } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, trip_id, stage_id, type, title, provider, booking_reference, status,
      payment_status, amount, currency, start_datetime, end_datetime, notes, details,
      stages ( id, title )
    `)
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking) notFound();
  const b = booking as unknown as BookingDetail;
  const config = BOOKING_TYPE_CONFIG[b.type];
  const Icon = config.icon;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                {config.label}
              </span>
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {b.title}
            </h1>
          </div>
          <Link
            href={`/trips/${trip.slug}/bookings/${b.id}/edit`}
            style={{
              fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)",
              border: "1px solid rgba(184,154,94,0.3)", padding: "8px 16px", borderRadius: "20px", textDecoration: "none",
            }}
          >
            Bearbeiten
          </Link>
        </div>

        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <MetaItem label={config.startLabel} value={formatDateTimeDE(b.start_datetime)} />
            {config.showEnd && <MetaItem label={config.endLabel} value={formatDateTimeDE(b.end_datetime)} />}
            {config.providerLabel && <MetaItem label={config.providerLabel} value={b.provider ?? "—"} />}
            <MetaItem label="Buchungsstatus" value={BOOKING_STATUS_LABELS[b.status]} />
            <MetaItem label="Zahlungsstatus" value={PAYMENT_STATUS_LABELS[b.payment_status]} />
            <MetaItem label="Preis" value={b.amount !== null ? `${b.amount.toFixed(2)} ${b.currency}` : "—"} />
            <MetaItem label="Buchungsnummer" value={b.booking_reference ?? "—"} />
            {b.stages && <MetaItem label="Etappe" value={b.stages.title} />}
          </div>

          {config.detailFields.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6" style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              {config.detailFields.map((field) => (
                <MetaItem key={field.key} label={field.label} value={b.details?.[field.key] ?? "—"} />
              ))}
            </div>
          )}
        </div>

        {b.notes && (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Notizen
            </div>
            <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {b.notes}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
