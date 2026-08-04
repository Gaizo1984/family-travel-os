import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pin, ArrowUp, ArrowDown, X, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  toggleVacationPostSelection, toggleVacationPostPinned, reorderVacationPostSelection,
  recurateVacationPostSelectionNow, deleteVacationPostSelection,
} from "@/lib/actions/image-check";
import { createContentSessionFromVacationPostSelection } from "@/lib/actions/content-sessions";
import { computeVacationPostExpiresAt, MAX_VACATION_POST_PHOTOS } from "@/lib/vacation-post-curation";
import { formatIsoFullDE } from "@/lib/date-utils";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { Banner } from "@/components/Banner";

const BUTTON_STYLE: React.CSSProperties = {
  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
  borderRadius: "20px", padding: "6px 12px", fontSize: "0.64rem", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: "4px", WebkitAppearance: "none", appearance: "none",
};
const ICON_BUTTON_STYLE: React.CSSProperties = {
  background: "var(--background)", border: "1px solid var(--border)", borderRadius: "6px",
  cursor: "pointer", display: "flex", padding: "6px", WebkitAppearance: "none", appearance: "none",
};

type Row = {
  id: string; storagePath: string; score: number | null; reasoning: string | null;
  rank: number | null; pinned: boolean;
};

/**
 * §"Urlaubsbeitrag aus dem Bild-Check": Verwaltungsansicht für die
 * reisebezogen gesammelte Vormerkung/Auswahl -- fixieren, entfernen,
 * austauschen (= entfernen + aufnehmen), Reihenfolge per Auf/Ab, neu
 * kuratieren, Auswahl löschen, Übergabe an die bestehende Beitragserstellung.
 * Kein Drag-and-Drop (Nutzer-Entscheidung: kein neues Paket, gleiches
 * Auf-/Ab-Muster wie im übrigen Content Studio).
 */
