import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RefreshCw, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { isTripCurrentlyRunning, isTripHistorical } from "@/lib/trip-status";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import { getTodayCategoryConfig } from "@/lib/today-categories";
import { resolveTripAiContext } from "@/lib/today-trip-context";
import { generateCategorySuggestion, getCategorySuggestion } from "@/lib/actions/category-suggestions";
import { loadCategoryPlaces, getCategoryPlaces } from "@/lib/actions/category-places";
import { buildLumiContext } from "@/lib/lumi-context";
import { commitPlaceToJourney } from "@/lib/actions/lumi-journey";
import { Banner } from "@/components/Banner";
import type { StageInput, TimelineBooking } from "@/lib/journey";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium mb-4" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.62rem" }}>
      {children}
    </h2>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
  trip_members: Array<{ persons: { id: string; name: string } | null }>
  stages: StageInput[]
  bookings: TimelineBooking[]
};

export default async function TodayCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { category } = await params;
  const { error, saved } = await searchParams;

  // §"Vollständig generisch, keine eigene Seite pro Kategorie": diese Seite
  // rendert ausschließlich aus der aufgelösten Config (lib/today-categories.ts).
  // Eine unbekannte/künftig entfernte Kategorie führt zu 404, kein Sonderfall im JSX.
  const config = getTodayCategoryConfig(category);
  if (!config) notFound();

  const returnTo = `/today/category/${category}`;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const todayIso = todayIsoInFamilyTimezone();

  const { data: trips } = await supabase
    .from("trips")
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      trip_members ( persons ( id, name ) ),
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at )
    `)
    .eq("family_id", familyId);

  const allTrips = (trips ?? []) as unknown as TripRow[];
  const activeTrip = allTrips.find((t) => isTripCurrentlyRunning(t, todayIso));
  const nextTrip = !activeTrip
    ? allTrips
        .filter((t) => t.status !== "archived" && !isTripHistorical(t, todayIso))
        .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0] ?? null
    : null;
  const trip = activeTrip ?? nextTrip;

  const backLink = (
    <Link
      href="/today"
      className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
      style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
    >
      <ChevronLeft size={13} strokeWidth={1.5} />
      LUMI
    </Link>
  );

  if (!trip) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          {backLink}
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            {config.label}
          </div>
          <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            Aktuell keine Reise
          </h1>
          <Card>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Sobald eine Reise geplant oder aktiv ist, hilft LUMI euch hier mit {config.label.toLowerCase()}.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const context = await resolveTripAiContext(trip, trip === activeTrip, todayIso);
  const dateLabel = new Date(todayIso).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const weatherSummary = context.weather ? `${context.weather.currentTemp}°C` : null;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        {backLink}

        <div className="flex items-center gap-2.5 mb-3">
          <config.Icon size={16} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            {config.label}
          </div>
        </div>
        <h1 className="font-light mb-1" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
          {context.tripTitle}
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>📍 {context.locationLabel}</p>

        {error && <Banner variant="error">{error}</Banner>}
        {saved && <Banner variant="success">Gemerkt -- in der Journey unter „Idee" zu finden.</Banner>}

        {config.placesCategory ? (
          <PlacesCategorySection
            familyId={familyId} tripId={context.tripId} tripSlug={context.tripSlug}
            category={config.key} label={config.label} aiButtonLabel={config.aiButtonLabel}
            returnTo={returnTo} todayIso={todayIso}
          />
        ) : (
          <AiTextCategorySection
            familyId={familyId} tripId={context.tripId} category={config.key}
            questionText={config.aiQuestionTemplate(context.locationLabel)} label={config.label}
            aiButtonLabel={config.aiButtonLabel} dateLabel={dateLabel} locationLabel={context.locationLabel}
            weatherSummary={weatherSummary} memberNames={context.memberNames} returnTo={returnTo}
          />
        )}
      </div>
    </div>
  );
}

/**
 * §Kategorien mit echter Places-Anbindung (Aktivitäten/Restaurants/Strände/
 * Natur): zeigt den zuletzt gecachten Treffersatz (kein API-Aufruf beim
 * Öffnen), "Vorschläge laden"/"Aktualisieren" löst `loadCategoryPlaces`
 * aus (Places + Route Matrix + generateFiveRecommendations).
 */
async function PlacesCategorySection({
  familyId, tripId, tripSlug, category, label, aiButtonLabel, returnTo, todayIso,
}: {
  familyId: string; tripId: string; tripSlug: string; category: string; label: string
  aiButtonLabel: string; returnTo: string; todayIso: string;
}) {
  const contextResult = await buildLumiContext(familyId, tripId, todayIso);
  if (!contextResult.ok) {
    const message = contextResult.reason === "trip_not_found"
      ? "Reisedaten konnten nicht geladen werden."
      : "Ausgangspunkt (Hotel/Ort) konnte nicht ermittelt werden -- bitte später erneut versuchen.";
    return (
      <Card>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{message}</p>
      </Card>
    );
  }
  const context = contextResult.context;
  const originKey = context.origin.placeId ?? `${context.origin.lat.toFixed(3)},${context.origin.lng.toFixed(3)}`;
  const cached = await getCategoryPlaces(familyId, tripId, category, originKey);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <SectionLabel>
          Ausgangspunkt: {context.origin.source === "hotel" ? "Hotel" : "Urlaubsort"} · {context.origin.formattedAddress}
        </SectionLabel>
        <form action={loadCategoryPlaces}>
          <input type="hidden" name="family_id" value={familyId} />
          <input type="hidden" name="trip_id" value={tripId} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            className="flex items-center gap-1.5"
            style={{
              background: cached ? "transparent" : "var(--foreground)",
              color: cached ? "var(--accent)" : "var(--surface)",
              border: cached ? "1px solid rgba(184,154,94,0.4)" : "none",
              borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", letterSpacing: cached ? undefined : "0.1em",
              textTransform: cached ? undefined : "uppercase", cursor: "pointer",
            }}
          >
            {cached ? (<><RefreshCw size={11} strokeWidth={1.6} /> Aktualisieren</>) : aiButtonLabel}
          </button>
        </form>
      </div>

      {!cached && (
        <Card>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Noch keine {label.toLowerCase()} geladen -- ein Klick ruft echte Treffer inklusive Fahrzeit und Bewertung ab.
          </p>
        </Card>
      )}

      {cached && cached.items.length === 0 && (
        <Card>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Keine passenden Treffer gefunden.</p>
        </Card>
      )}

      {cached && cached.items.length > 0 && (
        <>
          <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.66rem" }}>
            {cached.daysAgo <= 0 ? "Heute aktualisiert" : cached.daysAgo === 1 ? "Vor 1 Tag aktualisiert" : `Vor ${cached.daysAgo} Tagen aktualisiert`}
          </div>
          <div className="space-y-2.5">
            {cached.items.map((item) => (
              <Card key={item.placeId}>
                <div className="flex gap-3">
                  {item.photoName && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/places-photo/${item.photoName}?maxWidthPx=200`}
                      alt="" width={72} height={72}
                      style={{ borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "var(--foreground)", fontSize: "0.9rem", marginBottom: "3px" }}>{item.name}</div>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1 mb-2" style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                      {item.rating != null && <span>★ {item.rating} ({item.reviewCount ?? 0})</span>}
                      {item.openNow != null && <span style={{ color: item.openNow ? "#4C7A5D" : "#B5624A" }}>{item.openNow ? "geöffnet" : "Jetzt geschlossen"}</span>}
                      {item.durationMinutes != null && <span>{item.durationMinutes} Min · {item.distanceKm} km</span>}
                      {item.tripLength && <span>{item.tripLength}</span>}
                    </div>
                    {item.why && <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>{item.why}</p>}
                    <form action={commitPlaceToJourney}>
                      <input type="hidden" name="trip_id" value={tripId} />
                      <input type="hidden" name="trip_slug" value={tripSlug} />
                      <input type="hidden" name="date" value={todayIso} />
                      <input type="hidden" name="title" value={item.name} />
                      <input type="hidden" name="place_id" value={item.placeId} />
                      <input type="hidden" name="duration_minutes" value={item.durationMinutes ?? ""} />
                      <input type="hidden" name="distance_km" value={item.distanceKm ?? ""} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        style={{
                          background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                          borderRadius: "20px", padding: "5px 12px", fontSize: "0.62rem", cursor: "pointer",
                        }}
                      >
                        Merken
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** §Kategorien ohne Places-Anbindung (aktuell nur "Familie"): unverändertes bisheriges Verhalten. */
async function AiTextCategorySection({
  familyId, tripId, category, questionText, label, aiButtonLabel, dateLabel, locationLabel, weatherSummary, memberNames, returnTo,
}: {
  familyId: string; tripId: string; category: string; questionText: string; label: string; aiButtonLabel: string
  dateLabel: string; locationLabel: string; weatherSummary: string | null; memberNames: string[]; returnTo: string;
}) {
  const cachedSuggestion = await getCategorySuggestion(familyId, tripId, category);

  return (
    <section className="mb-8">
      <SectionLabel>KI-Empfehlung</SectionLabel>
      {cachedSuggestion ? (
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {cachedSuggestion.questionText}
            </span>
          </div>
          <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{cachedSuggestion.title}</div>
          <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{cachedSuggestion.body}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>
              {cachedSuggestion.daysAgo <= 0 ? "Heute aktualisiert" : cachedSuggestion.daysAgo === 1 ? "Vor 1 Tag aktualisiert" : `Vor ${cachedSuggestion.daysAgo} Tagen aktualisiert`}
            </span>
            <form action={generateCategorySuggestion}>
              <input type="hidden" name="family_id" value={familyId} />
              <input type="hidden" name="trip_id" value={tripId} />
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="question_text" value={questionText} />
              <input type="hidden" name="date_label" value={dateLabel} />
              <input type="hidden" name="location_label" value={locationLabel} />
              <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
              <input type="hidden" name="member_names" value={memberNames.join(",")} />
              <input type="hidden" name="is_regenerate" value="true" />
              <input type="hidden" name="return_to" value={returnTo} />
              <button
                type="submit"
                className="flex items-center gap-1.5"
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
                }}
              >
                <RefreshCw size={11} strokeWidth={1.6} />
                Aktualisieren
              </button>
            </form>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Noch keine KI-Empfehlung für {label.toLowerCase()} in {locationLabel}.
          </p>
          <form action={generateCategorySuggestion}>
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="trip_id" value={tripId} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="question_text" value={questionText} />
            <input type="hidden" name="date_label" value={dateLabel} />
            <input type="hidden" name="location_label" value={locationLabel} />
            <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
            <input type="hidden" name="member_names" value={memberNames.join(",")} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button
              type="submit"
              style={{
                background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              {aiButtonLabel}
            </button>
          </form>
        </Card>
      )}
    </section>
  );
}
