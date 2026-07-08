import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { archiveTrip } from "@/lib/actions/trips";

export default async function ArchiveTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div
          className="rounded-xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}
          >
            Reise archivieren
          </div>
          <h1
            className="font-light mb-5"
            style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}
          >
            Möchtest du &bdquo;{trip.title}&rdquo; wirklich archivieren?
          </h1>
          <p
            className="leading-relaxed mb-8"
            style={{ color: "var(--muted)", fontSize: "0.82rem" }}
          >
            Sie verschwindet aus der aktiven Übersicht, kann später aber wiederhergestellt werden.
            Nichts wird gelöscht — Etappen, Buchungen und Dokumente bleiben erhalten.
          </p>

          <form action={archiveTrip} className="flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <input type="hidden" name="trip_id" value={trip.id} />
            <Link
              href={`/trips/${trip.slug}`}
              style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              style={{
                background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                borderRadius: "6px", padding: "12px 26px", fontSize: "0.65rem",
                letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Ja, archivieren
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
