import Link from "next/link";
import {
  Clock, ArrowRight, Ticket, Car, Users, ChevronRight, Sparkles, Compass,
  FileQuestion, CloudSun, Shuffle, AlertTriangle, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { getFamily } from "@/lib/family";
import { isTripCurrentlyRunning, isTripHistorical, tripCountdownDisplay } from "@/lib/trip-status";
import { getTripDuration } from "@/lib/demo-data";
import { sortStagesChronologically, buildJourneyTimeline } from "@/lib/journey";
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from "@/lib/journey";
import { sortBookingsChronologically } from "@/lib/bookings";
import { buildTodayTimelineItems, findNextUpcoming, buildTomorrowPrepItems, resolveCurrentLocation, nearbyStageGeocodeCandidates, detectDayHighlight } from "@/lib/today";
import { getWeatherForLocation, describeWeatherCode } from "@/lib/weather";
import type { WeatherLocationCandidate } from "@/lib/weather";
import { getCachedTodayRecommendation, generateAndCacheTodayRecommendation, DAY_STYLE_OPTIONS } from "@/lib/today-recommendation";
import { chooseTodayStyle } from "@/lib/actions/today-style";
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, TRAVEL_NEED_OPTIONS } from "@/lib/family-dna";
import type { FamilyDnaSummary } from "@/lib/family-dna";
import { COUNTRY_STAGE_IMAGES, FALLBACK_STAGE_IMAGE, resolveStageImages } from "@/lib/stage-images";
import { SignedPhoto } from "@/components/SignedPhoto";
import { COUNTRY_NAMES } from "@/lib/geo-suggestions";
import { todayIsoInFamilyTimezone, nowHHMMInFamilyTimezone } from "@/lib/time";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import type { JourneyEventCategory, JourneyEventStatus } from "@/lib/journey-events";
import { computeTripRequirements } from "@/lib/travel-requirements";
import type { TravelRequirement } from "@/lib/travel-requirements";
import { scoreDestinations } from "@/lib/discover-scoring";
import type { ScoredDestination } from "@/lib/discover-scoring";
import { searchDestinations } from "@/lib/providers/destination-provider";
import { QUICK_ACTIONS, buildConciergeCards } from "@/lib/concierge";
import type { QuickActionKey, DisplayCard } from "@/lib/concierge";
import { askConcierge, commitConciergeAction, refreshConciergeMessage } from "@/lib/actions/concierge-actions";
import { listTodayConciergeMessages, buildContextFingerprint } from "@/lib/concierge-messages";
import type { CachedConciergeMessage } from "@/lib/concierge-messages";
import { computeTripReadiness } from "@/lib/readiness";
import type { ReadinessFinding } from "@/lib/readiness";

type FlightWithPasses = { id: string; title: string; slug: string };

/**
 * §7.2: prominenter Schnellzugriff auf Boardingpässe am Flugtag, ohne Umweg über
 * Reise → Flüge → Flugdetail. Nur relevant, wenn heute wirklich ein Abflug- oder
 * Ankunftstag ist UND für diesen Flug bereits mindestens ein Boardingpass
 * hochgeladen wurde — sonst bliebe der Zugriff leer/irreführend.
 */
/**
 * §Performance-Audit: liest den Flugtag-Treffer jetzt aus den ohnehin schon
 * geladenen `trips` (inkl. verschachtelter `bookings`) statt einer eigenen,
 * unfilterten `bookings`-Abfrage über alle Reisen der Familie -- nur der
 * Boardingpass-Abgleich (documents) bleibt eine echte zusätzliche Abfrage.
 */
async function findTodaysFlightWithBoardingPasses(trips: TripRow[], todayIso: string): Promise<FlightWithPasses | null> {
  const todaysFlights: FlightWithPasses[] = trips.flatMap((t) =>
    t.bookings
      .filter((b) => b.type === "flight" && b.status !== "cancelled"
        && (b.start_datetime?.slice(0, 10) === todayIso || b.end_datetime?.slice(0, 10) === todayIso))
      .map((b) => ({ id: b.id, title: b.title, slug: t.slug })),
  );

  if (todaysFlights.length === 0) return null;

  const supabase = await createClient();
  const { data: passDocs } = await supabase
    .from("documents")
    .select("booking_id")
    .eq("doc_type", "boarding_pass")
    .in("booking_id", todaysFlights.map((f) => f.id));

  const bookingIdsWithPasses = new Set((passDocs ?? []).map((d) => d.booking_id));
  return todaysFlights.find((f) => bookingIdsWithPasses.has(f.id)) ?? null;
}

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type OnThisDayMemory = { id: string; storagePath: string; caption: string | null; yearsAgo: number };

/**
 * §"Vor einem Jahr wart ihr heute...": reine Datums-Query (taken_at = heute
 * minus 1/2/3 Jahre), kein KI-Aufruf nötig — deterministisch wie die übrigen
 * Highlight-Erkennungen in dieser App.
 */
async function findOnThisDayMemories(familyId: string, todayIso: string): Promise<OnThisDayMemory[]> {
  const supabase = await createClient();
  const [y, m, d] = todayIso.split("-");
  const candidateDates = [1, 2, 3].map((yearsAgo) => `${Number(y) - yearsAgo}-${m}-${d}`);

  const { data } = await supabase
    .from("memory_photos")
    .select("id, storage_path, caption, taken_at")
    .eq("family_id", familyId)
    .in("taken_at", candidateDates);

  return (data ?? []).map((p) => ({
    id: p.id,
    storagePath: p.storage_path,
    caption: p.caption,
    yearsAgo: Number(y) - Number(p.taken_at!.slice(0, 4)),
  }));
}

