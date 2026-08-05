import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadPackingItems, packingCategoryLabel } from "@/lib/packing-list";
import { computeRegenerationDiff, type GeneratedPackingItem, type PackingDiffEntry } from "@/lib/packing-list-generation";
import { applyPackingListDiff, discardPackingListDraft } from "@/lib/actions/packing-list-generation";
import { Banner } from "@/components/Banner";

const BUCKET_LABELS = {
  neu_vorgeschlagen: "Neu vorgeschlagen",
  geaendert: "Geänderte Menge oder Anforderung",
  nicht_mehr_erforderlich: "Nicht mehr erforderlich",
} as const;

function DiffGroup({ title, entries, defaultChecked }: { title: string; entries: PackingDiffEntry[]; defaultChecked: boolean }) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 400 }}>{title}</h2>
      <div className="space-y-2">
        {entries.map((entry) => (
          <label
            key={entry.key}
            className="flex items-start gap-3 rounded-xl p-4 cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <input type="checkbox" name="approved_keys" value={entry.key} defaultChecked={defaultChecked} style={{ accentColor: "var(--accent)", width: "16px", height: "16px", marginTop: "2px" }} />
            <div className="flex-1 min-w-0">
              <div style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
                {entry.label}{entry.quantity > 1 ? ` × ${entry.quantity}` : ""}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                {packingCategoryLabel(entry.category)} · {entry.personLabel === "gemeinsam" ? "Gemeinsam" : entry.personLabel}
              </div>
              {entry.reasoning && (
                <p className="mt-1" style={{ color: "var(--muted)", fontSize: "0.7rem", fontStyle: "italic" }}>{entry.reasoning}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

export default async function PackingListDiffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, slug, title").eq("slug", id).maybeSingle();
  if (!trip) notFound();

  const { data: draft } = await supabase.from("packing_list_drafts").select("items").eq("trip_id", trip.id).maybeSingle();

  if (!draft) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Kein Aktualisierungs-Entwurf vorhanden.</p>
            <Link href={`/trips/${trip.slug}/packing`} className="inline-flex items-center gap-1 mt-4" style={{ color: "var(--accent)", fontSize: "0.75rem", textDecoration: "none" }}>
              Zur Packliste
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: memberRows } = await supabase.from("trip_members").select("persons ( id, name )").eq("trip_id", trip.id);
  const participants = (memberRows ?? [])
    .map((m) => m.persons as unknown as { id: string; name: string } | null)
    .filter((p): p is { id: string; name: string } => Boolean(p));

  const existingItems = await loadPackingItems(supabase, trip.id);
  const generated = draft.items as GeneratedPackingItem[];
  const diff = computeRegenerationDiff(existingItems, generated, participants);

  const neu = diff.filter((d) => d.bucket === "neu_vorgeschlagen");
  const geaendert = diff.filter((d) => d.bucket === "geaendert");
  const nichtMehr = diff.filter((d) => d.bucket === "nicht_mehr_erforderlich");

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}/packing`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Packliste
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Aktualisierung
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Was hat sich geändert?
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          Bereits eingepackte oder manuell hinzugefügte Gegenstände bleiben in jedem Fall unverändert. Wählt aus, was übernommen werden soll.
        </p>

        {error && <Banner variant="error">{error}</Banner>}

        {diff.length === 0 ? (
          <div className="rounded-xl p-6 text-center mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Keine Änderungen gegenüber der bestehenden Packliste.</p>
          </div>
        ) : (
          <form action={applyPackingListDiff}>
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="slug" value={trip.slug} />

            <DiffGroup title={BUCKET_LABELS.neu_vorgeschlagen} entries={neu} defaultChecked />
            <DiffGroup title={BUCKET_LABELS.geaendert} entries={geaendert} defaultChecked />
            <DiffGroup title={BUCKET_LABELS.nicht_mehr_erforderlich} entries={nichtMehr} defaultChecked={false} />

            <div className="flex items-center justify-between mt-4" style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.7rem" }} />
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none",
                  borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                  letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                }}
              >
                Übernehmen
              </button>
            </div>
          </form>
        )}

        <form action={discardPackingListDraft} className="mt-4">
          <input type="hidden" name="trip_id" value={trip.id} />
          <input type="hidden" name="slug" value={trip.slug} />
          <button type="submit" style={{ background: "none", border: "none", padding: 0, color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.04em", cursor: "pointer" }}>
            Verwerfen
          </button>
        </form>
      </div>
    </div>
  );
}
