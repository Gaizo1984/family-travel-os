import Link from "next/link";
import { BOOKING_TYPE_CONFIG, BOOKING_STATUS_LABELS, formatDateTimeDE } from "@/lib/bookings";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";

export type BookingRowData = {
  id: string;
  type: BookingType;
  title: string;
  provider: string | null;
  status: BookingStatus;
  amount: number | null;
  currency: string;
  start_datetime: string | null;
};

export function BookingRowItem({
  booking,
  slug,
  stageTitle,
}: {
  booking: BookingRowData;
  slug: string;
  stageTitle: string | null;
}) {
  const config = BOOKING_TYPE_CONFIG[booking.type];
  const Icon = config.icon;
  return (
    <Link
      href={`/trips/${slug}/bookings/${booking.id}`}
      className="flex items-center gap-4 p-4 rounded-xl transition-colors"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-lg"
        style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}
      >
        <Icon size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{booking.title}</span>
          {stageTitle && (
            <span style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.06em", background: "var(--accent-subtle)", padding: "1px 8px", borderRadius: "10px" }}>
              {stageTitle}
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
          {booking.provider ? `${booking.provider} · ` : ""}{formatDateTimeDE(booking.start_datetime)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </div>
        {booking.amount !== null && (
          <div className="text-sm mt-0.5" style={{ color: "var(--foreground)" }}>
            {booking.amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {booking.currency}
          </div>
        )}
      </div>
    </Link>
  );
}
