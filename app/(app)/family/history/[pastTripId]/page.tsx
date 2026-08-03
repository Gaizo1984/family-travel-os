import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPhotoDisplayUrl } from "@/lib/photo-thumbnails";

/**
 * §Bugfix "Reisegeschichte ist fehlgeleitet" (Nutzer-Feedback): bisher
 * existierte für past_trips (manuell erfasste, vor LUMI erlebte Reisen wie
 * "Malediven 2021") keine eigene Leseansicht -- jeder Link (Reisegeschichte-
 * Liste, Unsere Welt, Reisen-Übersicht, Erinnerungen-Galerie) führte direkt
 * auf die Bearbeiten-Seite. Diese neue Seite ist die fehlende Detailansicht;
 * "Bearbeiten" bleibt als expliziter, separater Schritt erreichbar.
 *
 * §"Man kann keine Flüge/Aktivitäten anlegen" (Nutzer-Feedback): kein Bug --
 * past_trips sind bewusst eine schlanke, von `trips` komplett getrennte
 * Datenform ohne Buchungen/Etappen/Journey (siehe lib/travel-world.ts,
 * supabase/migrations/20260711000013_phase7_family_content_ideas.sql). Diese
 * Seite macht das jetzt sichtbar, statt die Erwartung stillschweigend zu
 * enttäuschen.
 */
export default async function PastTripDetailPage({
  params,
}: {
  params: Promise<{ pastTripId: string }>;
}) {
  const { pastTripId } = await params;

  const supabase = await createClient();
  const { data: pastTrip } = await supabase
    .from("past_trips")
    .select("id, family_id, country_or_region, year, places, duration_days, note, photo_storage_path")
    .eq("id", pastTripId)
    .maybeSingle();

  if (!pastTrip) notFound();

  const { data: travelerRows } = await supabase
    .from("past_trip_travelers")
    .select("persons ( id, name, initials, color )")
    .eq("past_trip_id", pastTripId);
  const travelers = (travelerRows ?? [])
    .map((t) => t.persons as unknown as { id: string; name: string; initials: string; color: string } | null)
    .filter((p): p is { id: string; name: string; initials: string; color: string } => Boolean(p));

  const photoUrl = pastTrip.photo_storage_path
    ? (await getPhotoDisplayUrl("documents", pastTrip.photo_storage_path, "thumb800"))?.url ?? null
    : null;

  const subtitle = [pastTrip.places, pastTrip.duration_days ? `${pastTrip.duration_days} Tage` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family/history"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Reisegeschichte
        </Link>

        <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={pastTrip.country_or_region} className="w-full" style={{ maxHeight: 340, objectFit: "cover" }} />
          ) : (
            <div className="w-full flex items-center justify-center" style={{ height: 160, background: "linear-gradient(135deg, #1a1a1a, #333)" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Kein Foto hinterlegt</span>
            </div>
          )}

          <div className="p-6 md:p-8">
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
              Erlebt · {pastTrip.year} · Manuell erfasst
            </div>
            <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {pastTrip.country_or_region}
            </h1>
            {subtitle && (
              <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{subtitle}</p>
            )}

            {travelers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {travelers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    <span
                      className="inline-flex items-center justify-center rounded-full"
                      style={{ width: "18px", height: "18px", background: p.color, color: "#fff", fontSize: "0.55rem" }}
                    >
                      {p.initials}
                    </span>
                    <span style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>{p.name}</span>
                  </div>
                ))}
              </div>
            )}

            {pastTrip.note && (
              <p className="mb-6" style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                {pastTrip.note}
              </p>
            )}

            <div
              className="rounded-lg px-4 py-3 mb-6"
              style={{ background: "rgba(184,154,94,0.08)", border: "1px solid rgba(184,154,94,0.25)" }}
            >
              <p style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
                Diese Reise wurde vor der Nutzung von LUMI unternommen und manuell erfasst — Flüge, Aktivitäten, Buchungen und Tagesplanung
                sind für solche Einträge nicht verfügbar. Nur Land/Region, Jahr, Reisende, ein Foto und eine Notiz werden gespeichert.
              </p>
            </div>

            <Link
              href={`/family/history/${pastTrip.id}/edit`}
              className="inline-flex items-center gap-2"
              style={{
                background: "var(--foreground)", color: "var(--surface)", border: "none",
                borderRadius: "6px", padding: "10px 18px", fontSize: "0.65rem", letterSpacing: "0.14em",
                textTransform: "uppercase", textDecoration: "none",
              }}
            >
              <Pencil size={12} strokeWidth={1.8} />
              Bearbeiten
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
