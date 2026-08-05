import Link from "next/link";
import { after } from "next/server";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, ImagePlus, Settings, MapPin, Wand2, Clapperboard, Clock, Gauge, Film,
  LayoutGrid, Image as ImageIcon, FolderOpen, ScanSearch,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildContentStrategyContext } from "@/lib/content-strategy-context";
import { getCachedContentStrategy, generateAndCacheContentStrategy } from "@/lib/content-strategy";
import { regenerateContentStrategy } from "@/lib/actions/content-strategy-actions";
import { cleanupExpiredContentSessionPhotos } from "@/lib/content-session-cleanup";
import { cleanupExpiredReelVideos } from "@/lib/reel-video-cleanup";
import { loadJob } from "@/lib/ai-generation-jobs";
import { PendingGenerationView } from "@/components/PendingGenerationView";
import { Banner } from "@/components/Banner";

const STEPS = [
  { Icon: MapPin, label: "Format & Reise wählen" },
  { Icon: ImagePlus, label: "Bilder hochladen" },
  { Icon: Wand2, label: "KI erstellt Entwurf" },
];

/** §"Icons oberhalb des Content-Fahrplans" (Nutzervorgabe, wörtlich):
 * visuelle Einstiegskacheln analog zum LUMI-Bereich, in zwei Reihen getrennt
 * nach Zweck. Story/Beitrag routen ins bestehende Session-Formular (Format
 * per Query-Param vorausgewählt), Reel bleibt der eigene, bestehende Flow. */
const CONTENT_FORMAT_TILES: { key: string; label: string; href: string; Icon: LucideIcon }[] = [
  { key: "story", label: "Story", href: "/content-studio/session/new?format=story", Icon: ImageIcon },
  { key: "carousel", label: "Beitrag", href: "/content-studio/session/new?format=carousel", Icon: LayoutGrid },
  { key: "reel", label: "Reel", href: "/content-studio/reel/new", Icon: Film },
];

/** §"Entwürfe fortsetzen als eigenes Icon" + "Bild-Check als neues Tool/neue
 * Kachel" (Nutzervorgabe, wörtlich): zweite Reihe für Werkzeuge, getrennt von
 * den Content-Format-Kacheln oben. Entwürfe führt auf die vollständige
 * Übersicht (app/(app)/content-studio/entwuerfe), Bild-Check auf den neuen
 * Foto-Bewertungs-Flow (app/(app)/content-studio/bild-check). */
const TOOL_TILES: { key: string; label: string; href: string; Icon: LucideIcon }[] = [
  { key: "entwuerfe", label: "Entwürfe", href: "/content-studio/entwuerfe", Icon: FolderOpen },
  { key: "bild-check", label: "Bild-Check", href: "/content-studio/bild-check/new", Icon: ScanSearch },
];

/** §"Vorschlag umsetzen": ordnet den KI-Freitext-Content-Typ (z.B. "Reel", "Carousel", "Foto-Story") einem der drei bestehenden Einstiege zu -- Beitrag als sicherer Standardfall. */
function resolveStrategyEntryHref(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("reel")) return "/content-studio/reel/new";
  if (lower.includes("story")) return "/content-studio/session/new?format=story";
  return "/content-studio/session/new?format=carousel";
}

export default async function ContentStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job: jobId } = await searchParams;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // §"KI-Aufrufe hintergrundfest machen": "Andere Strategie"-Regenerierung
  // läuft jetzt im Hintergrund -- kompakter Warte-/Fehlerhinweis zusätzlich
  // zum bestehenden Seiteninhalt (keine Vollseiten-Ersetzung, da dieser Hub
  // viel eigenständig nutzbaren Inhalt hat).
  const job = jobId ? await loadJob(jobId) : null;
  const jobStatusBanner = job?.status === "pending" ? (
    <PendingGenerationView
      jobId={job.id}
      pendingLabel="LUMI erstellt eine neue Strategie im Hintergrund … Ihr könnt die App währenddessen schließen."
      fallbackPath="/content-studio"
    />
  ) : job?.status === "failed" ? (
    <Banner variant="error">{job.errorMessage ?? "Etwas ist schiefgelaufen. Bitte erneut versuchen."}</Banner>
  ) : null;

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

  // §"Entwürfe fortsetzen jetzt über eigene Kachel/Seite" (Nutzervorgabe):
  // der Hub selbst braucht Sessions/Reel-Projekte nicht mehr direkt -- die
  // vollständige Liste lebt jetzt in app/(app)/content-studio/entwuerfe.
  const [{ data: recentIdeas }, strategyContext] = await Promise.all([
    supabase
      .from("content_ideas")
      .select("id, content_goal, status, trip_id, trips(title)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(3),
    buildContentStrategyContext(familyId),
  ]);

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

        {/* §"Icons oberhalb des Content-Fahrplans setzen" (Nutzervorgabe,
            wörtlich): die Einstiegskacheln stehen jetzt ganz oben, noch vor
            der Content-erstellen/Content-Fahrplan-Tableiste -- zwei Reihen,
            oben Content erzeugen, unten Werkzeuge. */}
        <div className="grid grid-cols-3 gap-2.5 mb-2.5">
          {CONTENT_FORMAT_TILES.map(({ key, label, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl text-center transition-opacity hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none", minHeight: 80, padding: "12px" }}
            >
              <Icon size={18} strokeWidth={1.3} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--foreground)", fontSize: "0.68rem", fontWeight: 300 }}>{label}</span>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-8">
          {TOOL_TILES.map(({ key, label, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl text-center transition-opacity hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none", minHeight: 80, padding: "12px" }}
            >
              <Icon size={18} strokeWidth={1.3} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--foreground)", fontSize: "0.68rem", fontWeight: 300 }}>{label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-6 mb-8" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--foreground)", borderBottom: "1px solid var(--accent)", paddingBottom: "14px", marginBottom: "-15px" }}>
            Content erstellen
          </span>
          <Link href="/content-studio/posting-plan" style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>
            Content-Fahrplan
          </Link>
        </div>

        {jobStatusBanner && <div className="mb-6">{jobStatusBanner}</div>}

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
