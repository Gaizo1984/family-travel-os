import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_CATEGORIES, sortBookingsChronologically } from "@/lib/bookings";
import type { BookingCategory } from "@/lib/bookings";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import { BookingRowItem } from "../../BookingRowItem";

type BookingWithStage = {
  id: string;
  type: BookingType;
  title: string;
  provider: string | null;
  status: BookingStatus;
  amount: number | null;
  currency: string;
  start_datetime: string | null;
  created_at: string;
  stages: { title: string } | null;
};

export default async function BookingCategoryPage({
  params,
}: {
  params: Promise<{ id: string; category: string }>;
}) {
  const { id, category } = await params;
  const categoryConfig = BOOKING_CATEGORIES[category as BookingCategory];
  if (!categoryConfig) notFound();

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data } = await supabase
    .from("bookings")
    .select("id, type, title, provider, status, amount, currency, start_datetime, created_at, stages ( title )")
    .eq("trip_id", trip.id)
    .in("type", categoryConfig.types);

  const bookings = sortBookingsChronologically((data ?? []) as unknown as BookingWithStage[]);

  const addHref = categoryConfig.pickerTypes.length === 1
    ? `/trips/${trip.slug}/bookings/new?type=${categoryConfig.pickerTypes[0]}&category=${categoryConfig.value}`
    : `/trips/${trip.slug}/bookings/new?category=${categoryConfig.value}`;

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
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
              {trip.title}
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {categoryConfig.label}
            </h1>
          </div>
          <Link href={addHref} className="btn-neue-reise" style={{ flexShrink: 0 }}>
            + {categoryConfig.addLabel}
          </Link>
        </div>

        {bookings.length > 0 ? (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <BookingRowItem
                key={booking.id}
                booking={booking}
                slug={trip.slug}
                stageTitle={booking.stages?.title ?? null}
              />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              {categoryConfig.emptyDetail}
            </p>
            <Link
              href={addHref}
              style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
            >
              {categoryConfig.addLabel} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
