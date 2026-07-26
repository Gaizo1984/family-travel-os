import Link from "next/link";
import { after } from "next/server";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, ImagePlus, Settings, MapPin, Wand2, Clapperboard, Clock, Gauge, Trash2, Film,
  LayoutGrid, Image as ImageIcon, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildContentStrategyContext } from "@/lib/content-strategy-context";
import { getCachedContentStrategy, generateAndCacheContentStrategy } from "@/lib/content-strategy";
import { regenerateContentStrategy } from "@/lib/actions/content-strategy-actions";
import { deleteContentSessionProject } from "@/lib/actions/content-sessions";
import { deleteReelProject } from "@/lib/actions/content-reels";
import { CONTENT_FORMAT_LABELS } from "@/lib/content-session-limits";
import { REEL_STYLE_LABELS } from "@/lib/ai-style-guidelines";
import { cleanupExpiredContentSessionPhotos } from "@/lib/content-session-cleanup";
import { cleanupExpiredReelVideos } from "@/lib/reel-video-cleanup";

const REEL_PROJECT_STATUS_LABELS: Record<string, string> = {
  uploading: "Medienauswahl", draft_created: "Storyboard erstellt",
};

const STEPS = [
  { Icon: MapPin, label: "Format & Reise wählen" },
  { Icon: ImagePlus, label: "Bilder hochladen" },
  { Icon: Wand2, label: "KI erstellt Entwurf" },
];

const SESSION_STATUS_LABELS: Record<string, string> = {
  uploading: "Fotos werden hochgeladen", ready_for_analysis: "Bereit zur Analyse",
  analyzing: "Wird analysiert", draft_created: "Entwurf erstellt", images_deleted: "Bilder gelöscht",
};

/** §"Drei visuelle Einstiegskacheln analog zum LUMI-Bereich": Beitrag/Story
 * routen ins bestehende Session-Formular (Format per Query-Param
 * vorausgewählt), Reel bleibt der eigene, bestehende Flow. */
const FORMAT_TILES: { key: string; label: string; href: string; Icon: LucideIcon }[] = [
  { key: "story", label: "Story", href: "/content-studio/session/new?format=story", Icon: ImageIcon },
  { key: "carousel", label: "Beitrag", href: "/content-studio/session/new?format=carousel", Icon: LayoutGrid },
  { key: "reel", label: "Reel", href: "/content-studio/reel/new", Icon: Film },
];

/** Icon je Format für die zusammengeführte Entwürfe-Liste -- Alt-Formate (Tagesrückblick/Ausflug/Hotel/Paket/Reel-Textplan) fallen auf ein neutrales Icon zurück. */
function iconForSessionFormat(outputFormat: string | null): LucideIcon {
  if (outputFormat === "carousel") return LayoutGrid;
  if (outputFormat === "story") return ImageIcon;
  return FileText;
}

function formatDateDE(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** §"Vorschlag umsetzen": ordnet den KI-Freitext-Content-Typ (z.B. "Reel", "Carousel", "Foto-Story") einem der drei bestehenden Einstiege zu -- Beitrag als sicherer Standardfall. */
function resolveStrategyEntryHref(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("reel")) return "/content-studio/reel/new";
  if (lower.includes("story")) return "/content-studio/session/new?format=story";
  return "/content-studio/session/new?format=carousel";
}

type DraftListItem = {
  id: string; kind: "session" | "reel"; href: string; Icon: LucideIcon;
  tripLabel: string; typeLabel: string; statusLabel: string; updatedAt: string;
};

