import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deletePackingList } from "@/lib/actions/packing-items";

/**
 * §"Löschbutton für die Packliste" (Nutzervorgabe): eigene Bestätigungsseite
 * statt eines einzelnen destruktiven Klicks -- gleiches Muster wie das
 * endgültige Löschen einer Reise (app/(app)/trips/[id]/delete/page.tsx).
 * Löscht ALLE Gegenstände (manuell UND KI-generiert), nicht nur die
 * KI-generierten -- eine Packliste soll komplett neu gestartet werden können.
 */
export default async function DeletePackingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, slug, title").eq("slug", id).maybeSingle();
  if (!trip) notFound();

  const { count } = await supabase.from("packing_items").select("id", { count: "exact", head: true }).eq("trip_id", trip.id);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}/packing`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Packliste
        </Link>

        <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid rgba(181,98,74,0.3)" }}>
          <div style={{ color: "#B5624A", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Endgültig löschen
          </div>
          <h1 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}>
            Packliste für &bdquo;{trip.title}&rdquo; komplett löschen?
          </h1>
          <p className="leading-relaxed mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            {count ? `Alle ${count} Gegenstände` : "Alle Gegenstände"} dieser Packliste -- manuell hinzugefügte und von LUMI vorgeschlagene,
            unabhängig vom Status -- werden unwiderruflich gelöscht. Ein noch nicht übernommener Aktualisierungs-Entwurf wird ebenfalls verworfen.
            Das kann nicht rückgängig gemacht werden.
          </p>

          <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <Link href={`/trips/${trip.slug}/packing`} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
              Abbrechen
            </Link>
            <form action={deletePackingList}>
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="slug" value={trip.slug} />
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
          </div>
        </div>

      </div>
    </div>
  );
}
