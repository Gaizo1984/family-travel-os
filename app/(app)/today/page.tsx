import Link from "next/link";
import {
  Clock, ArrowRight, Ticket, Car, ChevronRight, Sparkles, Compass,
  FileQuestion, CloudSun, Shuffle, AlertTriangle, RefreshCw, Route, Plane, Hotel, Heart, Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { getFamily } from "@/lib/family";
import { isTripCurrentlyRunning, isTripHistorical, tripCountdownDisplay } from "@/lib/trip-status";
import { getTripDuration } from "@/lib/demo-data";
import { deriveTripDateRange } from "@/lib/trip-dates";
import { sortStagesChronologically, buildJourneyTimeline } from "@/lib/journey";
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from "@/lib/journey";
import { sortBookingsChronologically } from "@/lib/bookings";
import { buildTodayTimelineItems, findNextUpcoming, buildTomorrowPrepItems, resolveCurrentLocation, resolvePlanningLocation, nearbyStageGeocodeCandidates, detectDayHighlight } from "@/lib/today";
import { getWeatherForLocation, describeWeatherCode } from "@/lib/weather";
import type { WeatherLocationCandidate, WeatherResult } from "@/lib/weather";
import { getCachedTodayRecommendation } from "@/lib/today-recommendation";
import { generateTodayPlan } from "@/lib/actions/today-plan";
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from "@/lib/family-dna";
import { COUNTRY_STAGE_IMAGES, FALLBACK_STAGE_IMAGE, resolveStageImages } from "@/lib/stage-images";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { SignedPhoto } from "@/components/SignedPhoto";
import { COUNTRY_NAMES } from "@/lib/geo-suggestions";
import { todayIsoInFamilyTimezone, nowHHMMInFamilyTimezone } from "@/lib/time";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import type { JourneyEventCategory, JourneyEventStatus } from "@/lib/journey-events";
import { computeTripRequirements } from "@/lib/travel-requirements";
import type { TravelRequirement } from "@/lib/travel-requirements";
import { computeTripReadiness } from "@/lib/readiness";
import type { ReadinessFinding } from "@/lib/readiness";
import { askConcierge, refreshConciergeMessage, commitConciergeAction, deleteConciergeMessage, deleteAllConciergeMessages } from "@/lib/actions/concierge-actions";
import { listFamilyMemories } from "@/lib/family-memories";
import type { FamilyMemory } from "@/lib/family-memories";
import { MemoryCandidateCard } from "@/components/MemoryCandidateCard";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { TODAY_CATEGORIES } from "@/lib/today-categories";
import { resolveTripAiContext } from "@/lib/today-trip-context";
import { StopoverPlanningNotice } from "@/components/StopoverPlanningNotice";
import { scoreDestinations } from "@/lib/discover-scoring";
import type { ScoredDestination } from "@/lib/discover-scoring";
import { searchDestinations } from "@/lib/providers/destination-provider";
import { QUICK_ACTIONS, buildConciergeCards } from "@/lib/concierge";
import type { QuickActionKey, DisplayCard } from "@/lib/concierge";
import { listTodayConciergeMessages, buildContextFingerprint } from "@/lib/concierge-messages";
import type { CachedConciergeMessage } from "@/lib/concierge-messages";

type FlightWithPasses = { id: string; title: string; slug: string };

/**
 * §Performance-Audit: liest den Flugtag-Treffer aus den ohnehin schon
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

/** §"einheitliche Schriftgrößen/Letterspacing der Abschnittsüberschriften": `subline` optional, alle bisherigen Aufrufstellen (ohne subline) bleiben unverändert. */
function SectionLabel({ children, subline }: { children: React.ReactNode; subline?: string }) {
  return (
    <div className="mb-4">
      <h2
        className="text-xs font-medium"
        style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.62rem" }}
      >
        {children}
      </h2>
      {subline && (
        <p className="mt-1.5" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          {subline}
        </p>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

/** §Punkt 4 "Intelligente Hinweise": passive Anzeige der bestehenden Reisebereitschafts-Funde (Dokumente/Flüge/Hotels/Mietwagen/offene Aufgaben, lib/readiness.ts) -- vorher nur über Concierge-Schnellaktionen auf Klick erreichbar. */
function PersonalisierteHinweiseSection({ findings, tripSlug }: { findings: ReadinessFinding[]; tripSlug: string }) {
  if (findings.length === 0) return null;
  const top = [...findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "conflict" ? -1 : 1)).slice(0, 4);
  return (
    <section className="mb-8">
      <SectionLabel>Wichtig für eure Reise</SectionLabel>
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

/** §"Neue Reiseideen" wieder eingebettet: kompakte Vorschau derselben scoreDestinations()-Bewertung wie /discover, nicht dupliziert -- reasoning kommt direkt aus lib/discover-scoring.ts. */
function EntdeckenPreview({ items }: { items: ScoredDestination[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Neue Reiseideen</SectionLabel>
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

/** §Ein-Klick-Übernahme ins Journey: wiederverwendet commitConciergeAction 1:1 (lib/actions/concierge-actions.ts). */
function CommitToJourneyButton({ tripId, tripSlug, forDate, eventTitle, label, className = "mt-3" }: { tripId: string; tripSlug: string; forDate: string; eventTitle: string; label: string; className?: string }) {
  return (
    <form action={commitConciergeAction}>
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="trip_slug" value={tripSlug} />
      <input type="hidden" name="for_date" value={forDate} />
      <input type="hidden" name="event_title" value={eventTitle} />
      <input type="hidden" name="return_to" value="/today" />
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

/** §"Schnellaktionen (Icons)": ein Icon je QUICK_ACTIONS-Eintrag. */
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

/**
 * §"LUMI-Hauptbereich neu strukturiert" (Nutzervorgabe): die vormals unter
 * einer gemeinsamen "Entdecken für diese Reise"-Überschrift vermischten
 * reisespezifischen Kategorien, Reiseplanung und Frag LUMI sind jetzt drei
 * klar getrennte Bereiche -- reine Umsortierung bestehender Kacheln/Links,
 * keine Business-Logik-Änderung:
 *  1. `CategoryGrid`: TODAY_CATEGORIES (5, KI-Vorschlagskategorien) + Tagesplaner
 *     -- exakt 6 Kacheln, 3 Spalten × 2 Zeilen.
 *  2. `FragLumiCard`: vormals eine Kachel unter vielen, jetzt eine breite,
 *     leicht hervorgehobene Karte -- verlinkt weiterhin nur auf /concierge,
 *     keine neue Chat-/KI-Logik.
 *  3. `NextTripShortcutsGrid`: Neue Reiseideen/Hotelvergleich/Flugvergleich,
 *     eigener Abschnitt "Für eure nächste Reise", kompaktere Kachelvariante.
 * "Unsere Vorlieben" (weder Teil von 1 noch 2 noch 3, Nutzervorgabe) bekommt
 * einen eigenen kompakten Link direkt unter der Frag-LUMI-Karte.
 */
function GridTile({ href, label, Icon, compact }: { href: string; label: string; Icon: LucideIcon; compact?: boolean }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-xl text-center transition-opacity hover:opacity-80"
      style={{
        background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none",
        minHeight: compact ? 80 : 92, padding: compact ? "12px" : "16px",
      }}
    >
      <Icon size={compact ? 18 : 20} strokeWidth={1.3} style={{ color: "var(--accent)" }} />
      <span style={{ color: "var(--foreground)", fontSize: "0.72rem", fontWeight: 300 }}>{label}</span>
    </Link>
  );
}

const EXPLORE_EXTRA_SHORTCUT: { href: string; label: string; Icon: LucideIcon } = { href: "/today/plan", label: "Tagesplaner", Icon: Route };

const NEXT_TRIP_SHORTCUTS: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/discover", label: "Neue Reiseideen", Icon: Compass },
  { href: "/hotels", label: "Hotelvergleich", Icon: Hotel },
  { href: "/discover/flights", label: "Flugvergleich", Icon: Plane },
];

/** §Punkt 3 "Icon-Navigation", vollständig datengetrieben: eine Kachel je TODAY_CATEGORIES-Eintrag, kein hartkodiertes JSX pro Kategorie. */
function CategoryGrid() {
  return (
    <section className="mb-8">
      <SectionLabel subline="Orte, Erlebnisse und Ideen rund um eure aktuelle Reise">
        Entdecken für diese Reise
      </SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        {TODAY_CATEGORIES.map(({ key, label, Icon }) => (
          <GridTile key={key} href={`/today/category/${key}`} label={label} Icon={Icon} />
        ))}
        <GridTile href={EXPLORE_EXTRA_SHORTCUT.href} label={EXPLORE_EXTRA_SHORTCUT.label} Icon={EXPLORE_EXTRA_SHORTCUT.Icon} />
      </div>
    </section>
  );
}

/** §Frag LUMI aus dem Kachelraster gelöst: breite Premium-Card, verlinkt weiterhin nur auf die bestehende /concierge-Seite. */
function FragLumiCard() {
  return (
    <Link
      href="/concierge"
      className="flex items-center gap-4 rounded-xl p-5 transition-opacity hover:opacity-90"
      style={{ background: "var(--surface-2)", border: "1px solid rgba(184,154,94,0.35)", textDecoration: "none" }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: "var(--accent-subtle)" }}>
        <Sparkles size={20} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ color: "var(--foreground)", fontSize: "0.95rem", marginBottom: "3px" }}>Frag LUMI</div>
        <p style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          Plane euren Tag, kläre offene Fragen oder erhalte persönliche Empfehlungen für diese Reise.
        </p>
      </div>
      <ChevronRight size={18} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} />
    </Link>
  );
}

/** §"Unsere Vorlieben" (Nutzervorgabe): kompakter sekundärer Link direkt unter der Frag-LUMI-Karte, weder im Explore- noch im Next-Trip-Grid. */
function UnserePraeferenzenLink() {
  return (
    <Link href="/today/preferences" className="flex items-center gap-2.5 py-2 mt-3" style={{ textDecoration: "none" }}>
      <Heart size={14} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <span className="flex-1 min-w-0">
        <span style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>Unsere Vorlieben verwalten</span>
        <span className="block" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>Gespeicherte Reisepräferenzen ansehen und bearbeiten</span>
      </span>
      <ChevronRight size={12} strokeWidth={1.6} style={{ color: "var(--muted)", flexShrink: 0 }} />
    </Link>
  );
}

function NextTripShortcutsGrid() {
  return (
    <section className="mb-8">
      <SectionLabel subline="Inspiration, Flüge und Hotels für neue Reiseideen">
        Für eure nächste Reise
      </SectionLabel>
      <div className="grid grid-cols-3 gap-2.5">
        {NEXT_TRIP_SHORTCUTS.map(({ href, label, Icon }) => (
          <GridTile key={href} href={href} label={label} Icon={Icon} compact />
        ))}
      </div>
    </section>
  );
}

function LumiHauptbereich() {
  return (
    <>
      <CategoryGrid />
      <section className="mb-8">
        <FragLumiCard />
        <UnserePraeferenzenLink />
      </section>
      <NextTripShortcutsGrid />
    </>
  );
}

/** Kompakter 5-Tage-Streifen direkt im Hero (Punkt 1: Wetter zuerst sichtbar, nicht erst weiter unten). */
function WeatherStrip({ weather }: { weather: WeatherResult }) {
  return (
    <div className="flex gap-3 mt-4">
      {weather.daily.map((d) => {
        const info = describeWeatherCode(d.code);
        const label = new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" });
        return (
          <div key={d.date} className="flex flex-col items-center gap-0.5">
            <span style={{ color: "#A89880", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
            <info.icon size={14} strokeWidth={1.4} style={{ color: "#F0EBE3" }} />
            <span style={{ color: "#F0EBE3", fontSize: "0.68rem" }}>{d.tempMax}°</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; stopover?: string }>;
}) {
  const { error, stopover } = await searchParams;
  const preferStopover = stopover === "1";
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
        stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code, cover_photo_id, is_transit ),
        bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at ),
        journey_events ( id, stage_id, date, time, category, title, location, status )
      `)
      .eq("family_id", familyId),
    findOnThisDayMemories(familyId, todayIso),
    buildFamilyDnaSummary(familyId),
    supabase.from("past_trips").select("country_or_region").eq("family_id", familyId),
  ]);

  // §"Egress-Analyse 2026-07-16": 120×120-Kachel -- Thumbnail statt Original, gecachte Signed URL statt Neusignierung bei jedem Dashboard-Aufruf.
  const onThisDayDisplayByPath = await getPhotoDisplayUrls("documents", onThisDayMemories.map((m) => m.storagePath), "thumb400");
  const onThisDayMemoriesWithUrls = onThisDayMemories.map((m) => ({ ...m, url: onThisDayDisplayByPath.get(m.storagePath)?.url ?? null }));

  // todayIso (Familienzeitzone) explizit übergeben, statt auf den UTC-basierten
  // Default von isTripCurrentlyRunning zu vertrauen — sonst könnte die "aktive
  // Reise"-Erkennung im selben ~2-Stunden-Fenster wie der Aktivitäten-Bug (s. u.)
  // von einem anderen Kalendertag ausgehen als der Rest dieser Seite.
  // §"Reisezeitraum automatisch ableiten": start_date/end_date werden HIER
  // einmalig zentral (lib/trip-dates.ts) auf den abgeleiteten Zeitraum
  // (Buchungen/Etappen-Fallback) normalisiert -- alle nachfolgenden Stellen
  // dieser Seite (aktive Reise, nächste Reise, Dauer/Countdown, Journey-
  // Timeline) nutzen dadurch automatisch dieselbe Ableitung, ohne sie erneut
  // zu bauen.
  const allTrips = ((trips ?? []) as unknown as TripRow[]).map((t) => {
    const range = deriveTripDateRange(t, t.bookings, t.stages);
    return { ...t, start_date: range.startDate, end_date: range.endDate };
  });
  const activeTrip = allTrips.find((t) => isTripCurrentlyRunning(t, todayIso));
  const flightToday = await findTodaysFlightWithBoardingPasses(allTrips, todayIso);

  // §Punkt 1/2 "Was ist heute wichtig?" auch ohne laufende Reise: die
  // zeitlich nächste bevorstehende Reise (weder laufend noch historisch/archiviert).
  const upcomingTrips = allTrips
    .filter((t) => t.status !== "archived" && !isTripCurrentlyRunning(t, todayIso) && !isTripHistorical(t, todayIso))
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  const nextTrip = upcomingTrips[0] ?? null;
  const nextTripRequirements: TravelRequirement[] = nextTrip
    ? (await computeTripRequirements(nextTrip.id)).filter((r) => r.status !== "satisfied")
    : [];

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

  // ── Kein aktiver Reisetag, aber eine bevorstehende Reise: Wetter zuerst ──
  if (!activeTrip && nextTrip) {
    const nextContext = await resolveTripAiContext(nextTrip, false, todayIso);
    const nextTripDuration = nextTrip.start_date && nextTrip.end_date ? getTripDuration(nextTrip.start_date, nextTrip.end_date) : 0;
    const nextTripCountdown = tripCountdownDisplay(nextTrip, nextTripDuration, todayIso);
    const nextWeather = nextContext.weather;
    const nextWeatherInfo = nextWeather ? describeWeatherCode(nextWeather.currentCode) : null;
    const hasOnThisDay = onThisDayMemoriesWithUrls.some((m) => m.url);

    return (
      <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
        {flightBanner}

        {/* ── Hero: Wetter/Ort zuerst, ganz oben ── */}
        <div className="relative" style={{ height: "320px", flexShrink: 0 }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1714, #332c24)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.55) 55%, rgba(10,9,7,0.15) 100%)" }} />
          <div className="absolute inset-x-0 bottom-0 px-5 md:px-10 pb-8">
            <div className="mb-1" style={{ color: "#A89880", fontSize: "0.8rem" }}>📍 {nextContext.locationLabel}</div>
            {nextWeather && nextWeatherInfo && (
              <div className="flex items-center gap-1.5 mb-3" style={{ color: "#F0EBE3", fontSize: "0.95rem" }}>
                <nextWeatherInfo.icon size={16} strokeWidth={1.6} />
                {nextWeather.currentTemp}°C · {nextWeatherInfo.label}
              </div>
            )}
            <h1 className="text-2xl md:text-3xl font-light leading-tight mb-2" style={{ color: "#F0EBE3", letterSpacing: "-0.01em" }}>
              {nextTrip.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                {nextTripCountdown.value} {nextTripCountdown.label}
              </span>
            </div>
            {nextWeather && <WeatherStrip weather={nextWeather} />}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-8 w-full">
          {error && <Banner variant="error">{error}</Banner>}
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            {dateLabel}
          </div>
          <h2 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "-0.01em" }}>
            {greeting}
          </h2>

          {/* ── Heute: nur das Wichtigste ── */}
          {nextTripRequirements.length > 0 && (
            <section className="mb-8">
              <SectionLabel>Heute wichtig</SectionLabel>
              <Card>
                <div className="space-y-2.5">
                  {nextTripRequirements.map((r, i) => (
                    <Link key={i} href={r.actionHref ?? `/trips/${nextTrip.slug}`} className="flex items-center justify-between gap-2" style={{ textDecoration: "none" }}>
                      <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{r.reason}</span>
                      <ChevronRight size={12} strokeWidth={1.6} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    </Link>
                  ))}
                </div>
              </Card>
            </section>
          )}

          <Link
            href={`/trips/${nextTrip.slug}`}
            className="flex items-center gap-3 p-4 rounded-xl mb-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
          >
            <span className="flex-1 min-w-0" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
              Zur Reise · Buchungen, Dokumente, Budget
            </span>
            <ChevronRight size={14} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
          </Link>

          <LumiHauptbereich />

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
        </div>
      </div>
    );
  }

  // ── Gar keine Reise (weder aktiv noch bevorstehend): ehrlicher, ruhiger Leerzustand ──
  if (!activeTrip) {
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
          <Card>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Aktuell läuft keine Reise und keine ist geplant. Sobald eine Reise ansteht, zeigt euch
              LUMI hier Wetter, Countdown und alles Wichtige.
            </p>
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 mt-4"
              style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", textDecoration: "none" }}
            >
              Zu euren Reisen <ChevronRight size={13} strokeWidth={1.6} />
            </Link>
          </Card>
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
  // Bleibt bewusst unverändert der tatsächliche JETZIGE Aufenthaltsort (Hero-Bild,
  // 📍-Label, "Wetter gerade jetzt") -- siehe lib/today.ts::resolvePlanningLocation.
  const currentLocation = resolveCurrentLocation(activeTrip, stages, bookings, todayIso);
  const stageImages = await resolveStageImages(supabase, stages);
  const heroImage = (currentLocation.stageId && stageImages.get(currentLocation.stageId)) || {
    url: (currentLocation.countryCode && COUNTRY_STAGE_IMAGES[currentLocation.countryCode]) || FALLBACK_STAGE_IMAGE,
    storagePath: null,
  };

  const countryName = currentLocation.countryCode ? COUNTRY_NAMES[currentLocation.countryCode] ?? null : null;
  const weatherCandidates: WeatherLocationCandidate[] = [
    { query: currentLocation.label, countryCode: currentLocation.countryCode },
    ...nearbyStageGeocodeCandidates(stages, currentLocation.label, currentLocation.countryCode, todayIso),
    ...(countryName && countryName !== currentLocation.label ? [{ query: countryName }] : []),
  ];

  // §"Bereits heute Tipps/Planung fürs eigentliche Ziel möglich, Zwischenstopp-
  // Planung nur optional" (Nutzervorgabe, wörtlich): NUR die Tagesempfehlung
  // (weiter unten, generateAndCacheTodayRecommendation) nutzt bei einem kurzen
  // Zwischenstopp die vorausschauende Ziel-Etappe -- Hero/Wetter oben bleiben
  // unverändert der echte aktuelle Standort.
  const planningLocation = resolvePlanningLocation(currentLocation, stages, todayIso, preferStopover);
  // §Für den bidirektionalen Umschalter: unabhängig vom aktuellen `preferStopover`-
  // Zustand feststellen, ob die Situation überhaupt eine Zwischenstopp-Umschaltung
  // hergibt (sonst kein Banner nötig, egal welcher Toggle-Zustand) -- und das
  // "eigentliche Ziel"-Label auch dann kennen, wenn gerade preferStopover aktiv ist.
  const unforcedPlanningLocation = resolvePlanningLocation(currentLocation, stages, todayIso, false);
  const stopoverOverrideAvailable = unforcedPlanningLocation.isPlanningAheadOfStopover;
  const stopoverToggleHref = preferStopover ? "/today" : "/today?stopover=1";
  const stopoverBannerStopoverLabel = currentLocation.label;
  const stopoverBannerDestinationLabel = unforcedPlanningLocation.location.label;
  const planningCountryName = planningLocation.location.countryCode ? COUNTRY_NAMES[planningLocation.location.countryCode] ?? null : null;
  const planningWeatherCandidates: WeatherLocationCandidate[] = planningLocation.isPlanningAheadOfStopover
    ? [
        { query: planningLocation.location.label, countryCode: planningLocation.location.countryCode },
        ...nearbyStageGeocodeCandidates(stages, planningLocation.location.label, planningLocation.location.countryCode, todayIso),
        ...(planningCountryName && planningCountryName !== planningLocation.location.label ? [{ query: planningCountryName }] : []),
      ]
    : [];

  const timelineItems = todayDay ? buildTodayTimelineItems(todayDay) : [];
  const nextUp = findNextUpcoming(timelineItems, nowHHMM);
  const prepItems = buildTomorrowPrepItems(tomorrowDay, stages, tomorrowIso);
  const highlightTitle = detectDayHighlight(timelineItems);

  const [weather, planningWeather, cachedRecommendation] = await Promise.all([
    getWeatherForLocation(weatherCandidates),
    planningLocation.isPlanningAheadOfStopover ? getWeatherForLocation(planningWeatherCandidates) : Promise.resolve(null),
    getCachedTodayRecommendation(familyId, activeTrip.id, todayIso),
  ]);
  const currentWeather = weather ? describeWeatherCode(weather.currentCode) : null;
  const todayForecast = weather?.daily.find((d) => d.date === todayIso) ?? weather?.daily[0] ?? null;
  const todayPrecipitation = todayForecast?.precipitationProbability ?? null;

  const tripDuration = activeTrip.start_date && activeTrip.end_date ? getTripDuration(activeTrip.start_date, activeTrip.end_date) : 0;
  const dayCountdown = tripCountdownDisplay(activeTrip, tripDuration, todayIso);

  const knownPlanText = timelineItems.map((i) => `${i.time ?? ""} ${i.title}`.trim()).join(", ");
  const weatherSummary = currentWeather ? `${weather!.currentTemp}°C, ${currentWeather.label}` : null;
  // §Für die Tagesempfehlung: bei aktiver Vorausplanung Wetter/Ort des
  // eigentlichen Ziels statt des Zwischenstopps, sonst identisch zu oben.
  const planningWeatherDescribed = planningWeather ? describeWeatherCode(planningWeather.currentCode) : null;
  const planningLocationLabel = planningLocation.location.label;
  const planningWeatherSummary = planningLocation.isPlanningAheadOfStopover
    ? (planningWeatherDescribed ? `${planningWeather!.currentTemp}°C, ${planningWeatherDescribed.label}` : null)
    : weatherSummary;
  const familyDnaText = formatFamilyDnaForPrompt(dna, todayIso);
  const conciergeMemberNames = activeTrip.trip_members.flatMap((m) => (m.persons ? [m.persons.name] : []));

  // §"Wichtig: KI nur auf ausdrückliche Nutzeraktion": kein automatischer
  // Aufruf mehr bei erkanntem Highlight -- nur noch Lesezugriff auf den Cache,
  // die Generierung selbst passiert ausschließlich über den
  // "Tagesplanung erstellen"-Button (lib/actions/today-plan.ts).
  const recommendation = cachedRecommendation;

  const readiness = await computeTripReadiness(activeTrip.id);

  // §"Neue Reiseideen" wieder eingebettet: identischer Aufruf wie
  // app/(app)/discover/page.tsx (avoidNames aus past_trips + bereits
  // erlebten/laufenden Reisen), nur mit 3 statt 1 Treffer für die Vorschau.
  const avoidNames = [
    ...(pastTripsForAvoid ?? []).map((p) => p.country_or_region),
    ...allTrips.filter((t) => t.status === "completed" || t.status === "active").map((t) => t.title),
  ];
  const destinations = (await searchDestinations()) ?? [];
  const discoverPreview = scoreDestinations(destinations, dna, { avoidNames }).slice(0, 3);

  // §"Frag LUMI" wieder eingebettet: Kontextfelder direkt aus den ohnehin
  // schon vorhandenen Variablen dieser Seite, keine zweite Berechnung.
  const conciergeFingerprint = buildContextFingerprint(weatherSummary, knownPlanText);
  const recentConciergeMessages: CachedConciergeMessage[] = await listTodayConciergeMessages(
    familyId, activeTrip.id, todayIso, conciergeFingerprint,
  );
  // §"today_important" ausgeklammert: ihre einzige Wirkung (Tagesempfehlung
  // erzeugen/cachen) passiert bereits über den "Tagesplanung erstellen"-
  // Button weiter oben -- ein Klick hier wäre redundant.
  const EMBEDDED_QUICK_ACTIONS = QUICK_ACTIONS.filter((qa) => qa.key !== "today_important");
  const conciergeCards: DisplayCard[] = buildConciergeCards(null, recentConciergeMessages);

  // §"Frag-LUMI-Probleme beheben, Punkt 1" (Nutzervorgabe): dieselbe
  // Bestätigungskarte wie /concierge, hier zusätzlich im eingebetteten Panel
  // -- sonst würde ein hier erkannter Memory-Kandidat erst sichtbar, wenn die
  // Familie zufällig /concierge oder /today/preferences öffnet.
  const allPendingMemories = await listFamilyMemories(familyId, "pending");
  const pendingMemories: FamilyMemory[] = allPendingMemories.filter(
    (m) => m.tripId === null || m.tripId === activeTrip.id,
  );

  const activeRentalCar = bookings.find(
    (b) => b.type === "rental_car" && b.status !== "cancelled"
      && b.start_datetime && b.end_datetime
      && b.start_datetime.slice(0, 10) <= todayIso && b.end_datetime.slice(0, 10) >= todayIso,
  );

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
      {flightBanner}

      {/* ── Hero: Wetter/Ort zuerst, ganz oben ── */}
      <div className="relative" style={{ height: "420px", flexShrink: 0 }}>
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
          <div className="mb-1" style={{ color: "#A89880", fontSize: "0.8rem" }}>📍 {currentLocation.label}</div>
          {weather && (
            <div className="flex items-center gap-1.5 mb-3" style={{ color: "#F0EBE3", fontSize: "0.95rem" }}>
              {currentWeather && <currentWeather.icon size={16} strokeWidth={1.6} />}
              {weather.currentTemp}°C · {currentWeather?.label}
              {weather.rainStartsAt
                ? ` · Regen ab ${weather.rainStartsAt} Uhr`
                : todayPrecipitation !== null && ` · ${todayPrecipitation}% Regen`}
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-light leading-tight mb-2" style={{ color: "#F0EBE3", letterSpacing: "-0.01em" }}>
            {greeting}
          </h1>
          <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            {dateLabel} · {dayCountdown.value} {dayCountdown.label}
          </span>

          {weather && <WeatherStrip weather={weather} />}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-8 w-full">
        {error && <Banner variant="error">{error}</Banner>}

        {/* ── Heute: nur das Wichtigste ── */}
        <section className="mb-8">
          <SectionLabel>Was machen wir jetzt?</SectionLabel>
          <Card>
            {nextUp ? (
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

        {/* ── Timeline: Reservierungen/Tagesprogramm ── */}
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
          <Link
            href={`/trips/${activeTrip.slug}/journey`}
            className="inline-block mt-3"
            style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.04em", textDecoration: "none" }}
          >
            Vollständige Journey ansehen →
          </Link>
        </section>

        {/* ── "Heute empfiehlt LUMI": nur auf Klick, max. 1x täglich aus Cache ── */}
        <section className="mb-8">
          <SectionLabel>Heute empfiehlt LUMI</SectionLabel>
          {stopoverOverrideAvailable && (
            <StopoverPlanningNotice
              destinationLabel={stopoverBannerDestinationLabel}
              stopoverLabel={stopoverBannerStopoverLabel}
              preferStopover={preferStopover}
              toggleHref={stopoverToggleHref}
            />
          )}
          {recommendation ? (
            <>
              <Card>
                <div style={{ color: "var(--foreground)", fontSize: "1rem", fontWeight: 400, marginBottom: "6px" }}>
                  {recommendation.recommendation.title}
                </div>
                <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                  {recommendation.recommendation.description}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                  {recommendation.recommendation.suggestedTimeWindow && <span>🕐 {recommendation.recommendation.suggestedTimeWindow}</span>}
                  {recommendation.recommendation.weatherFit && <span>☀ {recommendation.recommendation.weatherFit}</span>}
                </div>
                <form action={commitConciergeAction}>
                  <input type="hidden" name="trip_id" value={activeTrip.id} />
                  <input type="hidden" name="trip_slug" value={activeTrip.slug} />
                  <input type="hidden" name="for_date" value={todayIso} />
                  <input type="hidden" name="event_title" value={recommendation.recommendation.title} />
                  <input type="hidden" name="return_to" value="/today" />
                  <button
                    type="submit"
                    style={{
                      background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                      borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
                    }}
                  >
                    In Tagesplan übernehmen
                  </button>
                </form>
              </Card>
              {recommendation.alternative && (
                <Card>
                  <div className="mt-3" style={{ color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                    Alternative
                  </div>
                  <div style={{ color: "var(--foreground)", fontSize: "0.9rem", marginBottom: "4px" }}>{recommendation.alternative.title}</div>
                  <p className="mb-2" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>{recommendation.alternative.description}</p>
                  {recommendation.alternative.weatherFit && (
                    <div style={{ color: "var(--muted)", fontSize: "0.66rem" }}>☀ {recommendation.alternative.weatherFit}</div>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card>
              <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                LUMI erstellt euch auf Wunsch einen Tagesplan aus Wetter, Reiseziel, Buchungen und euren Vorlieben.
              </p>
              <form action={generateTodayPlan}>
                <input type="hidden" name="family_id" value={familyId} />
                <input type="hidden" name="trip_id" value={activeTrip.id} />
                <input type="hidden" name="for_date" value={todayIso} />
                <input type="hidden" name="date_label" value={dateLabel} />
                <input type="hidden" name="location_label" value={planningLocationLabel} />
                <input type="hidden" name="weather_summary" value={planningWeatherSummary ?? ""} />
                <input type="hidden" name="family_dna_text" value={familyDnaText} />
                <input type="hidden" name="known_plan_text" value={knownPlanText} />
                <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
                <button
                  type="submit"
                  style={{
                    background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                    padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                  }}
                >
                  Tagesplanung erstellen
                </button>
              </form>
            </Card>
          )}

          {/* Schlechtwetter-Alternativen: dieselbe bestehende Concierge-Schnellaktion, Antwort erscheint unter Frag LUMI. */}
          <form action={askConcierge} className="mt-3">
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="trip_id" value={activeTrip.id} />
            <input type="hidden" name="trip_slug" value={activeTrip.slug} />
            <input type="hidden" name="for_date" value={todayIso} />
            <input type="hidden" name="date_label" value={dateLabel} />
            <input type="hidden" name="location_label" value={planningLocationLabel} />
            <input type="hidden" name="weather_summary" value={planningWeatherSummary ?? ""} />
            <input type="hidden" name="known_plan_text" value={knownPlanText} />
            <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
            <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
            <input type="hidden" name="question_key" value="find_alternative" />
            <input type="hidden" name="question_text" value="Alternative finden" />
            <input type="hidden" name="return_to" value="/today" />
            <button
              type="submit"
              style={{
                background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                borderRadius: "20px", padding: "8px 16px", fontSize: "0.68rem", cursor: "pointer",
              }}
            >
              Schlechtwetter-Alternativen
            </button>
          </form>
        </section>

        <LumiHauptbereich />

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

        {/* ── Frag LUMI: wieder eingebettet (mit Nutzer abgestimmt) ── */}
        <section className="mb-8">
          <SectionLabel>Frag LUMI</SectionLabel>

          {pendingMemories.length > 0 && (
            <div className="mb-3">
              {pendingMemories.map((m) => <MemoryCandidateCard key={m.id} memory={m} returnTo="/today" />)}
            </div>
          )}

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
                  <input type="hidden" name="location_label" value={planningLocationLabel} />
                  <input type="hidden" name="weather_summary" value={planningWeatherSummary ?? ""} />
                  <input type="hidden" name="known_plan_text" value={knownPlanText} />
                  <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
                  <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
                  <input type="hidden" name="question_key" value={qa.key} />
                  <input type="hidden" name="question_text" value={qa.label} />
                  <input type="hidden" name="return_to" value="/today" />
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
            <input type="hidden" name="location_label" value={planningLocationLabel} />
            <input type="hidden" name="weather_summary" value={planningWeatherSummary ?? ""} />
            <input type="hidden" name="known_plan_text" value={knownPlanText} />
            <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
            <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
            <input type="hidden" name="question_key" value="freetext" />
            <input type="hidden" name="return_to" value="/today" />
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

          {conciergeCards.length > 0 && (
            <div className="flex justify-end mb-2">
              <form action={deleteAllConciergeMessages}>
                <input type="hidden" name="family_id" value={familyId} />
                <input type="hidden" name="return_to" value="/today" />
                <ConfirmSubmitButton
                  label="Gesamten Verlauf löschen"
                  confirmMessage="Gesamten Frag-LUMI-Verlauf unwiderruflich löschen? Eure gespeicherten Vorlieben, Reisen, Buchungen und Journey-Daten bleiben davon unberührt."
                  style={{
                    background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
                    borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
                  }}
                />
              </form>
            </div>
          )}

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
              {/* §"Konkrete Empfehlungen" (Frag-LUMI-Fix Punkt 3): mehrteilige, strukturierte Antworten (Hauptempfehlung/Gründe/Nachteile/Alternative) kommen als \n\n-getrennte Absätze -- gleiche Aufteilung wie AnswerCard (app/(app)/concierge/page.tsx), sonst würden sie hier zu einem einzigen Fließtext verschmelzen. */}
              {card.body.split("\n\n").filter(Boolean).map((paragraph, i) => (
                <p key={i} className="mb-2" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                  {paragraph}
                </p>
              ))}

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
                      <input type="hidden" name="location_label" value={planningLocationLabel} />
                      <input type="hidden" name="weather_summary" value={planningWeatherSummary ?? ""} />
                      <input type="hidden" name="known_plan_text" value={knownPlanText} />
                      <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
                      <input type="hidden" name="member_names" value={conciergeMemberNames.join(",")} />
                      <input type="hidden" name="question_key" value={card.key} />
                      <input type="hidden" name="question_text" value={card.questionLabel} />
                      <input type="hidden" name="return_to" value="/today" />
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
                  <form action={deleteConciergeMessage}>
                    <input type="hidden" name="family_id" value={familyId} />
                    <input type="hidden" name="trip_id" value={activeTrip.id} />
                    <input type="hidden" name="for_date" value={todayIso} />
                    <input type="hidden" name="question_key" value={card.key} />
                    <input type="hidden" name="return_to" value="/today" />
                    <button
                      type="submit"
                      aria-label="Diese Frage löschen"
                      style={{
                        background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
                        borderRadius: "20px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center",
                      }}
                    >
                      <Trash2 size={12} strokeWidth={1.6} />
                    </button>
                  </form>
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
