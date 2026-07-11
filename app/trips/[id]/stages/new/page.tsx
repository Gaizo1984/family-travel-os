import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createStage } from "@/lib/actions/stages";
import { StageDateFields } from "../StageDateFields";
import { Banner } from "@/components/Banner";

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
                placeholder="z. B. Dubai"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <StageDateFields />

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
                placeholder="z. B. Atlantis The Palm"
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
