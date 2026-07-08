import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createStage } from "@/lib/actions/stages";

export default async function NewStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

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

        <div
          style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}
        >
          Neue Etappe
        </div>
        <h1
          className="font-light mb-8"
          style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}
        >
          Übernachtungsort hinzufügen
        </h1>

        <form action={createStage}>
          <input type="hidden" name="trip_id" value={trip.id} />
          <input type="hidden" name="slug" value={trip.slug} />

          <div
            className="rounded-xl p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label
                  htmlFor="stage-title"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Titel *
                </label>
                <input
                  id="stage-title"
                  name="title"
                  type="text"
                  required
                  placeholder="z. B. Guanacaste"
                  style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
                />
              </div>
              <div>
                <label
                  htmlFor="stage-location"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Ort
                </label>
                <input
                  id="stage-location"
                  name="location"
                  type="text"
                  placeholder="z. B. Guanacaste, Costa Rica"
                  style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <label
                  htmlFor="stage-start"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Von
                </label>
                <input
                  id="stage-start"
                  name="start_date"
                  type="date"
                  style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
              <div>
                <label
                  htmlFor="stage-end"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Bis
                </label>
                <input
                  id="stage-end"
                  name="end_date"
                  type="date"
                  style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
              <div>
                <label
                  htmlFor="stage-nights"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Nächte
                </label>
                <input
                  id="stage-nights"
                  name="nights"
                  type="number"
                  min={0}
                  style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
            </div>

            <div className="mb-5">
              <label
                htmlFor="stage-accommodation"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Unterkunft
              </label>
              <input
                id="stage-accommodation"
                name="accommodation"
                type="text"
                placeholder="z. B. Westin Reserva Conchal"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <div className="mb-8">
              <label
                htmlFor="stage-notes"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Notizen
              </label>
              <textarea
                id="stage-notes"
                name="notes"
                rows={3}
                placeholder="z. B. Strand, Natur, Entspannung"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 300, outline: "none", resize: "none" }}
              />
            </div>

            <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link
                href={`/trips/${trip.slug}`}
                style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
              >
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "12px 26px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Etappe speichern
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