type PersonRow = { id: string; name: string };
type StageRow = {
  id: string; title: string; location: string | null; nights: number | null;
  start_date: string | null; end_date: string | null; accommodation: string | null;
  sort_order: number; country_code: string | null; cover_photo_id: string | null;
};
type BookingRow = {
  id: string; type: BookingType; title: string; provider: string | null; status: BookingStatus;
  start_datetime: string | null; end_datetime: string | null; stage_id: string | null;
  details: Record<string, string> | null; created_at: string;
};
type JourneyEventRow = {
  id: string; stage_id: string | null; date: string; time: string | null;
  category: JourneyEventCategory; title: string; location: string | null; status: JourneyEventStatus;
};
type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string;
  start_date: string | null; end_date: string | null;
  trip_members: Array<{ persons: PersonRow | null }>;
  stages: StageRow[]; bookings: BookingRow[]; journey_events: JourneyEventRow[];
};

/** §"Schnellaktionen (Icons)": ein Icon je QUICK_ACTIONS-Eintrag, nur für die Darstellung in LUMI. */
const QUICK_ACTION_ICONS: Record<QuickActionKey, LucideIcon> = {
  today_important: Sparkles,
  plan_tomorrow: Clock,
  whats_missing: FileQuestion,
  adjust_weather: CloudSun,
  find_alternative: Shuffle,
  explain_conflict: AlertTriangle,
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-medium mb-4"
      style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.62rem" }}
    >
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-6 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

/** §Punkt 3 "Ein-Klick-Übernahme ins Journey": wiederverwendet commitConciergeAction 1:1 (lib/actions/concierge-actions.ts), das bereits genau das tut -- kein neuer Server-Code. */
function CommitToJourneyButton({ tripId, tripSlug, forDate, eventTitle, label, className = "mt-3" }: { tripId: string; tripSlug: string; forDate: string; eventTitle: string; label: string; className?: string }) {
  return (
    <form action={commitConciergeAction}>
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="trip_slug" value={tripSlug} />
      <input type="hidden" name="for_date" value={forDate} />
      <input type="hidden" name="event_title" value={eventTitle} />
      <button
        type="submit"
        className={className}
        style={{
          background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
          borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
        }}
      >
        {label}
      </button>
    </form>
  );
}

/** §"Für dich": Verallgemeinerung von "Für die Familie mitgedacht" -- mit aktiver Reise auf Mitreisende gefiltert, sonst die ganze Familie (buildFamilyDnaSummary ist bereits familienweit). */
function FuerDichSection({ people }: { people: FamilyDnaSummary["persons"] }) {
  if (people.length === 0) return null;
  return (
    <section className="mb-8">
      <SectionLabel>Für dich</SectionLabel>
      <Card>
        <div className="space-y-3">
          {people.map((p) => {
            const needLabels = p.travel_needs.map((k) => TRAVEL_NEED_OPTIONS.find((o) => o.key === k)?.label ?? k);
            const allTags = [...needLabels, ...p.interest_tags];
            if (allTags.length === 0) return null;
            return (
              <div key={p.id} className="flex items-start gap-3">
                <Users size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{p.name}: </span>
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{allTags.join(", ")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

/** §Punkt 5 "LUMI schlägt 2-3 Ziele vor, mit Begründung": kompakte Vorschau derselben scoreDestinations()-Bewertung wie /discover, nicht dupliziert -- reasoning kommt direkt aus lib/discover-scoring.ts. */
function EntdeckenPreview({ items }: { items: ScoredDestination[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Entdecken</SectionLabel>
        <Link href="/discover" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.04em", textDecoration: "none" }}>
          Alle Ideen ansehen
        </Link>
      </div>
      <div className="space-y-2.5">
        {items.map(({ destination, reasoning }) => (
          <Card key={destination.name}>
            <div className="flex items-start gap-3">
              <Compass size={14} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ color: "var(--foreground)", fontSize: "0.88rem", marginBottom: "3px" }}>{destination.name}</div>
                <p style={{ color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5, fontStyle: "italic" }}>{reasoning}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** §"Frag LUMI" ohne laufende Reise: die Kontextfelder (Wetter/bekannter Plan/Highlight) ergeben ohne laufende Reise keinen Sinn -- ehrlicher Hinweis statt eines Formulars ohne echten Kontext. */
function FragLumiTeaser() {
  return (
    <section className="mb-8">
      <SectionLabel>Frag LUMI</SectionLabel>
      <Card>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
          Sobald eine Reise läuft, hilft dir LUMI hier mit Tagesplanung, offenen Punkten und schnellen Antworten.
        </p>
      </Card>
    </section>
  );
}

/** §Punkt 4 "Intelligente Hinweise": passive Anzeige der bestehenden Reisebereitschafts-Funde (Dokumente/Flüge/Hotels/Mietwagen/offene Aufgaben, lib/readiness.ts) -- bisher nur über die Concierge-Schnellaktionen "Was fehlt?"/"Konflikt erklären" auf Klick erreichbar. */
function PersonalisierteHinweiseSection({ findings, tripSlug }: { findings: ReadinessFinding[]; tripSlug: string }) {
  if (findings.length === 0) return null;
  const top = [...findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "conflict" ? -1 : 1)).slice(0, 4);
  return (
    <section className="mb-8">
      <SectionLabel>Personalisierte Hinweise</SectionLabel>
      <Card>
        <div className="space-y-2.5">
          {top.map((f, i) => (
            <Link key={i} href={f.href} className="flex items-center justify-between gap-2" style={{ textDecoration: "none" }}>
              <span style={{ color: f.severity === "conflict" ? "#B5624A" : "var(--muted)", fontSize: "0.78rem" }}>{f.message}</span>
              <ChevronRight size={12} strokeWidth={1.6} style={{ color: "var(--muted)", flexShrink: 0 }} />
            </Link>
          ))}
        </div>
        <Link
          href={`/trips/${tripSlug}/ready-to-travel`}
          className="inline-flex items-center gap-1 mt-3"
          style={{ color: "var(--accent)", fontSize: "0.72rem", letterSpacing: "0.04em", textDecoration: "none" }}
        >
          Alle Punkte ansehen <ChevronRight size={12} strokeWidth={1.6} />
        </Link>
      </Card>
    </section>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const family = await getFamily();
  const familyId = family.id;

  const todayIso = todayIsoInFamilyTimezone();
  const tomorrowIso = addDaysIso(todayIso, 1);
  const nowHHMM = nowHHMMInFamilyTimezone();

  const [{ data: trips }, onThisDayMemories, dna, { data: pastTripsForAvoid }] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status, start_date, end_date,
        trip_members ( persons ( id, name ) ),
        stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code, cover_photo_id ),
        bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at ),
        journey_events ( id, stage_id, date, time, category, title, location, status )
      `)
      .eq("family_id", familyId),
    findOnThisDayMemories(familyId, todayIso),
    // §Wird jetzt VOR der activeTrip-Weiche geladen, weil "Für dich" und
    // "Entdecken" (LUMI-Punkte 3+5) unabhängig davon sichtbar sein müssen, ob
    // gerade eine Reise läuft -- vorher wurde buildFamilyDnaSummary erst
    // weiter unten, nur im aktive-Reise-Zweig, aufgerufen.
    buildFamilyDnaSummary(familyId),
    supabase.from("past_trips").select("country_or_region").eq("family_id", familyId),
  ]);

  const onThisDayMemoriesWithUrls = await Promise.all(
    onThisDayMemories.map(async (m) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(m.storagePath, 3600);
      return { ...m, url: signed?.signedUrl ?? null };
    }),
  );

  // todayIso (Familienzeitzone) explizit übergeben, statt auf den UTC-basierten
  // Default von isTripCurrentlyRunning zu vertrauen — sonst könnte die "aktive
  // Reise"-Erkennung im selben ~2-Stunden-Fenster wie der Aktivitäten-Bug (s. u.)
  // von einem anderen Kalendertag ausgehen als der Rest dieser Seite.
  const allTrips = (trips ?? []) as unknown as TripRow[];
  const activeTrip = allTrips.find((t) => isTripCurrentlyRunning(t, todayIso));
  const flightToday = await findTodaysFlightWithBoardingPasses(allTrips, todayIso);

  // §Punkt 1 "Was ist heute wichtig?" auch ohne laufende Reise: die zeitlich
  // nächste bevorstehende Reise (weder laufend noch historisch/archiviert).
  const upcomingTrips = allTrips
    .filter((t) => t.status !== "archived" && !isTripCurrentlyRunning(t, todayIso) && !isTripHistorical(t, todayIso))
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  const nextTrip = upcomingTrips[0] ?? null;
  const nextTripRequirements: TravelRequirement[] = nextTrip
    ? (await computeTripRequirements(nextTrip.id)).filter((r) => r.status !== "satisfied")
    : [];

  // §Punkt 5 "2-3 Ziele vorschlagen, mit Begründung": identischer Aufruf wie
  // app/(app)/discover/page.tsx (avoidNames aus past_trips + bereits
  // erlebten/laufenden Reisen), nur mit 3 statt 1 Treffer für die Vorschau.
  const avoidNames = [
    ...(pastTripsForAvoid ?? []).map((p) => p.country_or_region),
    ...allTrips.filter((t) => t.status === "completed" || t.status === "active").map((t) => t.title),
  ];
  const destinations = (await searchDestinations()) ?? [];
  const discoverPreview = scoreDestinations(destinations, dna, { avoidNames }).slice(0, 3);

  // Warme, kurze Begrüßung statt Namensaufzählung — nutzt den echten Familiennamen, falls hinterlegt.
  const greeting = family?.name ? `Hallo ${family.name}` : "Schön, dass ihr da seid.";

  const dateLabel = new Date(todayIso).toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const flightBanner = flightToday && (
    <Link
      href={`/trips/${flightToday.slug}/bookings/${flightToday.id}/boarding-passes`}
      className="flex items-center gap-3 px-5 md:px-8 py-3"
      style={{ background: "var(--accent)", color: "var(--surface)", textDecoration: "none" }}
    >
      <Ticket size={15} strokeWidth={1.6} style={{ flexShrink: 0 }} />
      <span className="flex-1 min-w-0 truncate" style={{ fontSize: "0.8rem", letterSpacing: "0.02em" }}>
        Heute ist Flugtag · {flightToday.title} — Boardingpässe öffnen
      </span>
      <ArrowRight size={14} strokeWidth={1.6} style={{ flexShrink: 0 }} />
    </Link>
  );

  // ── Kein aktiver Reisetag: LUMI zeigt trotzdem, was heute zählt ──
  if (!activeTrip) {
    const hasOnThisDay = onThisDayMemoriesWithUrls.some((m) => m.url);
    const nextTripDuration = nextTrip?.start_date && nextTrip?.end_date ? getTripDuration(nextTrip.start_date, nextTrip.end_date) : 0;
    const nextTripCountdown = nextTrip ? tripCountdownDisplay(nextTrip, nextTripDuration, todayIso) : null;

    return (
      <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
        {flightBanner}
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9 w-full">
          {error && <Banner variant="error">{error}</Banner>}
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            {dateLabel}
          </div>
          <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "-0.01em" }}>
            {greeting}
          </h1>

          {/* ── Was ist heute wichtig? ── */}
          <section className="mb-8">
            <SectionLabel>Was ist heute wichtig?</SectionLabel>
            {nextTrip && nextTripCountdown ? (
              <Card>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div style={{ color: "var(--foreground)", fontSize: "0.95rem", marginBottom: "3px" }}>{nextTrip.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Eure nächste Reise</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-light leading-none" style={{ color: "var(--accent)" }}>{nextTripCountdown.value}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "3px" }}>
                      {nextTripCountdown.label}
                    </div>
                  </div>
                </div>
                {nextTripRequirements.length > 0 && (
                  <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
                    {nextTripRequirements.map((r, i) => (
                      <Link
                        key={i}
                        href={r.actionHref ?? `/trips/${nextTrip.slug}`}
                        className="flex items-center justify-between gap-2"
                        style={{ textDecoration: "none" }}
                      >
                        <span style={{ color: "var(--muted)", fontSize: "0.76rem" }}>{r.reason}</span>
                        <ChevronRight size={12} strokeWidth={1.6} style={{ color: "var(--muted)", flexShrink: 0 }} />
                      </Link>
                    ))}
                  </div>
                )}
                <Link
                  href={`/trips/${nextTrip.slug}`}
                  className="inline-flex items-center gap-1 mt-4"
                  style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", textDecoration: "none" }}
                >
                  Zur Reise <ChevronRight size={13} strokeWidth={1.6} />
                </Link>
              </Card>
            ) : (
              <Card>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  Aktuell läuft keine Reise und keine ist geplant. Sobald eine Reise ansteht, zeigt euch
                  LUMI hier Countdown, offene Punkte, Wetter und Tagesplan.
                </p>
                <Link
                  href="/trips"
                  className="inline-flex items-center gap-1 mt-4"
                  style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", textDecoration: "none" }}
                >
                  Zu euren Reisen <ChevronRight size={13} strokeWidth={1.6} />
                </Link>
              </Card>
            )}
          </section>

          {/* ── Vor einem Jahr wart ihr heute... (bereits geladen, bisher hier ungenutzt) ── */}
          {hasOnThisDay && (
            <section className="mb-8">
              <SectionLabel>Vor {onThisDayMemoriesWithUrls[0].yearsAgo === 1 ? "einem Jahr" : `${onThisDayMemoriesWithUrls[0].yearsAgo} Jahren`} wart ihr heute...</SectionLabel>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {onThisDayMemoriesWithUrls.map((m) => m.url && (
                  <div key={m.id} className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 120, height: 120 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" />
                    {m.caption && (
                      <div className="absolute inset-x-0 bottom-0 p-2" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.85), transparent)" }}>
                        <span style={{ color: "#F0EBE3", fontSize: "0.6rem" }}>{m.caption}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <FuerDichSection people={dna.persons.filter((p) => p.travel_needs.length > 0 || p.interest_tags.length > 0)} />
          <EntdeckenPreview items={discoverPreview} />
          <FragLumiTeaser />
        </div>
      </div>
    );
  }

  // ── Aktive Reise: Journey Journal als einzige Datenquelle ──
  const stages = sortStagesChronologically(activeTrip.stages) as StageInput[];
  const bookings = sortBookingsChronologically(activeTrip.bookings) as TimelineBooking[];
  const events = (activeTrip.journey_events ?? []) as TimelineEvent[];

  const timeline = buildJourneyTimeline(
    { start_date: activeTrip.start_date, end_date: activeTrip.end_date },
    stages, bookings, events,
  );
  const allDays: TimelineDay[] = timeline.flatMap((seg) => (seg.kind === "stay" ? seg.days : [seg.day]));
  const todayDay = allDays.find((d) => d.date === todayIso) ?? null;
  const tomorrowDay = allDays.find((d) => d.date === tomorrowIso) ?? null;

  // Eine einzige Standortquelle für Untertitel, Wetter und Hero-Bild — siehe
  // resolveCurrentLocation für die Prioritätskette (Etappe → Unterkunft → Reiseziel).
  // Keine Kombination mehrerer Quellen zu einem Text wie "Atlanta, Costa Rica".
  const currentLocation = resolveCurrentLocation(activeTrip, stages, bookings, todayIso);
  const heroSubtitle = `📍 ${currentLocation.label}`;
  // §Etappen-Titelbild (lib/stage-images.ts) hat Vorrang -- resolveStageImages
  // fällt intern bereits auf die Länder-Zuordnung zurück, falls die aktuelle
  // Etappe kein eigenes Titelbild hat; nur ohne zugehörige Etappe (Reiseziel-
  // Rückfallstufe in resolveCurrentLocation) wird direkt über den Ländercode aufgelöst.
  const stageImages = await resolveStageImages(supabase, stages);
  const heroImage = (currentLocation.stageId && stageImages.get(currentLocation.stageId)) || {
    url: (currentLocation.countryCode && COUNTRY_STAGE_IMAGES[currentLocation.countryCode]) || FALLBACK_STAGE_IMAGE,
    storagePath: null,
  };

  // Wetter wird exakt für denselben Standort geladen: der aufgelöste Name zuerst;
  // schlägt die Geokodierung fehl (z. B. bei Hotelnamen oder kleinen Provinzen,
  // die im Geocoding-Datensatz nicht erfasst sind — "Westin Reserva Conchal" und
  // "Guanacaste" liefern beide keinen Treffer in Costa Rica), zunächst andere
  // Etappen derselben Reise im selben Land (real näher am Aufenthaltsort als die
  // grobe Landeskoordinate), erst zuletzt das Land selbst — ohne den angezeigten
  // Standort-Text zu verändern.
  const countryName = currentLocation.countryCode ? COUNTRY_NAMES[currentLocation.countryCode] ?? null : null;
  const weatherCandidates: WeatherLocationCandidate[] = [
    { query: currentLocation.label, countryCode: currentLocation.countryCode },
    ...nearbyStageGeocodeCandidates(stages, currentLocation.label, currentLocation.countryCode, todayIso),
    ...(countryName && countryName !== currentLocation.label ? [{ query: countryName }] : []),
  ];
  const timelineItems = todayDay ? buildTodayTimelineItems(todayDay) : [];
  const nextUp = findNextUpcoming(timelineItems, nowHHMM);
  const prepItems = buildTomorrowPrepItems(tomorrowDay, stages, tomorrowIso);
  const highlightTitle = detectDayHighlight(timelineItems);

  // Wetter und der Empfehlungs-Cache-Check hängen nicht voneinander ab —
  // parallel laden. Familien-DNA (dna) ist bereits weiter oben geladen (wird
  // jetzt auch ohne aktive Reise für "Für dich"/"Entdecken" gebraucht).
  const [weather, cachedRecommendation] = await Promise.all([
    getWeatherForLocation(weatherCandidates),
    getCachedTodayRecommendation(familyId, activeTrip.id, todayIso),
  ]);
  const currentWeather = weather ? describeWeatherCode(weather.currentCode) : null;
  // Open-Meteo liefert "heute" (daily[0]) im lokalen Zeitfenster des ZIELORTS
  // (timezone=auto) — bei einem Standort mit anderer UTC-Differenz als
  // Deutschland kann das ein anderer Kalendertag sein als unser eigenes,
  // familienzeitbasiertes todayIso. Für den Tageswert daher explizit den
  // Eintrag suchen, der wirklich zu unserem "heute" passt, statt blind Index 0
  // zu nehmen — sonst würde z. B. die Regenwahrscheinlichkeit für "gestern"
  // (aus Zielort-Sicht) als "heute" angezeigt.
  const todayForecast = weather?.daily.find((d) => d.date === todayIso) ?? weather?.daily[0] ?? null;
  const todayPrecipitation = todayForecast?.precipitationProbability ?? null;

  const tripMemberIds = new Set(activeTrip.trip_members.flatMap((m) => (m.persons ? [m.persons.id] : [])));
  const tripMemberDna = dna.persons.filter((p) => tripMemberIds.has(p.id) && (p.travel_needs.length > 0 || p.interest_tags.length > 0));

  const knownPlanText = timelineItems.map((i) => `${i.time ?? ""} ${i.title}`.trim()).join(", ");
  const weatherSummary = currentWeather ? `${weather!.currentTemp}°C, ${currentWeather.label}` : null;
  const familyDnaText = formatFamilyDnaForPrompt(dna, todayIso);

  // §"Nur einmal pro Kalendertag generieren, bis Mitternacht wiederverwenden":
  // zuerst den Cache prüfen (kein KI-Aufruf). Existiert noch nichts, wird bei
  // erkanntem Kalender-Highlight sofort automatisch generiert; ohne Highlight
  // zeigt die Seite stattdessen den Tagesstil-Auswähler (kein KI-Aufruf, bis
  // die Familie eine Wahl trifft).
  let recommendation = cachedRecommendation;
  if (!recommendation && highlightTitle) {
    recommendation = await generateAndCacheTodayRecommendation(
      familyId, activeTrip.id, todayIso,
      { dateLabel, locationLabel: currentLocation.label, weatherSummary, familyDnaText, knownPlanText },
      highlightTitle, null,
    );
  }
  const needsStyleChoice = !recommendation && !highlightTitle;

  // §"Frag LUMI" ist jetzt die vollständige Concierge-Erfahrung (die Seite
  // selbst wurde entfernt) -- Kontextfelder werden direkt aus den ohnehin
  // schon vorhandenen Variablen dieser Seite gebaut, keine zweite Berechnung.
  const conciergeMemberNames = activeTrip.trip_members.flatMap((m) => (m.persons ? [m.persons.name] : []));
  const conciergeFingerprint = buildContextFingerprint(weatherSummary, knownPlanText);
  const recentConciergeMessages: CachedConciergeMessage[] = await listTodayConciergeMessages(
    familyId, activeTrip.id, todayIso, conciergeFingerprint,
  );
  // §"today_important" ausgeklammert: ihre einzige Wirkung (Tagesempfehlung
  // erzeugen/cachen) passiert auf dieser Seite bereits unconditional in der
  // Hero-Sektion -- ein Klick hier wäre redundant. Ebenso wird die
  // todayRec-Karte nicht in buildConciergeCards eingespeist (null), da sie
  // schon prominent als "Empfehlung für heute" gezeigt wird.
  const EMBEDDED_QUICK_ACTIONS = QUICK_ACTIONS.filter((qa) => qa.key !== "today_important");
  const conciergeCards: DisplayCard[] = buildConciergeCards(null, recentConciergeMessages);

  // §Punkt 4 "Intelligente Hinweise": dieselbe Reisebereitschafts-Engine wie
  // "Was fehlt?"/"Konflikt erklären", jetzt zusätzlich passiv angezeigt statt
  // nur auf Klick erreichbar.
  const readiness = await computeTripReadiness(activeTrip.id);

  // Fahrzeitanalyse: nur reale, heute aktive Mietwagen-Buchung — keine erfundenen Kennzahlen.
  const activeRentalCar = bookings.find(
    (b) => b.type === "rental_car" && b.status !== "cancelled"
      && b.start_datetime && b.end_datetime
      && b.start_datetime.slice(0, 10) <= todayIso && b.end_datetime.slice(0, 10) >= todayIso,
  );

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
      {flightBanner}

      {/* ── Hero ── */}
      <div className="relative" style={{ height: "380px", flexShrink: 0 }}>
        {heroImage.storagePath ? (
          <SignedPhoto
            storagePath={heroImage.storagePath} initialUrl={heroImage.url} alt={currentLocation.label}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage.url} alt={currentLocation.label} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.6) 45%, rgba(10,9,7,0.18) 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 px-5 md:px-10 pb-8">
          <h1 className="text-3xl md:text-4xl font-light leading-tight mb-1" style={{ color: "#F0EBE3", letterSpacing: "-0.01em" }}>
            {greeting}
          </h1>
          <div className="mb-4" style={{ color: "#A89880", fontSize: "0.8rem" }}>{heroSubtitle}</div>

          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: "6px" }}>
            {dateLabel}
          </div>
          {weather && (
            <div className="flex items-center gap-1.5 mb-4" style={{ color: "#A89880", fontSize: "0.72rem" }}>
              {currentWeather && <currentWeather.icon size={12} strokeWidth={1.6} />}
              <span>
                {weather.currentTemp}°C · {currentWeather?.label}
                {weather.rainStartsAt
                  ? ` · Regen ab ${weather.rainStartsAt} Uhr`
                  : todayPrecipitation !== null && ` · ${todayPrecipitation}% Regen`}
                {weather.sunset && ` · 🌇 ${weather.sunset.slice(11, 16)}`}
              </span>
            </div>
          )}

          {recommendation && (
            <p
              className="overflow-hidden"
              style={{
                color: "#D8CFC2", fontSize: "0.82rem", fontWeight: 300, lineHeight: 1.5, maxWidth: "640px",
                display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
              }}
            >
              {recommendation.daySummary}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-8 w-full">
        {error && <Banner variant="error">{error}</Banner>}

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "18px" }}>
          Für deine aktuelle Reise
        </div>

        {/* ── Was machen wir jetzt? (beibehalten, prominent) ── */}
        <section className="mb-8">
          <SectionLabel>Was machen wir jetzt?</SectionLabel>
          <Card>
            {nextUp ? (
              // Nur Icon/Titel/Uhrzeit — Details (Ort, Anbieter) stehen bereits identisch
              // unten in "Heutiger Tag", keine doppelte Darstellung derselben Angaben.
              <div className="flex items-center gap-4">
                <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 40, height: 40, background: "var(--accent-subtle)" }}>
                  <nextUp.icon size={17} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                </div>
                <div className="flex-1 min-w-0" style={{ color: "var(--foreground)", fontSize: "0.92rem" }}>{nextUp.title}</div>
                {nextUp.time && (
                  <div className="flex items-center gap-1 shrink-0" style={{ color: "var(--accent)", fontSize: "0.78rem" }}>
                    <Clock size={12} strokeWidth={1.6} /> {nextUp.time}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                Für den Rest des Tages ist nichts Festes geplant — Zeit für Spontanes.
              </p>
            )}
          </Card>
        </section>

        <PersonalisierteHinweiseSection findings={readiness.findings} tripSlug={activeTrip.slug} />

        {/* ── Vor einem Jahr wart ihr heute... ── */}
        {onThisDayMemoriesWithUrls.some((m) => m.url) && (
          <section className="mb-8">
            <SectionLabel>Vor {onThisDayMemoriesWithUrls[0].yearsAgo === 1 ? "einem Jahr" : `${onThisDayMemoriesWithUrls[0].yearsAgo} Jahren`} wart ihr heute...</SectionLabel>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {onThisDayMemoriesWithUrls.map((m) => m.url && (
                <div key={m.id} className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 120, height: 120 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" />
                  {m.caption && (
                    <div className="absolute inset-x-0 bottom-0 p-2" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.85), transparent)" }}>
                      <span style={{ color: "#F0EBE3", fontSize: "0.6rem" }}>{m.caption}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── KI-Empfehlung: nur eine Hauptempfehlung, keine konkurrierenden Vorschläge ── */}
        {recommendation && (
          <section className="mb-8">
            <SectionLabel>Empfehlung für heute</SectionLabel>
            <Card>
              <div style={{ color: "var(--foreground)", fontSize: "1rem", fontWeight: 400, marginBottom: "6px" }}>
                {recommendation.recommendation.title}
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                {recommendation.recommendation.description}
              </p>
              {recommendation.highlightTitle && (
                <p className="mt-3" style={{ color: "var(--accent)", fontSize: "0.68rem" }}>
                  Rund um euer Highlight heute: {recommendation.highlightTitle}
                </p>
              )}
              <CommitToJourneyButton
                tripId={activeTrip.id} tripSlug={activeTrip.slug} forDate={todayIso}
                eventTitle={recommendation.recommendation.title} label="In Journey übernehmen"
              />
            </Card>
          </section>
        )}

        {/* ── Alternative des Tages: EINE bewusst andere Option, kein zweiter Konkurrent ── */}
        {recommendation?.alternative && (
          <section className="mb-8">
            <SectionLabel>Alternative des Tages</SectionLabel>
            <Card>
              <div style={{ color: "var(--foreground)", fontSize: "0.92rem", fontWeight: 400, marginBottom: "6px" }}>
                {recommendation.alternative.title}
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
                {recommendation.alternative.description}
              </p>
              <CommitToJourneyButton
                tripId={activeTrip.id} tripSlug={activeTrip.slug} forDate={todayIso}
                eventTitle={recommendation.alternative.title} label="Alternative speichern"
              />
            </Card>
          </section>
        )}

        {/* ── Tagesstil-Auswahl: nur wenn kein Highlight erkannt und noch nicht gewählt ── */}
        {needsStyleChoice && (
          <section className="mb-8">
            <SectionLabel>Wie soll euer Tag heute sein?</SectionLabel>
            <Card>
              <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                Kein besonderes Highlight für heute erkannt — wählt einen Tagesstil, dann entwickelt der Concierge eine passende Empfehlung. Gilt bis Mitternacht.
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_STYLE_OPTIONS.map((opt) => (
                  <form key={opt.key} action={chooseTodayStyle}>
                    <input type="hidden" name="family_id" value={familyId} />
                    <input type="hidden" name="trip_id" value={activeTrip.id} />
                    <input type="hidden" name="for_date" value={todayIso} />
                    <input type="hidden" name="day_style" value={opt.key} />
                    <input type="hidden" name="date_label" value={dateLabel} />
                    <input type="hidden" name="location_label" value={currentLocation.label} />
                    <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
                    <input type="hidden" name="family_dna_text" value={familyDnaText} />
                    <input type="hidden" name="known_plan_text" value={knownPlanText} />
                    <button
                      type="submit"
                      style={{
                        background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)",
                        borderRadius: "20px", padding: "8px 16px", fontSize: "0.78rem", cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* ── Timeline — vollständig aus dem Journey Journal ── */}
        <section className="mb-8">
          <SectionLabel>Heutiger Tag</SectionLabel>
          {timelineItems.length > 0 ? (
            <Card>
              {timelineItems.map((item, idx) => {
                const isPast = item.time !== null && item.time < nowHHMM;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 py-3"
                    style={{ borderBottom: idx < timelineItems.length - 1 ? "1px solid var(--border)" : "none", opacity: isPast ? 0.45 : 1 }}
                  >
                    <item.icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>{item.title}</div>
                      {item.subtitle && <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{item.subtitle}</div>}
                    </div>
                    {item.time && <div style={{ color: "var(--muted)", fontSize: "0.72rem", flexShrink: 0 }}>{item.time}</div>}
                  </div>
                );
              })}
            </Card>
          ) : (
            <Card>
              <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Noch keine Programmpunkte für heute geplant.</p>
            </Card>
          )}
        </section>

        {/* ── Wetter: 5-Tage-Ausblick ── */}
        {weather && (
          <section className="mb-8">
            <SectionLabel>Wetter · 5-Tage-Ausblick</SectionLabel>
            <Card>
              <div className="grid grid-cols-5 gap-2">
                {weather.daily.map((d) => {
                  const info = describeWeatherCode(d.code);
                  const label = new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" });
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1">
                      <span style={{ color: "var(--muted)", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                      <info.icon size={16} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                      <span style={{ color: "var(--foreground)", fontSize: "0.72rem" }}>{d.tempMax}°</span>
                      <span style={{ color: "var(--muted)", fontSize: "0.64rem" }}>{d.tempMin}°</span>
                      {d.precipitationProbability !== null && (
                        <span style={{ color: "var(--muted)", fontSize: "0.6rem" }}>{d.precipitationProbability}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        )}

        {/* ── Morgen vorbereiten ── */}
        <section className="mb-8">
          <SectionLabel>Morgen vorbereiten</SectionLabel>
          <Card>
            {prepItems.length > 0 ? (
              <div className="space-y-3">
                {prepItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <item.icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{item.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Für morgen ist nichts Besonderes vorzubereiten.</p>
            )}
          </Card>
        </section>

        <FuerDichSection people={tripMemberDna} />

        {/* ── Fahrzeitanalyse: eingeklappt, nur reale Mietwagen-Daten ── */}
        {activeRentalCar && (activeRentalCar.details?.pickup_location || activeRentalCar.details?.dropoff_location) && (
          <section className="mb-8">
            <details className="rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <summary className="p-5 cursor-pointer flex items-center gap-3" style={{ color: "var(--foreground)", fontSize: "0.82rem", listStyle: "none" }}>
                <Car size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                Mietwagen heute
              </summary>
              <div className="px-5 pb-5" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                {activeRentalCar.details?.pickup_location && <div>Abholort: {activeRentalCar.details.pickup_location}</div>}
                {activeRentalCar.details?.dropoff_location && <div>Rückgabeort: {activeRentalCar.details.dropoff_location}</div>}
              </div>
            </details>
          </section>
        )}

        <EntdeckenPreview items={discoverPreview} />

        {/* ── Frag LUMI: vollständige, ehemals separate Concierge-Erfahrung ── */}
        <section className="mb-8">
          <SectionLabel>Frag LUMI</SectionLabel>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {EMBEDDED_QUICK_ACTIONS.map((qa) => {
              const QaIcon = QUICK_ACTION_ICONS[qa.key];
              return (
                <form key={qa.key} action={askConcierge}>
                  <input type="hidden" name="family_id" value={familyId} />
                  <input type="hidden" name="trip_id" value={activeTrip.id} />
                  <input type="hidden" name="trip_slug" value={activeTrip.slug} />
                  <input type="hidden" name="for_date" value={todayIso} />
                  <input type="hidden" name="date_label" value={dateLabel} />
                  <input type="hidden" name="location_label" value={currentLocation.label} />
                  <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
                  <input type="hidden" name="known_plan_text" value={knownPlanText} />
                  <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
                  <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
                  <input type="hidden" name="question_key" value={qa.key} />
                  <input type="hidden" name="question_text" value={qa.label} />
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2.5 text-left"
                    style={{
                      background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)",
                      borderRadius: "10px", padding: "12px 14px", fontSize: "0.76rem", cursor: "pointer",
                    }}
                  >
                    <QaIcon size={14} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    {qa.label}
                  </button>
                </form>
              );
            })}
          </div>

          <form action={askConcierge} className="rounded-xl overflow-hidden mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="trip_id" value={activeTrip.id} />
            <input type="hidden" name="trip_slug" value={activeTrip.slug} />
            <input type="hidden" name="for_date" value={todayIso} />
            <input type="hidden" name="date_label" value={dateLabel} />
            <input type="hidden" name="location_label" value={currentLocation.label} />
            <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
            <input type="hidden" name="known_plan_text" value={knownPlanText} />
            <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
            <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
            <input type="hidden" name="question_key" value="freetext" />
            <textarea
              name="question_text"
              rows={2}
              required
              placeholder="Frag LUMI etwas, z. B. Sollen wir bei diesem Wetter lieber drinnen bleiben?"
              style={{
                width: "100%", padding: "14px 16px", background: "transparent", border: "none", outline: "none",
                resize: "none", color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5, fontWeight: 300,
              }}
            />
            <div className="flex items-center justify-end px-4 pb-3">
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                  padding: "9px 18px", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                }}
              >
                LUMI fragen
              </button>
            </div>
          </form>

          {conciergeCards.map((card) => (
            <div key={card.key} className="rounded-xl p-6 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {card.questionLabel}
                </span>
              </div>
              <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: 400 }}>
                {card.title}
              </div>
              <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                {card.body}
              </p>

              {card.links.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {card.links.map((l, i) => (
                    <Link
                      key={i}
                      href={l.href}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                      style={{ background: "var(--background)", border: "1px solid var(--border)", textDecoration: "none" }}
                    >
                      <span style={{ color: "var(--foreground)", fontSize: "0.74rem" }}>{l.label}</span>
                      <ChevronRight size={12} strokeWidth={1.6} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    </Link>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>{formatTimestamp(card.timestamp)}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {card.showRefresh && (
                    <form action={refreshConciergeMessage}>
                      <input type="hidden" name="family_id" value={familyId} />
                      <input type="hidden" name="trip_id" value={activeTrip.id} />
                      <input type="hidden" name="trip_slug" value={activeTrip.slug} />
                      <input type="hidden" name="for_date" value={todayIso} />
                      <input type="hidden" name="date_label" value={dateLabel} />
                      <input type="hidden" name="location_label" value={currentLocation.label} />
                      <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
                      <input type="hidden" name="known_plan_text" value={knownPlanText} />
                      <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
                      <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
                      <input type="hidden" name="question_key" value={card.key} />
                      <input type="hidden" name="question_text" value={card.questionLabel} />
                      <button
                        type="submit"
                        className="flex items-center gap-1.5"
                        style={{
                          background: card.stale ? "rgba(184,154,94,0.12)" : "transparent",
                          color: card.stale ? "var(--accent)" : "var(--muted)",
                          border: card.stale ? "1px solid rgba(184,154,94,0.35)" : "1px solid var(--border)",
                          borderRadius: "20px", padding: "6px 12px", fontSize: "0.62rem", cursor: "pointer",
                        }}
                      >
                        <RefreshCw size={11} strokeWidth={1.6} />
                        {card.stale ? "Empfehlung aktualisieren" : "Änderung prüfen"}
                      </button>
                    </form>
                  )}
                  {card.canCommit && (
                    <CommitToJourneyButton
                      tripId={activeTrip.id} tripSlug={activeTrip.slug} forDate={todayIso}
                      eventTitle={card.eventTitle} label={card.commitLabel} className=""
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── Vault ausgelagert: kompakter Verweis auf die Reise ── */}
        <Link
          href={`/trips/${activeTrip.slug}`}
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
        >
          <span className="flex-1 min-w-0" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
            Zur Reise · Buchungen, Dokumente, Budget
          </span>
          <ChevronRight size={14} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
        </Link>

      </div>
    </div>
  );
}
