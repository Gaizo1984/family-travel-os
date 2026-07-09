import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteBooking } from "@/lib/actions/bookings";

export default async function DeleteBookingPage({
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
    .select("id, title")
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking) notFound();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}/bookings/${booking.id}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {booking.title}
        </Link>

        <div
          className="rounded-xl p-8"
          style={{ background: "var(--surface)", border: "1px solid rgba(181,98,74,0.3)" }}
        >
          <div style={{ color: "#B5624A", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Buchung löschen
          </div>
          <h1 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}>
            &bdquo;{booking.title}&rdquo; wirklich löschen?
          </h1>
          <p className="leading-relaxed mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Nur diese Buchung wird entfernt. Die Reise und die zugeordnete Etappe bleiben unverändert erhalten.
          </p>

          <form action={deleteBooking} className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            <Link
              href={`/trips/${trip.slug}/bookings/${booking.id}/edit`}
              style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              style={{
                background: "#B5624A", color: "#F0EBE3", border: "none",
                borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
              }}
            >
              Ja, löschen
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