export default async function VacationPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tripId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, title, end_date").eq("id", tripId).maybeSingle();
  if (!trip) notFound();

  const { data: projectRows } = await supabase
    .from("content_projects").select("id").eq("trip_id", tripId).eq("project_type", "image_check");
  const projectIds = (projectRows ?? []).map((p) => p.id);

  const { data: photosRaw } = projectIds.length > 0
    ? await supabase
      .from("content_project_photos")
      .select("id, storage_path, vacation_post_score, vacation_post_reasoning, vacation_post_rank, vacation_post_pinned")
      .in("project_id", projectIds)
      .not("vacation_post_marked_at", "is", null)
    : { data: [] };

  const rows: Row[] = (photosRaw ?? []).map((p) => ({
    id: p.id, storagePath: p.storage_path, score: p.vacation_post_score, reasoning: p.vacation_post_reasoning,
    rank: p.vacation_post_rank, pinned: p.vacation_post_pinned,
  }));
  const urlByPath = await getPhotoDisplayUrls("documents", rows.map((r) => r.storagePath), "thumb400");

  const selected = rows.filter((r) => r.rank !== null).sort((a, b) => a.rank! - b.rank!);
  const pool = rows.filter((r) => r.rank === null);
  const isCurated = selected.length > 0;
  const expiresAtLabel = formatIsoFullDE(computeVacationPostExpiresAt(trip.end_date).slice(0, 10));

  function PhotoRow({ row, children }: { row: Row; children: React.ReactNode }) {
    const url = urlByPath.get(row.storagePath)?.url;
    return (
      <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: "var(--surface)", border: `1px solid ${row.pinned ? "rgba(184,154,94,0.5)" : "var(--border)"}` }}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="rounded-lg object-cover shrink-0" style={{ width: 64, height: 64 }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {row.rank !== null && (
              <span style={{ color: "var(--accent)", fontSize: "0.72rem" }}>#{row.rank}</span>
            )}
            {row.score !== null && (
              <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{row.score}/10</span>
            )}
            {row.pinned && (
              <span className="inline-flex items-center gap-1" style={{ color: "var(--accent)", fontSize: "0.62rem" }}>
                <Pin size={11} strokeWidth={1.8} /> Fixiert
              </span>
            )}
          </div>
          {row.reasoning && <p style={{ color: "var(--foreground)", fontSize: "0.74rem", lineHeight: 1.4 }}>{row.reasoning}</p>}
          <div className="flex items-center gap-2 flex-wrap mt-2">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/content-studio"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Content Studio
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Urlaubsbeitrag
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {trip.title}
        </h1>
        <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
          {isCurated
            ? `LUMI hat ${selected.length} von maximal ${MAX_VACATION_POST_PHOTOS} Bildern ausgewählt`
            : `${rows.length} von maximal ${MAX_VACATION_POST_PHOTOS} Bildern vorgemerkt -- noch nicht kuratiert`}
          {rows.length > 0 && ` · Temporär gespeichert bis ${expiresAtLabel}`}
        </p>

        {error && <Banner variant="error">{error}</Banner>}

        {rows.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Noch keine Bilder vorgemerkt -- im Bild-Check bei einem analysierten Foto auf &bdquo;Für Urlaubsbeitrag vormerken&ldquo; tippen.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <form action={recurateVacationPostSelectionNow}>
                <input type="hidden" name="trip_id" value={tripId} />
                <button type="submit" style={BUTTON_STYLE}><Sparkles size={12} strokeWidth={1.8} /> Neu kuratieren</button>
              </form>
              <form action={deleteVacationPostSelection}>
                <input type="hidden" name="trip_id" value={tripId} />
                <button type="submit" style={{ ...BUTTON_STYLE, color: "#B5624A", borderColor: "rgba(181,98,74,0.35)" }}>Auswahl löschen</button>
              </form>
            </div>

            {selected.length > 0 && (
              <section className="mb-8">
                <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                  Finale Auswahl
                </div>
                <div className="space-y-2.5">
                  {selected.map((row, idx) => (
                    <PhotoRow key={row.id} row={row}>
                      <form action={reorderVacationPostSelection}>
                        <input type="hidden" name="photo_id" value={row.id} />
                        <input type="hidden" name="trip_id" value={tripId} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" aria-label="Nach oben" disabled={idx === 0} style={{ ...ICON_BUTTON_STYLE, opacity: idx === 0 ? 0.35 : 1 }}>
                          <ArrowUp size={12} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
                        </button>
                      </form>
                      <form action={reorderVacationPostSelection}>
                        <input type="hidden" name="photo_id" value={row.id} />
                        <input type="hidden" name="trip_id" value={tripId} />
                        <input type="hidden" name="direction" value="down" />
                        <button type="submit" aria-label="Nach unten" disabled={idx === selected.length - 1} style={{ ...ICON_BUTTON_STYLE, opacity: idx === selected.length - 1 ? 0.35 : 1 }}>
                          <ArrowDown size={12} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
                        </button>
                      </form>
                      <form action={toggleVacationPostPinned}>
                        <input type="hidden" name="photo_id" value={row.id} />
                        <input type="hidden" name="trip_id" value={tripId} />
                        <button type="submit" aria-label="Fixieren" style={ICON_BUTTON_STYLE}>
                          <Pin size={12} strokeWidth={1.8} style={{ color: row.pinned ? "var(--accent)" : "var(--foreground)" }} />
                        </button>
                      </form>
                      <form action={toggleVacationPostSelection}>
                        <input type="hidden" name="photo_id" value={row.id} />
                        <input type="hidden" name="trip_id" value={tripId} />
                        <button type="submit" aria-label="Aus Auswahl entfernen" style={ICON_BUTTON_STYLE}>
                          <X size={12} strokeWidth={1.8} style={{ color: "#B5624A" }} />
                        </button>
                      </form>
                    </PhotoRow>
                  ))}
                </div>
              </section>
            )}

            {pool.length > 0 && (
              <section className="mb-8">
                <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                  Weitere vorgemerkte Bilder
                </div>
                <div className="space-y-2.5">
                  {pool.map((row) => (
                    <PhotoRow key={row.id} row={row}>
                      <form action={toggleVacationPostSelection}>
                        <input type="hidden" name="photo_id" value={row.id} />
                        <input type="hidden" name="trip_id" value={tripId} />
                        <button type="submit" style={BUTTON_STYLE}><Plus size={11} strokeWidth={1.8} /> In Auswahl aufnehmen</button>
                      </form>
                    </PhotoRow>
                  ))}
                </div>
              </section>
            )}

            {selected.length > 0 && (
              <form action={createContentSessionFromVacationPostSelection}>
                <input type="hidden" name="trip_id" value={tripId} />
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2"
                  style={{
                    background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                    padding: "13px 20px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase",
                    cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Instagram-Beitrag erstellen
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
