import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { Banner } from "@/components/Banner";
import { generatePackingList } from "@/lib/actions/packing-list-generation";
import { PACK_STYLE_ORDER, PACK_STYLE_LABELS } from "@/lib/packing-list-generation";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function GeneratePackingListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const lumiCore = await createLumiCoreClient();
  const { data: trip } = await lumiCore.from("travel_trips").select("id, slug, title").eq("slug", id).maybeSingle();
  if (!trip) notFound();

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
          Intelligente Packliste
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Ein paar kurze Fragen
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          LUMI stellt aus euren Reisedaten (Etappen, Teilnehmer, Wetter, Aktivitäten, bestätigte Vorlieben) automatisch einen Vorschlag zusammen.
          Diese Fragen helfen nur bei dem, was sich daraus nicht ableiten lässt.
        </p>

        <form action={generatePackingList}>
          <input type="hidden" name="trip_id" value={trip.id} />
          <input type="hidden" name="slug" value={trip.slug} />

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && <Banner variant="error">{error}</Banner>}

            <div className="mb-6">
              <label style={LABEL_STYLE}>Packstil</label>
              <div className="flex flex-wrap gap-2">
                {PACK_STYLE_ORDER.map((style) => (
                  <label key={style} className="flex items-center gap-2 rounded-full px-4 py-2.5 cursor-pointer" style={{ background: style === "ausgewogen" ? "rgba(184,154,94,0.14)" : "var(--background)", border: `1px solid ${style === "ausgewogen" ? "rgba(184,154,94,0.4)" : "var(--border)"}` }}>
                    <input type="radio" name="pack_style" value={style} defaultChecked={style === "ausgewogen"} style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                    <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>{PACK_STYLE_LABELS[style]}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 mb-5" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="laundry_available" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
              <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>Es gibt vor Ort eine Waschmöglichkeit</span>
            </label>

            <div className="mb-6">
              <label htmlFor="pk-events" style={LABEL_STYLE}>Besondere Anlässe (optional)</label>
              <input id="pk-events" name="special_events" type="text" placeholder="z. B. Hochzeit, festliches Dinner" style={FIELD_STYLE} />
            </div>

            <label style={LABEL_STYLE}>Für Kinder</label>
            <div className="flex flex-wrap gap-4 mb-6">
              <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="needs_stroller" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>Kinderwagen</span>
              </label>
              <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="needs_car_seat" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>Kindersitz</span>
              </label>
              <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="needs_carrier" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>Babytrage</span>
              </label>
              <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="needs_diapers" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>Windeln (Kind trägt noch Windeln)</span>
              </label>
            </div>

            <label style={LABEL_STYLE}>Ausrüstung</label>
            <div className="flex flex-wrap gap-4 mb-2">
              <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="has_drone" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>Drohne wird mitgenommen</span>
              </label>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 mt-8" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href={`/trips/${trip.slug}/packing`} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
                Abbrechen
              </Link>
              <SubmitButtonWithProgress
                label="Intelligente Packliste erstellen"
                pendingLabel="LUMI erstellt die Packliste …"
                className="w-full sm:w-auto justify-center"
                style={{ whiteSpace: "normal" }}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
