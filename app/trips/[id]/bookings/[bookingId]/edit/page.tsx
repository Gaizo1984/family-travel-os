import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateBooking } from "@/lib/actions/bookings";
import { BOOKING_TYPE_CONFIG } from "@/lib/bookings";
import type { BookingType } from "@/lib/supabase/types";
import { BookingForm } from "../../BookingForm";

export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, bookingId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, trip_id, stage_id, type, title, provider, booking_reference, status, payment_status, amount, currency, start_datetime, end_datetime, notes, details")
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking) notFound();
  const config = BOOKING_TYPE_CONFIG[booking.type as BookingType];

  const { data: stages } = await supabase
    .from("stages")
    .select("id, title, start_date")
    .eq("trip_id", trip.id)
    .order("start_date", { ascending: true, nullsFirst: false });

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}/bookings/${booking.id}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {booking.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          {config.label} bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {booking.title}
        </h1>

        <BookingForm
          config={config}
          action={updateBooking}
          stages={stages ?? []}
          hiddenFields={{ booking_id: booking.id, slug: trip.slug, type: booking.type }}
          submitLabel="Änderungen speichern"
          cancelHref={`/trips/${trip.slug}/bookings/${booking.id}`}
          errorMessage={error}
          values={{
            stage_id: booking.stage_id,
            title: booking.title,
            provider: booking.provider,
            booking_reference: booking.booking_reference,
            status: booking.status,
            payment_status: booking.payment_status,
            amount: booking.amount,
            currency: booking.currency,
            start_datetime: booking.start_datetime,
            end_datetime: booking.end_datetime,
            notes: booking.notes,
            details: booking.details as Record<string, string> | null,
          }}
        />

        <div
          className="rounded-xl p-6 mt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Buchung endgültig entfernen (Reise und Etappe bleiben erhalten).
          </p>
          <Link
            href={`/trips/${trip.slug}/bookings/${booking.id}/delete`}
            style={{
              background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
              borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em",
              textTransform: "uppercase", whiteSpace: "nowrap", textDecoration: "none",
            }}
          >
            Buchung löschen
          </Link>
        </div>

      </div>
    </div>
  );
}
