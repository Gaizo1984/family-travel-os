import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteSavedFlightOption } from "@/lib/actions/saved-flights";
import { deleteSavedHotelOption } from "@/lib/actions/saved-hotels";
import { computeSavedOptionBreakdown, type SavedOptionRow } from "@/lib/booking-status-breakdown";
import { formatCurrencyDE } from "@/lib/demo-data";
import type { FlightSearchOption } from "@/lib/flight-types";
import type { HotelShortlistItem } from "@/lib/trip-idea-hotel-types";
import type { BookingType } from "@/lib/supabase/types";

const STATUS_LABEL = { saved: "Gemerkt", selected: "Ausgewählt", booked: "Gebucht" } as const;

const REAL_BOOKING_ONLY_TYPES: { type: BookingType; label: string; emptyLabel: string }[] = [
  { type: "rental_car", label: "Mietwagen", emptyLabel: "Kein Mietwagen gebucht" },
  { type: "transfer", label: "Transfers", emptyLabel: "Keine Transfers gebucht" },
  { type: "activity", label: "Aktivitäten", emptyLabel: "Keine Aktivitäten gebucht" },
];

type StatusColumnItem = {
  id: string; label: string; sub: string; href?: string
  deleteAction: (formData: FormData) => void; returnTo: string
};

/**
 * §Bugfix "Gemerkte/gebuchte Flüge müssen aus der Buchungsübersicht löschbar
 * sein" (Live-Test-Feedback): entfernt nur die Merkliste-Zeile
 * (saved_flight_options/saved_hotel_options), niemals die echte Buchung --
 * eine bereits bestätigte Buchung bleibt unangetastet und hat ihren eigenen
 * Lösch-Weg (/trips/[id]/bookings/[bookingId]/delete). Bewusst dieselben,
 * bereits bestehenden deleteSavedFlightOption/deleteSavedHotelOption Actions
 * -- keine zweite Löschlogik.
 */