export default async function ContentStudioPage() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // §"Kontrollierter Cleanup beim Öffnen des Content Studios" -- zusätzliche
  // Absicherung neben dem Vercel-Cron (app/api/cron/cleanup-content-sessions),
  // kein Ersatz dafür. Läuft nach dem Response im Hintergrund, damit niemand
  // auf die Bereinigung warten muss.
  after(async () => {
    try {
      await cleanupExpiredContentSessionPhotos();
    } catch {
      // bewusst verschluckt -- der Cron-Job übernimmt beim nächsten Lauf ohnehin
    }
    try {
      await cleanupExpiredReelVideos();
    } catch {
      // bewusst verschluckt -- der Cron-Job übernimmt beim nächsten Lauf ohnehin
    }
  });

  // §"Nur noch EIN Einstieg 'Content erstellen'": statt eines separaten
  // "aktives Projekt"-Blocks (früher an die jetzt entfernte "Content-Idee
  // erstellen" gekoppelt) zeigt der Hub jetzt offene Content-Sessions als
  // "Entwürfe fortsetzen" -- alle drei Abfragen hängen nur von familyId ab,
  // parallel statt seriell geladen.
  const [{ data: openSessions }, { data: reelProjects }, { data: recentIdeas }, strategyContext] = await Promise.all([
    supabase
      .from("content_projects")
      .select("id, title, trip_id, output_format, status, updated_at, trips(title)")
      .eq("family_id", familyId)
      .eq("project_type", "session")
      .order("updated_at", { ascending: false })
      .limit(6),
    // §"Angefangene oder abgeschlossene Reel-Projekte sollten erneut
    // aufrufbar sein" (Nutzervorgabe, wörtlich): bisher gab es dafür gar
    // keine Übersicht -- jeder Klick auf "Reel erstellen" legte ein neues,
    // unabhängiges Projekt an, ohne je zu bereits begonnenen zurückzufinden.
    supabase
      .from("content_projects")
      .select("id, title, trip_id, reel_style, reel_duration_seconds, status, updated_at, trips(title)")
      .eq("family_id", familyId)
      .eq("project_type", "reel")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("content_ideas")
      .select("id, content_goal, status, trip_id, trips(title)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(3),
    buildContentStrategyContext(familyId),
  ]);

  // §"Entwürfe fortsetzen und Reel-Projekte fortsetzen in einer gemeinsamen
  // Sektion zusammenführen" (Nutzervorgabe, wörtlich): beide Abfragen bleiben
  // unverändert (unterschiedliche project_type-Filter), nur die Anzeige wird
  // zu EINER, nach Bearbeitungsdatum sortierten Liste gemappt.
  const draftItems: DraftListItem[] = [
    ...(openSessions ?? []).map((s): DraftListItem => ({
      id: s.id, kind: "session", href: `/content-studio/session/${s.id}`,
      Icon: iconForSessionFormat(s.output_format),
      tripLabel: (s.trips as unknown as { title: string } | null)?.title ?? s.title,
      typeLabel: s.output_format ? (CONTENT_FORMAT_LABELS[s.output_format] ?? s.output_format) : "Format offen",
      statusLabel: SESSION_STATUS_LABELS[s.status] ?? s.status,
      updatedAt: s.updated_at,
    })),
    ...(reelProjects ?? []).map((p): DraftListItem => {
      const step = p.status === "draft_created" ? "timeline" : "media";
      return {
        id: p.id, kind: "reel", href: `/content-studio/reel/${p.id}/${step}`, Icon: Film,
        tripLabel: (p.trips as unknown as { title: string } | null)?.title ?? p.title,
        typeLabel: `${REEL_STYLE_LABELS[p.reel_style ?? ""] ?? p.reel_style} · ${p.reel_duration_seconds}s`,
        statusLabel: REEL_PROJECT_STATUS_LABELS[p.status] ?? p.status,
        updatedAt: p.updated_at,
      };
    }),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // §"Vom Ideengenerator zum Content Director": nur EINE "Today's Content
  // Strategy" gleichzeitig, einmal pro Tag generiert und zwischengespeichert
  // (wie die Heute-Tagesplanung) — nur relevant, wenn gerade eine Reise läuft.
  let strategy = strategyContext
    ? await getCachedContentStrategy(familyId, strategyContext.tripId, strategyContext.forDate)
    : null;
  if (!strategy && strategyContext) {
    strategy = await generateAndCacheContentStrategy(
      familyId, strategyContext.tripId, strategyContext.forDate,
      {
        dateLabel: strategyContext.dateLabel, locationLabel: strategyContext.locationLabel,
        weatherSummary: strategyContext.weatherSummary, knownPlanText: strategyContext.knownPlanText,
        highlightTitle: strategyContext.highlightTitle,
      },
      false,
    );
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
              Content Studio
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              Verwandle eure Reise in Posts, Reels & Erinnerungen.
            </h1>
          </div>
          <Link href="/content-studio/settings" style={{ color: "var(--muted)" }}>
            <Settings size={16} strokeWidth={1.5} />
          </Link>
        </div>

        <div className="flex items-center gap-6 mb-8" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--foreground)", borderBottom: "1px solid var(--accent)", paddingBottom: "14px", marginBottom: "-15px" }}>
            Content erstellen
          </span>
          <Link href="/content-studio/posting-plan" style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>
            Content-Fahrplan
          </Link>
        </div>

        {strategyContext && strategy && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--accent)" }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Clapperboard size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--accent)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                  Heute empfiehlt LUMI · {strategy.contentType}
                </span>
              </div>
            </div>

            <p className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem", lineHeight: 1.5 }}>
              {strategy.storyline}
            </p>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>
              {strategy.reasoning}
            </p>

            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
              Shotliste
            </div>
            <ul className="mb-4 space-y-1.5">
              {strategy.shotlist.map((shot, i) => (
                <li key={i} className="flex items-start gap-2" style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0 }}>{i + 1}.</span>
                  {shot}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-5 flex-wrap mb-5" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
              <div className="flex items-center gap-1.5">
                <Clock size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
                {strategy.bestTime}
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
                Aufwand: {strategy.effort}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href={resolveStrategyEntryHref(strategy.contentType)}
                style={{
                  background: "var(--accent)", color: "var(--surface)", border: "1px solid var(--accent)",
                  borderRadius: "6px", padding: "9px 16px", fontSize: "0.62rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", textDecoration: "none",
                }}
              >
                Vorschlag umsetzen
              </Link>
              <form action={regenerateContentStrategy}>
                <input type="hidden" name="family_id" value={familyId} />
                <input type="hidden" name="trip_id" value={strategyContext.tripId} />
                <input type="hidden" name="for_date" value={strategyContext.forDate} />
                <input type="hidden" name="date_label" value={strategyContext.dateLabel} />
                <input type="hidden" name="location_label" value={strategyContext.locationLabel} />
                <input type="hidden" name="weather_summary" value={strategyContext.weatherSummary ?? ""} />
                <input type="hidden" name="known_plan_text" value={strategyContext.knownPlanText} />
                <input type="hidden" name="highlight_title" value={strategyContext.highlightTitle ?? ""} />
                <button
                  type="submit"
                  style={{
                    background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                    borderRadius: "6px", padding: "8px 16px", fontSize: "0.62rem", letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Andere Strategie
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mb-6" style={{ color: "var(--muted)" }}>
          {STEPS.map(({ Icon, label }, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 32, height: 32, background: "var(--accent-subtle)" }}
                >
                  <Icon size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                </div>
                <span style={{ fontSize: "0.62rem", letterSpacing: "0.02em", textAlign: "center" }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight size={12} strokeWidth={1.5} style={{ flexShrink: 0, marginBottom: "18px" }} />}
            </div>
          ))}
        </div>

        {/* §"Drei zentrale, visuelle Einstiegskacheln mit Icons analog zum
            LUMI-Bereich: Story, Beitrag, Reel" (Nutzervorgabe, wörtlich):
            ersetzt die frühere generische "Content erstellen"-Kachel und die
            separate "Reel erstellen"-Zeile. */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {FORMAT_TILES.map(({ key, label, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className="flex flex-col items-center justify-center gap-2 rounded-xl text-center transition-opacity hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none", minHeight: 92, padding: "16px" }}
            >
              <Icon size={20} strokeWidth={1.3} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--foreground)", fontSize: "0.72rem", fontWeight: 300 }}>{label}</span>
            </Link>
          ))}
        </div>

        {/* §"Entwürfe fortsetzen und Reel-Projekte fortsetzen in einer
            gemeinsamen Sektion zusammenführen" (Nutzervorgabe, wörtlich):
            eine Liste, ein Kartenmuster, Icon je Format. */}
        {draftItems.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Entwürfe fortsetzen
            </h2>
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
                    <input type="hidden" name="return_to" value="/content-studio" />
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
          </div>
        )}

        {(recentIdeas ?? []).length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Frühere Ideen (Archiv)
              </h2>
              <Link href="/content-studio/ideas" style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.08em", textDecoration: "none" }}>
                Alle Ideen ansehen →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(recentIdeas ?? []).map((idea) => (
                <Link
                  key={idea.id}
                  href={`/content-studio/ideas/${idea.id}`}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
                    {(idea.trips as unknown as { title: string } | null)?.title ?? "Reise"}{idea.content_goal ? ` · ${idea.content_goal}` : ""}
                  </span>
                  <ArrowRight size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
