import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Sparkles, Music, BookOpen, Clapperboard, Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignedPhoto } from "@/components/SignedPhoto";
import {
  CATEGORY_LABELS, RECOMMENDATION_LABELS,
  type PhotoCategory, type Recommendation,
} from "@/lib/photo-analysis";

type AnalyzedPhoto = {
  id: string; storagePath: string; url: string | null
  qualityScore: number | null; categories: PhotoCategory[]
  reasoning: string | null; recommendation: Recommendation | null
};

function SectionLabel({ children, Icon }: { children: React.ReactNode; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }> }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
      <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

export default async function PhotoAnalysisResultPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;

  const supabase = await createClient();
  const { data: analysis } = await supabase
    .from("content_photo_analyses")
    .select("id, project_id, trip_id, caption, hashtags, hook, story_structure, reel_order, music_suggestions, photobook_chapters, travel_diary, trips(title)")
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) notFound();

  const tripTitle = (analysis.trips as unknown as { title: string } | null)?.title;

  const { data: photosRaw } = analysis.project_id
    ? await supabase
        .from("content_project_photos")
        .select("id, storage_path, quality_score, categories, reasoning, recommendation")
        .eq("project_id", analysis.project_id)
        .not("analyzed_at", "is", null)
        .order("quality_score", { ascending: false })
    : { data: null };

  const photos: AnalyzedPhoto[] = await Promise.all(
    (photosRaw ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return {
        id: p.id, storagePath: p.storage_path, url: signed?.signedUrl ?? null,
        qualityScore: p.quality_score, categories: (p.categories ?? []) as PhotoCategory[],
        reasoning: p.reasoning, recommendation: p.recommendation as Recommendation | null,
      };
    }),
  );
  const photoById = new Map(photos.map((p) => [p.id, p]));

  const storyStructure = (analysis.story_structure ?? []) as Array<{ photo_id: string; note: string }>;
  const reelOrder = (analysis.reel_order ?? []) as Array<{ photo_id: string; note: string }>;
  const photobookChapters = (analysis.photobook_chapters ?? []) as Array<{ title: string; photo_ids: string[] }>;

  function PhotoThumb({ photoId }: { photoId: string }) {
    const p = photoById.get(photoId);
    if (!p?.url) return null;
    return (
      <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 56 }}>
        <SignedPhoto storagePath={p.storagePath} initialUrl={p.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
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
          {tripTitle ?? "Bildanalyse"}
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Ergebnisse der Bildanalyse
        </h1>

        {/* ── Fotos mit Kategorien ── */}
        {photos.length > 0 && (
          <div className="mb-10">
            <SectionLabel Icon={Images}>Analysierte Fotos</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {photos.map((p) => p.url && (
                <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="relative" style={{ height: 140 }}>
                    <SignedPhoto storagePath={p.storagePath} initialUrl={p.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    {p.qualityScore !== null && (
                      <span className="absolute bottom-2 right-2" style={{ color: "#F0EBE3", fontSize: "0.6rem", background: "rgba(10,9,7,0.6)", padding: "2px 8px", borderRadius: "10px" }}>
                        {p.qualityScore}/10
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    {p.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {p.categories.map((c) => (
                          <span key={c} style={{ color: "var(--accent)", fontSize: "0.58rem", background: "rgba(184,154,94,0.1)", border: "1px solid rgba(184,154,94,0.25)", padding: "2px 8px", borderRadius: "20px" }}>
                            {CATEGORY_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.reasoning && (
                      <p className="mb-1" style={{ color: "var(--muted)", fontSize: "0.7rem", lineHeight: 1.4 }}>{p.reasoning}</p>
                    )}
                    {p.recommendation && (
                      <p style={{ color: "var(--foreground)", fontSize: "0.68rem" }}>
                        Empfehlung: <strong style={{ fontWeight: 500 }}>{RECOMMENDATION_LABELS[p.recommendation] ?? p.recommendation}</strong>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Generierte Inhalte ── */}
        <SectionLabel Icon={Sparkles}>Generierte Inhalte</SectionLabel>

        {analysis.caption && (
          <Card>
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Caption</div>
            <p className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.85rem", lineHeight: 1.6 }}>{analysis.caption}</p>
            {analysis.hashtags?.length > 0 && (
              <p style={{ color: "var(--accent)", fontSize: "0.75rem" }}>{analysis.hashtags.map((h: string) => `#${h}`).join(" ")}</p>
            )}
          </Card>
        )}

        {analysis.hook && (
          <Card>
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Hook</div>
            <p style={{ color: "var(--foreground)", fontSize: "0.85rem", fontStyle: "italic", lineHeight: 1.6 }}>„{analysis.hook}"</p>
          </Card>
        )}

        {storyStructure.length > 0 && (
          <Card>
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>Story-Aufbau</div>
            <div className="space-y-3">
              {storyStructure.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <PhotoThumb photoId={s.photo_id} />
                  <p style={{ color: "var(--foreground)", fontSize: "0.78rem", lineHeight: 1.4 }}>{s.note}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {reelOrder.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Clapperboard size={13} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Reel-Reihenfolge</span>
            </div>
            <div className="space-y-3">
              {reelOrder.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span style={{ color: "var(--accent)", fontSize: "0.7rem", width: 16, flexShrink: 0 }}>{i + 1}.</span>
                  <PhotoThumb photoId={s.photo_id} />
                  <p style={{ color: "var(--foreground)", fontSize: "0.78rem", lineHeight: 1.4 }}>{s.note}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {analysis.music_suggestions?.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Music size={13} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Musikvorschläge</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.music_suggestions.map((m: string, i: number) => (
                <span key={i} style={{ color: "var(--foreground)", fontSize: "0.72rem", background: "var(--background)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: "20px" }}>
                  {m}
                </span>
              ))}
            </div>
          </Card>
        )}

        {photobookChapters.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={13} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>Fotobuch-Kapitel</span>
            </div>
            <div className="space-y-4">
              {photobookChapters.map((c, i) => (
                <div key={i}>
                  <p className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>{c.title}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {c.photo_ids.map((id) => <PhotoThumb key={id} photoId={id} />)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {analysis.travel_diary && (
          <Card>
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Reisetagebuch</div>
            <p style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.6 }}>{analysis.travel_diary}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
