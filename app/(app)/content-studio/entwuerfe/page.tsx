import Link from "next/link";
import { ChevronLeft, Trash2, Film, LayoutGrid, Image as ImageIcon, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { getFamily } from "@/lib/family";
import { deleteContentSessionProject } from "@/lib/actions/content-sessions";
import { deleteReelProject } from "@/lib/actions/content-reels";
import { CONTENT_FORMAT_LABELS } from "@/lib/content-session-limits";
import { REEL_STYLE_LABELS } from "@/lib/ai-style-guidelines";

const REEL_PROJECT_STATUS_LABELS: Record<string, string> = {
  uploading: "Medienauswahl", draft_created: "Storyboard erstellt",
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  uploading: "Fotos werden hochgeladen", ready_for_analysis: "Bereit zur Analyse",
  analyzing: "Wird analysiert", draft_created: "Entwurf erstellt", images_deleted: "Bilder gelöscht",
};

/** Icon je Format -- Alt-Formate (Tagesrückblick/Ausflug/Hotel/Paket/Reel-Textplan) fallen auf ein neutrales Icon zurück. */
function iconForSessionFormat(outputFormat: string | null): LucideIcon {
  if (outputFormat === "carousel") return LayoutGrid;
  if (outputFormat === "story") return ImageIcon;
  return FileText;
}

function formatDateDE(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type DraftListItem = {
  id: string; kind: "session" | "reel"; href: string; Icon: LucideIcon;
  tripLabel: string; typeLabel: string; statusLabel: string; updatedAt: string;
};

/**
 * §"Entwürfe fortsetzen soll ein eigenes Icon erhalten, darin sollen auch
 * abgeschlossene Projekte bis zur manuellen Löschung aufgeführt sein"
 * (Nutzervorgabe, wörtlich): eigene Seite statt Inline-Sektion auf dem Hub --
 * hält die Startseite kurz (mobile-first) und zeigt hier die VOLLSTÄNDIGE
 * Liste ohne künstliche Begrenzung (vorher .limit(6) je Typ auf dem Hub).
 * Beide Abfragen filtern bewusst NICHT nach status -- abgeschlossene
 * Projekte (status='draft_created') bleiben genauso sichtbar wie offene,
 * bis die Familie sie manuell löscht.
 */
export default async function ContentStudioDraftsPage() {
  const lumiCore = await createLumiCoreClient();
  const { id: familyId } = await getFamily();

  const [{ data: openSessions }, { data: reelProjects }] = await Promise.all([
    lumiCore
      .from("travel_content_projects")
      .select("id, title, trip_id, output_format, status, updated_at")
      .eq("household_id", familyId)
      .eq("project_type", "session")
      .order("updated_at", { ascending: false }),
    lumiCore
      .from("travel_content_projects")
      .select("id, title, trip_id, reel_style, reel_duration_seconds, status, updated_at")
      .eq("household_id", familyId)
      .eq("project_type", "reel")
      .order("updated_at", { ascending: false }),
  ]);

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings -- Reisetitel für beide
  // Projektlisten über eine gemeinsame flache Zusatzabfrage + Map.
  const allTripIds = [...(openSessions ?? []), ...(reelProjects ?? [])]
    .map((p) => p.trip_id)
    .filter((id): id is string => Boolean(id));
  const { data: draftTripsRaw } = allTripIds.length > 0
    ? await lumiCore.from("travel_trips").select("id, title").in("id", allTripIds)
    : { data: [] as { id: string; title: string }[] };
  const tripTitleById = new Map((draftTripsRaw ?? []).map((t) => [t.id, t.title]));

  const draftItems: DraftListItem[] = [
    ...(openSessions ?? []).map((s): DraftListItem => ({
      id: s.id, kind: "session", href: `/content-studio/session/${s.id}`,
      Icon: iconForSessionFormat(s.output_format),
      tripLabel: (s.trip_id && tripTitleById.get(s.trip_id)) ?? s.title,
      typeLabel: s.output_format ? (CONTENT_FORMAT_LABELS[s.output_format] ?? s.output_format) : "Format offen",
      statusLabel: SESSION_STATUS_LABELS[s.status] ?? s.status,
      updatedAt: s.updated_at,
    })),
    ...(reelProjects ?? []).map((p): DraftListItem => {
      const step = p.status === "draft_created" ? "timeline" : "media";
      return {
        id: p.id, kind: "reel", href: `/content-studio/reel/${p.id}/${step}`, Icon: Film,
        tripLabel: (p.trip_id && tripTitleById.get(p.trip_id)) ?? p.title,
        typeLabel: `${REEL_STYLE_LABELS[p.reel_style ?? ""] ?? p.reel_style} · ${p.reel_duration_seconds}s`,
        statusLabel: REEL_PROJECT_STATUS_LABELS[p.status] ?? p.status,
        updatedAt: p.updated_at,
      };
    }),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
          Entwürfe
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Alle Entwürfe & Reel-Projekte
        </h1>

        {draftItems.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Noch keine Entwürfe -- über Story, Beitrag oder Reel im Content Studio starten.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {draftItems.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center p-4 rounded-xl gap-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <item.Icon size={16} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <Link href={item.href} className="flex-1 min-w-0" style={{ textDecoration: "none" }}>
                  <div style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
                    {item.tripLabel} · {item.typeLabel}
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                    {item.statusLabel} · {formatDateDE(item.updatedAt)}
                  </span>
                </Link>
                <form action={item.kind === "reel" ? deleteReelProject : deleteContentSessionProject}>
                  <input type="hidden" name="project_id" value={item.id} />
                  <input type="hidden" name="return_to" value="/content-studio/entwuerfe" />
                  <button
                    type="submit"
                    aria-label="Entwurf löschen"
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px", color: "#B5624A" }}
                  >
                    <Trash2 size={14} strokeWidth={1.6} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
