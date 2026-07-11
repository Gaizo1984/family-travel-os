import Link from "next/link";
import {
  Clock, ArrowRight, Ticket, Car, Users, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isTripCurrentlyRunning } from "@/lib/trip-status";
import { sortStagesChronologically, buildJourneyTimeline } from "@/lib/journey";
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from "@/lib/journey";
import { sortBookingsChronologically } from "@/lib/bookings";
import { buildTodayTimelineItems, findNextUpcoming, buildTomorrowPrepItems, resolveCurrentLocation } from "@/lib/today";
import { getWeatherForLocation, describeWeatherCode } from "@/lib/weather";
import type { WeatherLocationCandidate } from "@/lib/weather";
import { generateTodayRecommendation } from "@/lib/today-ai";
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, TRAVEL_NEED_OPTIONS } from "@/lib/family-dna";
import { COUNTRY_STAGE_IMAGES, FALLBACK_STAGE_IMAGE } from "@/lib/stage-images";
import { COUNTRY_NAMES } from "@/lib/geo-suggestions";
import { todayIsoInFamilyTimezone, nowHHMMInFamilyTimezone } from "@/lib/time";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import type { JourneyEventCategory, JourneyEventStatus } from "@/lib/journey-events";

type FlightWithPasses = { id: string; title: string; slug: string };

/**
 * §7.2: prominenter Schnellzugriff auf Boardingpässe am Flugtag, ohne Umweg über
 * Reise → Flüge → Flugdetail. Nur relevant, wenn heute wirklich ein Abflug- oder
 * Ankunftstag ist UND für diesen Flug bereits mindestens ein Boardingpass
 * hochgeladen wurde — sonst bliebe der Zugriff leer/irreführend.
 */
