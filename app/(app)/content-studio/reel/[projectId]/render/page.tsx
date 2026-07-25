import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { REEL_STYLE_LABELS } from "@/lib/ai-style-guidelines";
import { listReelRenders, startReelRender, pollReelRenderStatus } from "@/lib/actions/reel-render";
import { ReelRenderPanel } from "@/components/ReelRenderPanel";

/**
 * §Content Studio 3.0, Sprint 5: letzter Schritt des Reel-Flows -- Vorschau-
 * und Finalrender über die bestehende Remotion-Lambda-Infrastruktur. Reine
 * Lade-/Ownership-Prüfung hier, die eigentliche Trigger-/Polling-Logik lebt
 * in components/ReelRenderPanel.tsx + lib/actions/reel-render.ts.
 */
export default async function ReelRenderPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const { data: project } = await supabase
    .from("content_projects")
    .select("id, reel_style, reel_duration_seconds")
    .eq("id", projectId).eq("family_id", familyId).eq("project_type", "reel")
    .maybeSingle();
  if (!project) notFound();

  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id")
    .eq("project_id", projectId).eq("draft_type", "video_reel")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!draft) redirect(`/content-studio/reel/${projectId}/media?error=${encodeURIComponent("Bitte zuerst ein Storyboard erstellen.")}`);

  const reelDurationSeconds = (project.reel_duration_seconds ?? 30) as 15 | 30;
  const renders = await listReelRenders(projectId);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg w-full mx-auto px-5 md:px-8 pb-24 pt-9">
        <Link
          href={`/content-studio/reel/${projectId}/timeline`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Timeline
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Render · {REEL_STYLE_LABELS[project.reel_style ?? ""] ?? project.reel_style} · {reelDurationSeconds}s
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Reel rendern
        </h1>

        <ReelRenderPanel
          projectId={projectId}
          reelDurationSeconds={reelDurationSeconds}
          initialRenders={renders}
          startRender={startReelRender}
          pollStatus={pollReelRenderStatus}
        />
      </div>
    </div>
  );
}
