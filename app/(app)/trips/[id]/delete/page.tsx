import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteTripPermanently } from "@/lib/actions/trips";

export default async function DeleteTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, status")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const notArchived = trip.status !== "archived";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/trips?f=archiviert"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Archiv
        </Link>

        <div
          className="rounded-xl p-8"
          style={{ background: "var(--surface)", border: "1px solid rgba(181,98,74,0.3)" }}
        >
          <div
            style={{ color: "#B5624A", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}
          >
            Endgültig löschen
          </div>
          <h1
            className="font-light mb-5"
            style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}
          >
            &bdquo;{trip.title}&rdquo; unwiderruflich löschen?
          </h1>

          {notArchived ? (
            <p
              className="leading-relaxed mb-8"
              style={{ color: "var(--muted)", fontSize: "0.82rem" }}
            >
              Diese Reise ist nicht archiviert. Nur archivierte Reisen können endgültig gelöscht werden.
              Bitte zuerst über das Drei-Punkte-Menü archivieren.
            </p>
          ) : (
            <p
              className="leading-relaxed mb-8"
              style={{ color: "var(--muted)", fontSize: "0.82rem" }}
            >
              Die Reise und alle zugehörigen Daten — Etappen, Buchungen, Budget, Dokumente,
              Packlisten, Aufgaben und Tagebucheinträge — werden unwiderruflich gelöscht.
              Das kann nicht rückgängig gemacht werden.
            </p>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <Link
              href="/trips?f=archiviert"
              style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
            >
              Abbrechen
            </Link>
            {!notArchived && (
              <form action={deleteTripPermanently}>
                <input type="hidden" name="trip_id" value={trip.id} />
                <button
                  type="submit"
                  style={{
                    background: "#B5624A", color: "#F0EBE3", border: "none",
                    borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                    letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                    whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Ja, endgültig löschen
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