async function findTodaysFlightWithBoardingPasses(): Promise<FlightWithPasses | null> {
  const supabase = await createClient();
  const todayIso = todayIsoInFamilyTimezone();

  const { data: flights } = await supabase
    .from("bookings")
    .select("id, title, start_datetime, end_datetime, trips ( slug )")
    .eq("type", "flight")
    .neq("status", "cancelled");

  const todaysFlights = (flights ?? [])
    .filter((f) => f.start_datetime?.slice(0, 10) === todayIso || f.end_datetime?.slice(0, 10) === todayIso)
    .map((f) => ({ id: f.id, title: f.title, slug: (f.trips as unknown as { slug: string } | null)?.slug ?? null }))
    .filter((f): f is FlightWithPasses => f.slug !== null);

  if (todaysFlights.length === 0) return null;

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

type PersonRow = { id: string; name: string };
type StageRow = {
  id: string; title: string; location: string | null; nights: number | null;
  start_date: string | null; end_date: string | null; accommodation: string | null;
  sort_order: number; country_code: string | null;
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

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id, name").limit(1).single();
  const familyId = family?.id ?? "";

  const todayIso = todayIsoInFamilyTimezone();
  const tomorrowIso = addDaysIso(todayIso, 1);
  const nowHHMM = nowHHMMInFamilyTimezone();

  const [{ data: trips }, flightToday] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status, start_date, end_date,
        trip_members ( persons ( id, name ) ),
        stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code ),
        bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at ),
        journey_events ( id, stage_id, date, time, category, title, location, status )
      `)
      .eq("family_id", familyId),
    findTodaysFlightWithBoardingPasses(),
  ]);

  // todayIso (Familienzeitzone) explizit übergeben, statt auf den UTC-basierten
  // Default von isTripCurrentlyRunning zu vertrauen — sonst könnte die "aktive
  // Reise"-Erkennung im selben ~2-Stunden-Fenster wie der Aktivitäten-Bug (s. u.)
  // von einem anderen Kalendertag ausgehen als der Rest dieser Seite.
  const activeTrip = ((trips ?? []) as unknown as TripRow[]).find((t) => isTripCurrentlyRunning(t, todayIso));

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

  // ── Kein aktiver Reisetag: kompakter, ehrlicher Leerzustand ──
  if (!activeTrip) {
    return (
      <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
        {flightBanner}
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9 w-full">
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            {dateLabel}
          </div>
          <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "-0.01em" }}>
            {greeting}
          </h1>
          <Card>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Aktuell läuft keine Reise. Sobald eine Reise begonnen hat, zeigt euch diese Seite hier
              Wetter, Tagesplan und alles Wichtige für heute.
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
  // Keine Kombination mehrerer Quellen zu einem Text wie "Atlanta, Costa Rica".
  const currentLocation = resolveCurrentLocation(activeTrip, stages, bookings, todayIso);
  const heroSubtitle = `📍 ${currentLocation.label}`;
  const heroPhoto = (currentLocation.countryCode && COUNTRY_STAGE_IMAGES[currentLocation.countryCode]) || FALLBACK_STAGE_IMAGE;

  // Wetter wird exakt für denselben Standort geladen: der aufgelöste Name zuerst,
  // mit Länder-Filter; schlägt die Geokodierung des genauen Namens fehl (z. B. bei
  // Hotelnamen oder unbekannten Kleinorten), zusätzlich das Land selbst als
  // verlässliche Näherung — ohne den angezeigten Standort-Text zu verändern.
  const countryName = currentLocation.countryCode ? COUNTRY_NAMES[currentLocation.countryCode] ?? null : null;
  const weatherCandidates: WeatherLocationCandidate[] = [
    { query: currentLocation.label, countryCode: currentLocation.countryCode },
    ...(countryName && countryName !== currentLocation.label ? [{ query: countryName }] : []),
  ];
  const weather = await getWeatherForLocation(weatherCandidates);
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

  const timelineItems = todayDay ? buildTodayTimelineItems(todayDay) : [];
  const nextUp = findNextUpcoming(timelineItems, nowHHMM);
  const prepItems = buildTomorrowPrepItems(tomorrowDay, stages, tomorrowIso);

  const dna = await buildFamilyDnaSummary(familyId);
  const tripMemberIds = new Set(activeTrip.trip_members.flatMap((m) => (m.persons ? [m.persons.id] : [])));
  const tripMemberDna = dna.persons.filter((p) => tripMemberIds.has(p.id) && (p.travel_needs.length > 0 || p.interest_tags.length > 0));

  const knownPlanText = timelineItems.map((i) => `${i.time ?? ""} ${i.title}`.trim()).join(", ");
  const weatherSummary = currentWeather ? `${weather!.currentTemp}°C, ${currentWeather.label}` : null;

  const recommendation = await generateTodayRecommendation({
    dateLabel,
    locationLabel: currentLocation.label,
    weatherSummary,
    familyDnaText: formatFamilyDnaForPrompt(dna, todayIso),
    knownPlanText,
  });

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroPhoto} alt={currentLocation.label} className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.6) 45%, rgba(10,9,7,0.18) 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 px-5 md:px-10 pb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: "10px" }}>
            {dateLabel}
          </div>
          <h1 className="text-3xl md:text-4xl font-light leading-tight mb-1" style={{ color: "#F0EBE3", letterSpacing: "-0.01em" }}>
            {greeting}
          </h1>
          <div className="mb-4" style={{ color: "#A89880", fontSize: "0.8rem" }}>{heroSubtitle}</div>

          {weather && (
            <div className="flex items-center gap-1.5 mb-4" style={{ color: "#A89880", fontSize: "0.72rem" }}>
              {currentWeather && <currentWeather.icon size={12} strokeWidth={1.6} />}
              <span>
                {weather.currentTemp}°C · {currentWeather?.label}
                {todayPrecipitation !== null && ` · ${todayPrecipitation}% Regen`}
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

        {/* ── KI-Empfehlung: eine große, zwei kleine ── */}
        {recommendation && (
          <section className="mb-8">
            <SectionLabel>Empfehlung für heute</SectionLabel>
            <Card className="mb-3">
              <div style={{ color: "var(--foreground)", fontSize: "1rem", fontWeight: 400, marginBottom: "6px" }}>
                {recommendation.mainRecommendation.title}
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                {recommendation.mainRecommendation.description}
              </p>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendation.alternatives.map((alt, i) => (
                <Card key={i}>
                  <div style={{ color: "var(--foreground)", fontSize: "0.85rem", marginBottom: "4px" }}>{alt.title}</div>
                  <p style={{ color: "var(--muted)", fontSize: "0.74rem", lineHeight: 1.5 }}>{alt.description}</p>
                </Card>
              ))}
            </div>
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

        {/* ── Familienhinweise (gebündelt) ── */}
        {tripMemberDna.length > 0 && (
          <section className="mb-8">
            <SectionLabel>Für die Familie mitgedacht</SectionLabel>
            <Card>
              <div className="space-y-3">
                {tripMemberDna.map((p) => {
                  const needLabels = p.travel_needs.map((k) => TRAVEL_NEED_OPTIONS.find((o) => o.key === k)?.label ?? k);
                  const allTags = [...needLabels, ...p.interest_tags];
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
        )}

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
