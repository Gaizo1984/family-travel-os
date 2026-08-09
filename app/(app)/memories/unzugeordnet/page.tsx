import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import { getFamily } from "@/lib/family";
import { assignMemoryPhotoToTrip, assignMemoryPhotoToAnyTrip } from "@/lib/actions/memories";
import { deriveTripDateRange, type TripDateRange } from "@/lib/trip-dates";
import { formatDateDE } from "@/lib/demo-data";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";

type PhotoRow = { id: string; storage_path: string; caption: string | null; taken_at: string | null; created_at: string };
type TripCandidate = { id: string; title: string; range: TripDateRange };
type PastTripCandidate = { id: string; label: string; year: number };
type Suggestion = { kind: "trip"; trip: TripCandidate; reason: string } | { kind: "past_trip"; pastTrip: PastTripCandidate; reason: string };

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

/**
 * §"Unsichere Fälle nicht raten, sondern in einer Reparaturliste anzeigen":
 * liefert NUR einen Anzeige-Vorschlag (nie eine automatische Zuordnung).
 * Exakter Datumsbereich-Treffer wird bevorzugt; sonst die zeitlich nächste
 * Reise, sofern eine mit ableitbarem Zeitraum existiert.
 */
function suggestTrip(takenAt: string | null, trips: TripCandidate[]): { trip: TripCandidate; reason: string } | null {
  if (!takenAt) return null;
  const withRange = trips.filter((t) => t.range.startDate && t.range.endDate);
  if (withRange.length === 0) return null;

  const exact = withRange.filter((t) => takenAt >= t.range.startDate! && takenAt <= t.range.endDate!);
  if (exact.length === 1) return { trip: exact[0], reason: "Aufnahmedatum liegt im Reisezeitraum" };

  const ranked = withRange
    .map((t) => ({ t, distance: Math.min(Math.abs(daysBetween(takenAt, t.range.startDate!)), Math.abs(daysBetween(takenAt, t.range.endDate!))) }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  if (!best || best.distance > 45) return null;
  return { trip: best.t, reason: `${best.distance} ${best.distance === 1 ? "Tag" : "Tage"} Abstand zum Reisezeitraum` };
}

/**
 * §Bugfix "Fotos manuell erfassten Reisen (past_trips) nicht zuordenbar"
 * (Nutzer-Feedback): past_trips haben kein exaktes Datum, nur `year` -- ein
 * Vorschlag ist deshalb nur möglich, wenn das Aufnahmejahr zu GENAU einer
 * past_trip der Familie passt (z. B. bei zwei Reisen desselben Jahres, wie
 * "Beide aus 2021", bleibt es bewusst bei "keine sichere Zuordnung", siehe
 * auch der manuelle Zuordnungs-Picker weiter unten für diese Fälle).
 */
function suggestPastTrip(takenAt: string | null, pastTrips: PastTripCandidate[]): { pastTrip: PastTripCandidate; reason: string } | null {
  if (!takenAt) return null;
  const year = Number(takenAt.slice(0, 4));
  const matches = pastTrips.filter((pt) => pt.year === year);
  return matches.length === 1 ? { pastTrip: matches[0], reason: `Aufnahmejahr ${year} passt zu dieser Reise` } : null;
}

export default async function UnassignedMemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const lumiCore = await createLumiCoreClient();
  const { id: familyId } = await getFamily();
  const returnTo = "/memories/unzugeordnet";

  const [{ data: photosRaw }, { data: tripsRaw }, { data: pastTripsRaw }] = await Promise.all([
    lumiCore
      .from("travel_memory_photos")
      .select("id, storage_path, caption, taken_at, created_at")
      .eq("household_id", familyId)
      .is("trip_id", null)
      .is("past_trip_id", null)
      .order("taken_at", { ascending: false, nullsFirst: false }),
    lumiCore
      .from("travel_trips")
      .select("id, title, start_date, end_date")
      .eq("household_id", familyId),
    lumiCore.from("travel_past_trips").select("id, country_or_region, year").eq("household_id", familyId),
  ]);

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings zwischen travel_*-Tabellen
  // -- Etappen/Buchungen je Reise flach nachgeladen und per Map wieder
  // zugeordnet, statt eines verschachtelten `trips`-Selects (siehe
  // app/(app)/today/page.tsx::fetchTripsForToday für dasselbe Muster).
  const tripIds = (tripsRaw ?? []).map((t) => t.id);
  const [{ data: stagesRaw }, { data: bookingsRaw }] = tripIds.length
    ? await Promise.all([
        lumiCore.from("travel_stages").select("trip_id, start_date, end_date").in("trip_id", tripIds),
        lumiCore.from("travel_bookings").select("trip_id, type, status, start_datetime, end_datetime").in("trip_id", tripIds),
      ])
    : [{ data: [] }, { data: [] }] as const;
  const stagesByTrip = new Map<string, { start_date: string | null; end_date: string | null }[]>();
  (stagesRaw ?? []).forEach((s) => stagesByTrip.set(s.trip_id, [...(stagesByTrip.get(s.trip_id) ?? []), { start_date: s.start_date, end_date: s.end_date }]));
  const bookingsByTrip = new Map<string, { type: string; status: string; start_datetime: string | null; end_datetime: string | null }[]>();
  (bookingsRaw ?? []).forEach((b) => bookingsByTrip.set(b.trip_id, [...(bookingsByTrip.get(b.trip_id) ?? []), { type: b.type, status: b.status, start_datetime: b.start_datetime, end_datetime: b.end_datetime }]));

  const photos = (photosRaw ?? []) as PhotoRow[];
  const trips: TripCandidate[] = (tripsRaw ?? []).map((t) => ({
    id: t.id, title: t.title,
    range: deriveTripDateRange(t, bookingsByTrip.get(t.id) ?? [], stagesByTrip.get(t.id) ?? []),
  }));
  const pastTrips: PastTripCandidate[] = (pastTripsRaw ?? [])
    .filter((pt): pt is typeof pt & { year: number } => pt.year != null)
    .map((pt) => ({ id: pt.id, label: `${pt.country_or_region} ${pt.year}`, year: pt.year }));

  // §"Egress-Analyse 2026-07-16": 72×72-Kachel -- Thumbnail statt Original.
  const displayByPath = await getPhotoDisplayUrls(LUMI_CORE_DOCUMENTS_BUCKET, photos.map((p) => p.storage_path), "thumb400");
  const photosWithUrls = photos.map((p) => {
    const resolved = displayByPath.get(p.storage_path);
    const tripSuggestion = suggestTrip(p.taken_at, trips);
    const pastTripSuggestion = !tripSuggestion ? suggestPastTrip(p.taken_at, pastTrips) : null;
    const suggestion: Suggestion | null = tripSuggestion
      ? { kind: "trip", ...tripSuggestion }
      : pastTripSuggestion ? { kind: "past_trip", ...pastTripSuggestion } : null;
    return { photo: p, url: resolved?.url ?? null, resolvedPath: resolved?.resolvedPath ?? p.storage_path, suggestion };
  });

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/memories"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Alle Erinnerungen
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Reparaturliste
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Nicht zugeordnete Erinnerungen
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          Diese Fotos haben keine Reise-Zuordnung. LUMI schlägt anhand des Aufnahmedatums höchstens eine
          mögliche Reise vor -- gespeichert wird eine Zuordnung erst, wenn du sie ausdrücklich bestätigst.
        </p>

        {error && <Banner variant="error">{error}</Banner>}

        {photosWithUrls.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Keine unzugeordneten Fotos -- alle Erinnerungen sind bereits einer Reise zugeordnet.
          </p>
        ) : (
          <div className="space-y-4">
            {photosWithUrls.map(({ photo, url, resolvedPath, suggestion }) => url && (
              <div key={photo.id} className="flex items-center gap-4 p-4 rounded-xl flex-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 72, height: 72 }}>
                  <SignedPhoto storagePath={resolvedPath} initialUrl={url} alt={photo.caption ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="flex-1" style={{ minWidth: "160px" }}>
                  <div style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>
                    {photo.taken_at ? formatDateDE(photo.taken_at) : "Kein Aufnahmedatum"}
                  </div>
                  {photo.caption && <div style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{photo.caption}</div>}
                  {suggestion ? (
                    <div className="mt-1" style={{ color: "var(--accent)", fontSize: "0.7rem" }}>
                      Vorschlag: {suggestion.kind === "trip" ? suggestion.trip.title : suggestion.pastTrip.label}{" "}
                      <span style={{ color: "var(--muted)" }}>({suggestion.reason})</span>
                    </div>
                  ) : (
                    <div className="mt-1" style={{ color: "var(--muted)", fontSize: "0.7rem", fontStyle: "italic" }}>
                      Keine sichere Zuordnung möglich
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {suggestion && suggestion.kind === "trip" && (
                    <form action={assignMemoryPhotoToTrip}>
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <input type="hidden" name="trip_id" value={suggestion.trip.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        style={{
                          background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                          borderRadius: "6px", padding: "9px 16px", fontSize: "0.62rem", letterSpacing: "0.08em",
                          textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                        }}
                      >
                        Dieser Reise zuordnen
                      </button>
                    </form>
                  )}
                  {suggestion && suggestion.kind === "past_trip" && (
                    <form action={assignMemoryPhotoToAnyTrip}>
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <input type="hidden" name="target" value={`past_trip:${suggestion.pastTrip.id}`} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        style={{
                          background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                          borderRadius: "6px", padding: "9px 16px", fontSize: "0.62rem", letterSpacing: "0.08em",
                          textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                        }}
                      >
                        Dieser Reise zuordnen
                      </button>
                    </form>
                  )}
                  {(trips.length > 0 || pastTrips.length > 0) && (
                    <form action={assignMemoryPhotoToAnyTrip} className="flex items-center gap-1.5">
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <select
                        name="target"
                        defaultValue=""
                        required
                        style={{
                          background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)",
                          borderRadius: "6px", padding: "8px 10px", fontSize: "0.68rem", maxWidth: "160px",
                        }}
                      >
                        <option value="" disabled>Andere Reise wählen …</option>
                        {trips.length > 0 && (
                          <optgroup label="Reisen">
                            {trips.map((t) => <option key={t.id} value={`trip:${t.id}`}>{t.title}</option>)}
                          </optgroup>
                        )}
                        {pastTrips.length > 0 && (
                          <optgroup label="Reisegeschichte">
                            {pastTrips.map((pt) => <option key={pt.id} value={`past_trip:${pt.id}`}>{pt.label}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <button
                        type="submit"
                        style={{
                          background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
                          borderRadius: "6px", padding: "8px 12px", fontSize: "0.62rem", letterSpacing: "0.04em",
                          cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                        }}
                      >
                        Zuordnen
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
