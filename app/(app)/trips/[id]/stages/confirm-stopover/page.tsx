import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createStage } from "@/lib/actions/stages";
import { formatDateDE } from "@/lib/demo-data";
import { Banner } from "@/components/Banner";

export default async function ConfirmStopoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ location?: string; start?: string; end?: string; error?: string }>;
}) {
  const { id } = await params;
  const { location, start, end, error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip || !location || !start || !end) notFound();

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Zwischenstopp erkannt
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}>
          Zwischenstopp mit Übernachtung erkannt
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
          Zwischen zwei Flügen liegt eine Übernachtung in <strong style={{ color: "var(--foreground)", fontWeight: 500 }}>{location}</strong>{" "}
          ({formatDateDE(start)} – {formatDateDE(end)}), für die noch keine Etappe angelegt ist.
          Soll {location} als Etappe hinzugefügt werden?
        </p>

        <form action={createStage}>
          <input type="hidden" name="trip_id" value={trip.id} />
          <input type="hidden" name="slug" value={trip.slug} />
          <input type="hidden" name="start_date" value={start} />
          <input type="hidden" name="end_date" value={end} />
          <input type="hidden" name="accommodation" value="" />
          <input type="hidden" name="notes" value="Automatisch aus Flug-Zwischenstopp vorgeschlagen." />

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label
                htmlFor="stage-title"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Ziel *
              </label>
              <input
                id="stage-title"
                name="title"
                type="text"
                required
                defaultValue={location}
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
              Zeitraum: {formatDateDE(start)} – {formatDateDE(end)} (aus den Flugzeiten übernommen)
            </p>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link
                href={`/trips/${trip.slug}`}
                style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
              >
                Nicht jetzt
              </Link>
              <button
                type="submit"
                style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "12px 26px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Ja, Etappe hinzufügen
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
