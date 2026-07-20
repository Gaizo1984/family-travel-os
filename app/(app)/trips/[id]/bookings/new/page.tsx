import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { createBooking } from "@/lib/actions/bookings";
import { extractBookingData } from "@/lib/actions/booking-extraction";
import { BOOKING_TYPE_ORDER, BOOKING_TYPE_CONFIG, BOOKING_CATEGORIES } from "@/lib/bookings";
import type { BookingCategory } from "@/lib/bookings";
import type { BookingType } from "@/lib/supabase/types";
import { loadTripParticipantOptions } from "@/lib/trip-participants";
import { BookingForm } from "../BookingForm";

type BookingDraft = {
  stage_id: string | null; title: string; provider: string | null; booking_reference: string | null
  status: string; payment_status: string; amount: number | null; currency: string
  start_datetime: string | null; end_datetime: string | null; notes: string | null
  details: Record<string, string> | null;
};

export default async function NewBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    type?: string; category?: string; error?: string; draft?: string; storage_path?: string
    from_saved_option_id?: string; from_saved_option_table?: string; return_draft?: string
  }>;
}) {
  const { id } = await params;
  const {
    type, category, error, draft: draftRaw, storage_path,
    from_saved_option_id, from_saved_option_table, return_draft,
  } = await searchParams;

  // §Formular-Daten nach einem Validierungsfehler wiederherstellen (siehe
  // lib/actions/bookings.ts::redirectWithDraft) -- statt die Seite leer neu
  // zu rendern.
  let draft: BookingDraft | null = null;
  if (draftRaw) {
    try { draft = JSON.parse(draftRaw) as BookingDraft; } catch { draft = null; }
  }

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const categoryConfig = category ? BOOKING_CATEGORIES[category as BookingCategory] : undefined;
  const config = type ? BOOKING_TYPE_CONFIG[type as BookingType] : undefined;

  if (!config) {
    const typesToShow = categoryConfig ? categoryConfig.pickerTypes : BOOKING_TYPE_ORDER;
    const backHref = categoryConfig ? `/trips/${trip.slug}/bookings/category/${categoryConfig.value}` : `/trips/${trip.slug}`;
    const backLabel = categoryConfig ? categoryConfig.label : trip.title;

    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          <Link
            href={backHref}
            className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
            style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            {backLabel}
          </Link>

          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Buchung hinzufügen
          </div>
          <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
            Was möchtest du erfassen?
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {typesToShow.map((key) => {
              const c = BOOKING_TYPE_CONFIG[key];
              const Icon = c.icon;
              const href = categoryConfig
                ? `/trips/${trip.slug}/bookings/new?type=${key}&category=${categoryConfig.value}`
                : `/trips/${trip.slug}/bookings/new?type=${key}`;
              return (
                <Link
                  key={key}
                  href={href}
                  className="rounded-xl p-5 flex flex-col items-center gap-3 text-center transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <Icon size={20} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>{c.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const changeTypeHref = categoryConfig
    ? `/trips/${trip.slug}/bookings/category/${categoryConfig.value}`
    : `/trips/${trip.slug}/bookings/new`;
  const changeTypeLabel = categoryConfig ? `Zurück zu ${categoryConfig.label}` : "Buchungstyp ändern";

  // §"Standardmäßig alle Reiseteilnehmer vorauswählen" (Nutzervorgabe): beim
  // Neuanlegen sind alle verfügbaren Optionen vorab angehakt.
  let participants: Awaited<ReturnType<typeof loadTripParticipantOptions>> = [];
  if (config.showParticipants) {
    const { id: familyId } = await getFamily();
    participants = await loadTripParticipantOptions(supabase, trip.id, familyId);
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={changeTypeHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {changeTypeLabel}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          {config.label}
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Neue Buchung
        </h1>

        <BookingForm
          config={config}
          action={createBooking}
          extractAction={extractBookingData}
          hiddenFields={{
            trip_id: trip.id, slug: trip.slug, type: config.value, mode: "create",
            ...(categoryConfig ? { category: categoryConfig.value } : {}),
            // §Phase B "Zur Reise übernehmen" (Nutzervorgabe): nur gesetzt, wenn
            // dieses Formular über den Draft-Link aus einer gemerkten Flug-/
            // Hotel-Option kam -- löst nach erfolgreichem Speichern in
            // createBooking die Verknüpfung (status='booked') aus.
            ...(from_saved_option_id && from_saved_option_table
              ? { from_saved_option_id, from_saved_option_table }
              : {}),
            // §Bugfix "Rückflug fehlt" (Live-Test-Feedback): nur durchgereicht,
            // nicht ausgewertet -- die Verkettung zum Rückflug-Formular passiert
            // serverseitig in createBooking (lib/actions/bookings.ts).
            ...(return_draft ? { return_draft } : {}),
          }}
          submitLabel="Buchung speichern"
          cancelHref={`/trips/${trip.slug}`}
          errorMessage={error}
          infoMessage={draft ? "Automatisch ausgelesen — bitte prüfen und bei Bedarf korrigieren." : (from_saved_option_id ? "Aus deiner Merkliste übernommen — bitte prüfen und bei Bedarf korrigieren." : undefined)}
          existingStoragePath={storage_path}
          values={draft ?? undefined}
          participants={participants}
          selectedParticipantIds={participants.map((p) => p.id)}
        />
      </div>
    </div>
  );
}