function StatusColumn({ title, items }: { title: string; items: StatusColumnItem[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between" style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        <span>{title}</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: "0.72rem" }}>—</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {item.href ? (
                <Link href={item.href} className="block" style={{ textDecoration: "none" }}>
                  <div style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{item.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{item.sub}</div>
                </Link>
              ) : (
                <>
                  <div style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{item.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{item.sub}</div>
                </>
              )}
              <form action={item.deleteAction} className="mt-1.5">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="return_to" value={item.returnTo} />
                <button
                  type="submit"
                  className="flex items-center gap-1"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#B5624A", fontSize: "0.62rem", padding: 0 }}
                >
                  <Trash2 size={10} strokeWidth={1.8} />
                  Entfernen
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * §Phase B "Zentrale Buchungsübersicht" (Nutzervorgabe, wörtlich): Flüge und
 * Hotels zeigen Gemerkt/Ausgewählt/Gebucht aus saved_flight_options/
 * saved_hotel_options (jetzt trip-gebunden, siehe Migration
 * 20260727000004); Mietwagen/Transfers/Aktivitäten zeigen ausschließlich
 * echte Buchungen aus `bookings` -- keine neue Merkfunktion dafür (explizite
 * Vorgabe). Diese Route existierte bisher nicht (bestätigt in der
 * Bestandsanalyse) und schließt genau die Lücke, die das entfernte
 * Buchungsportal nie sauber gefüllt hat.
 */
export default async function TripBookingsOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("id, slug, title").eq("slug", id).maybeSingle();
  if (!trip) notFound();

  const [{ data: savedFlightRows }, { data: savedHotelRows }, { data: realBookings }] = await Promise.all([
    supabase.from("saved_flight_options").select("id, status, booking_id, flight_option").eq("trip_id", trip.id),
    supabase.from("saved_hotel_options").select("id, status, booking_id, hotel_option, destination").eq("trip_id", trip.id),
    supabase.from("bookings").select("id, type, title, provider, start_datetime, amount, currency")
      .eq("trip_id", trip.id).in("type", REAL_BOOKING_ONLY_TYPES.map((t) => t.type)),
  ]);

  const flightBreakdown = computeSavedOptionBreakdown(
    (savedFlightRows ?? []).map((r): SavedOptionRow<FlightSearchOption> => ({
      id: r.id, status: r.status, bookingId: r.booking_id, data: r.flight_option as unknown as FlightSearchOption,
    })),
  );
  const hotelBreakdown = computeSavedOptionBreakdown(
    (savedHotelRows ?? []).map((r): SavedOptionRow<HotelShortlistItem> => ({
      id: r.id, status: r.status, bookingId: r.booking_id, data: r.hotel_option as unknown as HotelShortlistItem,
    })),
  );

  function flightRouteLabel(option: FlightSearchOption): string {
    const segs = option.outbound.segments;
    return `${segs[0]?.departureAirport ?? "?"} → ${segs[segs.length - 1]?.arrivalAirport ?? "?"}`;
  }

  const returnTo = `/trips/${trip.slug}/bookings`;

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Buchungsübersicht
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {trip.title}
        </h1>

        <section className="mb-10">
          <div className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>Flüge</div>
          <div className="grid grid-cols-3 gap-3">
            <StatusColumn title={STATUS_LABEL.saved} items={flightBreakdown.saved.map((r) => ({
              id: r.id, label: flightRouteLabel(r.data), sub: formatCurrencyDE(r.data.price, r.data.currency),
              deleteAction: deleteSavedFlightOption, returnTo,
            }))} />
            <StatusColumn title={STATUS_LABEL.selected} items={flightBreakdown.selected.map((r) => ({
              id: r.id, label: flightRouteLabel(r.data), sub: formatCurrencyDE(r.data.price, r.data.currency),
              deleteAction: deleteSavedFlightOption, returnTo,
            }))} />
            <StatusColumn title={STATUS_LABEL.booked} items={flightBreakdown.booked.map((r) => ({
              id: r.id, label: flightRouteLabel(r.data), sub: "Gebucht",
              href: r.bookingId ? `/trips/${trip.slug}/bookings/${r.bookingId}` : undefined,
              deleteAction: deleteSavedFlightOption, returnTo,
            }))} />
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>Hotels</div>
          <div className="grid grid-cols-3 gap-3">
            <StatusColumn title={STATUS_LABEL.saved} items={hotelBreakdown.saved.map((r) => ({
              id: r.id, label: r.data.name, sub: r.data.address, deleteAction: deleteSavedHotelOption, returnTo,
            }))} />
            <StatusColumn title={STATUS_LABEL.selected} items={hotelBreakdown.selected.map((r) => ({
              id: r.id, label: r.data.name, sub: r.data.address, deleteAction: deleteSavedHotelOption, returnTo,
            }))} />
            <StatusColumn title={STATUS_LABEL.booked} items={hotelBreakdown.booked.map((r) => ({
              id: r.id, label: r.data.name, sub: "Gebucht",
              href: r.bookingId ? `/trips/${trip.slug}/bookings/${r.bookingId}` : undefined,
              deleteAction: deleteSavedHotelOption, returnTo,
            }))} />
          </div>
        </section>

        <section>
          <div className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>Mietwagen, Transfers & Aktivitäten</div>
          <div className="space-y-5">
            {REAL_BOOKING_ONLY_TYPES.map(({ type, label, emptyLabel }) => {
              const items = (realBookings ?? []).filter((b) => b.type === type);
              return (
                <div key={type}>
                  <div className="mb-2" style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {label}
                  </div>
                  {items.length === 0 ? (
                    <div
                      className="rounded-lg px-4 py-3 flex items-center justify-between"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{emptyLabel}</span>
                      <Link
                        href={`/trips/${trip.slug}/bookings/new?type=${type}`}
                        style={{ color: "var(--accent)", fontSize: "0.68rem", textDecoration: "none" }}
                      >
                        + Hinzufügen
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((b) => (
                        <Link
                          key={b.id}
                          href={`/trips/${trip.slug}/bookings/${b.id}`}
                          className="flex items-center justify-between rounded-lg px-4 py-3 transition-opacity hover:opacity-80"
                          style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                        >
                          <div>
                            <div style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{b.title}</div>
                            {b.provider && <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{b.provider}</div>}
                          </div>
                          {b.amount != null && (
                            <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{formatCurrencyDE(b.amount, b.currency)}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
