import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildFamilyDnaSummary } from "@/lib/family-dna";
import { MOOD_OPTIONS, SEASON_WINDOW_OPTIONS } from "@/lib/data/destination-knowledge";
import { scoreDestinations } from "@/lib/discover-scoring";
import { searchDestinations } from "@/lib/providers/destination-provider";
import { generateTripIdeas } from "@/lib/actions/trip-idea-generation";

/** §"Neue Reiseideen": Standard-Wunschtext für den "Neue Ideen generieren"-Button, da generateTripIdeas mindestens 10 Zeichen Freitext verlangt -- alle anderen Felder bleiben optional/leer. */
const DEFAULT_WISH_TEXT = "Überrascht uns mit Zielen, die zu unseren Vorlieben passen.";

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "14px" }}>
      {children}
    </div>
  );
}

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // §Performance-Audit: fünf voneinander unabhängige Ladevorgänge (alle
  // brauchen nur familyId) liefen bisher seriell hintereinander.
  const [dna, { data: pastTrips }, { data: trips }, destinationsOrNull, { data: ideas }] = await Promise.all([
    buildFamilyDnaSummary(familyId),
    supabase.from("past_trips").select("country_or_region").eq("family_id", familyId),
    supabase.from("trips").select("title").eq("family_id", familyId).in("status", ["completed", "active"]),
    searchDestinations(),
    supabase.from("trip_ideas").select("id, destination").eq("family_id", familyId).order("created_at", { ascending: false }).limit(4),
  ]);
  const avoidNames = [...(pastTrips ?? []).map((p) => p.country_or_region), ...(trips ?? []).map((t) => t.title)];
  const destinations = destinationsOrNull ?? [];

  // §"Drei Vorschläge anhand unserer Präferenzen": rein deterministisch,
  // kostenlos (lib/discover-scoring.ts) -- erst der separate Button unten
  // ("Neue Ideen generieren") löst einen echten OpenAI-Aufruf aus.
  const [top, ...more] = scoreDestinations(destinations, dna, { avoidNames }).slice(0, 3);

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── Kompakter Header ── */}
      <div className="px-7 md:px-10 py-8" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: "8px" }}>
          Kuratiert für euch
        </div>
        <h1 className="font-light leading-tight" style={{ color: "var(--foreground)", fontSize: "clamp(1.6rem, 4vw, 2.2rem)", letterSpacing: "-0.02em" }}>
          Wohin, wenn ihr noch gar nicht sucht?
        </h1>
      </div>

      <div className="max-w-3xl mx-auto w-full px-5 md:px-8 pb-20">

        {/* ── Eine große Top-Empfehlung (serverseitig berechnet) ── */}
        {top && (
          <section className="mt-8 mb-10">
            <div className="group relative overflow-hidden rounded-2xl" style={{ height: "360px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={top.destination.photo} alt={top.destination.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.4) 55%, transparent 100%)" }} />
              <div className="absolute top-5 left-5" style={{ background: "var(--accent)", borderRadius: "20px", padding: "4px 13px", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#1a1714", fontWeight: 500 }}>
                Für eure Familie
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <p style={{ color: H_MUTED, fontSize: "0.68rem" }}>{top.destination.tags}</p>
                <h2 className="font-light leading-tight mb-2" style={{ color: H_FG, fontSize: "clamp(1.5rem, 4vw, 2rem)", letterSpacing: "-0.01em" }}>
                  {top.destination.name}
                </h2>
                <p className="mb-4 max-w-md italic" style={{ color: H_MUTED, fontSize: "0.74rem", lineHeight: 1.6 }}>
                  {top.reasoning}
                </p>
                <Link
                  href="/discover/results"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(240,235,227,0.12)", border: "1px solid rgba(240,235,227,0.25)", borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: H_FG, textDecoration: "none" }}
                >
                  Weitere Vorschläge
                  <ArrowRight size={10} strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Zwei weitere Vorschläge, kompakter ── */}
        {more.length > 0 && (
          <section className="mb-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {more.map((s) => (
              <div key={s.destination.name} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ color: "var(--foreground)", fontSize: "0.92rem", marginBottom: "4px" }}>{s.destination.name}</div>
                <p style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5, fontStyle: "italic" }}>{s.reasoning}</p>
              </div>
            ))}
          </section>
        )}

        {/* ── Neue Ideen generieren: einziger Auslöser für einen echten KI-Aufruf hier ── */}
        <section className="mb-10">
          <div className="rounded-xl p-6 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400, marginBottom: "4px" }}>Noch nicht das Richtige dabei?</div>
              <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>LUMI entwickelt drei neue, individuelle Reiseideen aus euren Vorlieben.</p>
            </div>
            <form action={generateTripIdeas}>
              <input type="hidden" name="wish_text" value={DEFAULT_WISH_TEXT} />
              <button
                type="submit"
                className="flex items-center gap-2"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                  padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <Sparkles size={12} strokeWidth={1.6} />
                Neue Ideen generieren
              </button>
            </form>
          </div>
        </section>

        {/* ── Wann wollt ihr reisen? ── */}
        <section className="mb-10">
          <SecLabel>Wann wollt ihr reisen?</SecLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SEASON_WINDOW_OPTIONS.map((s) => (
              <Link
                key={s.key}
                href={`/discover/results?season=${s.key}`}
                className="block rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
              >
                <div className="font-medium mb-1" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>{s.label}</div>
                <p style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}>{s.sub}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Wonach fühlt es sich gerade an? ── */}
        <section className="mb-10">
          <SecLabel>Wonach fühlt es sich gerade an?</SecLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MOOD_OPTIONS.map((m) => (
              <Link
                key={m.key}
                href={`/discover/results?mood=${m.key}`}
                className="block rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
              >
                <div className="font-medium leading-tight mb-1.5" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>{m.label}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}>{m.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Kompakte Vorschau: Ideen-Inbox + Hotels ── */}
        <section className="mb-10">
          <div className="rounded-xl p-6 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400, marginBottom: "4px" }}>
                {(ideas ?? []).length} gespeicherte {(ideas ?? []).length === 1 ? "Idee" : "Ideen"}
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Eure Ideen-Inbox aus Entdecken und der Reiseidee-Entwicklung.</p>
            </div>
            <Link href="/discover/ideas" style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.08em", textDecoration: "none", whiteSpace: "nowrap" }}>
              Alle ansehen →
            </Link>
          </div>
        </section>

        <section className="mb-10">
          <Link
            href="/discover/hotels"
            className="block rounded-xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400, marginBottom: "4px" }}>Hotels, für die man eine Reise baut</div>
                <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Kuratiert nach euren Kriterien für außergewöhnliche Hotels.</p>
              </div>
              <ArrowRight size={14} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} />
            </div>
          </Link>
        </section>

        {/* ── Abschluss ── */}
        <section>
          <div className="rounded-2xl p-8 md:p-10" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="font-light leading-tight mb-3" style={{ color: "var(--foreground)", fontSize: "clamp(1.2rem, 3vw, 1.7rem)", letterSpacing: "0.01em" }}>
              Manchmal beginnt eine Reise nicht mit einem Ziel.
            </h2>
            <p className="mb-8 italic" style={{ color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              Sondern mit einem Gefühl, das immer wieder auftaucht.
            </p>
            <Link
              href="/plan"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--foreground)", color: "var(--surface)", borderRadius: "6px", padding: "12px 26px", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none" }}
            >
              Reise jetzt konkret planen
              <ArrowRight size={11} strokeWidth={1.5} />
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
