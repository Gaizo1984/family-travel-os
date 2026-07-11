import Link from "next/link";
import { ArrowRight, Users, Clock, CalendarDays, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createTrip } from "@/lib/actions/trips";
import { generateTripIdeas } from "@/lib/actions/trip-idea-generation";
import { COMPASS_CATEGORY_LABELS } from "@/lib/family-dna";
import { Banner } from "@/components/Banner";

// ── Verified Unsplash photos ──────────────────────────────────────────────────

const P = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const INSPO_PHOTOS = {
  remote: P("photo-1615213780624-97494a577778"),   // Patagonia dramatic mountains
  beach:  P("photo-1755259053539-16f470011a0d"),   // turquoise waves, sandy beach
  family: P("photo-1634093870823-f0fd787de005"),   // group hiking mountain
  hotel:  P("photo-1561501900-3701fa6a0864"),       // infinity pool architecture
  travel: P("photo-1594937113195-27f8b9046013"),   // airplane window, clouds
  free:   P("photo-1762236097035-97d69c6e89f8"),   // woman on road, mountains
};

// ── Light-on-dark constants ───────────────────────────────────────────────────

const H_FG   = "#F0EBE3";
const H_MUTED = "#A89880";

// ── Data ─────────────────────────────────────────────────────────────────────

const INSPIRATIONS = [
  {
    title: "Ans Ende der Welt",
    tags:  "Abgeschieden · außergewöhnlich · einmalig",
    photo: INSPO_PHOTOS.remote,
  },
  {
    title: "Meer und sonst nichts",
    tags:  "Strand · Ruhe · Barfuß",
    photo: INSPO_PHOTOS.beach,
  },
  {
    title: "Gemeinsam entdecken",
    tags:  "Natur · Kultur · Abenteuer",
    photo: INSPO_PHOTOS.family,
  },
  {
    title: "Ein besonderes Hotel",
    tags:  "Der Ort ist das Ziel",
    photo: INSPO_PHOTOS.hotel,
  },
  {
    title: "Große Reise",
    tags:  "Mehrere Stationen · viele Erinnerungen",
    photo: INSPO_PHOTOS.travel,
  },
  {
    title: "Einfach raus",
    tags:  "Wenig Planung · schnell weg",
    photo: INSPO_PHOTOS.free,
  },
];

// ── Components ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--muted)",
        fontSize: "0.58rem",
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}

function InspirationCard({ title, tags, photo }: (typeof INSPIRATIONS)[0]) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl"
      style={{ height: "220px", cursor: "pointer" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,7,0.93) 0%, rgba(10,9,7,0.3) 55%, transparent 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div
          style={{
            color: H_MUTED,
            fontSize: "0.55rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: "5px",
          }}
        >
          {tags}
        </div>
        <div
          className="text-base font-light"
          style={{ color: H_FG, letterSpacing: "0.01em" }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from_idea?: string }>;
}) {
  const { error, from_idea } = await searchParams;

  const supabase = await createClient();
  const { data: persons } = await supabase
    .from("persons")
    .select("id, name, initials, color")
    .order("name");

  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const { data: preferences } = await supabase
    .from("family_preference_categories")
    .select("category_key, weight, note")
    .eq("family_id", family?.id ?? "")
    .order("weight", { ascending: false });

  let fromIdea: { destination: string; route_summary: string | null } | null = null;
  if (from_idea) {
    const { data: idea } = await supabase.from("trip_ideas").select("destination, route_summary").eq("id", from_idea).maybeSingle();
    fromIdea = idea ?? null;
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24">

        {/* ── 1. Ruhiger Einstieg ── */}
        <div className="pt-14 pb-10">
          <div
            style={{
              color: "var(--accent)",
              fontSize: "0.55rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              marginBottom: "18px",
            }}
          >
            Eine neue Reise beginnt
          </div>
          <h1
            className="font-light leading-tight mb-4"
            style={{
              color: "var(--foreground)",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Wohin zieht es euch?
          </h1>
          <p
            className="leading-relaxed max-w-lg"
            style={{ color: "var(--muted)", fontSize: "0.9rem" }}
          >
            Ihr müsst noch nicht wissen, wohin. Erzählt einfach, wonach euch gerade ist.
          </p>
        </div>

        {/* ── 2. Freitext + optionale Eckdaten → echter KI-Flow ── */}
        <section className="mb-16">
          <form action={generateTripIdeas}>
            <div
              className="rounded-xl mb-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}
            >
              {error && (
                <Banner variant="error" className="mx-6 mt-6 px-4 py-3 rounded-lg">
                  {error}
                </Banner>
              )}
              <textarea
                name="wish_text"
                required
                placeholder="Zum Beispiel: Wir möchten im Oktober etwa zwei Wochen weg. Warm, außergewöhnlich und mit genug Zeit zum Genießen. Die Kinder sollen etwas erleben, aber wir möchten keinen stressigen Rundreise-Marathon."
                rows={7}
                style={{
                  width: "100%", padding: "28px 32px", background: "transparent", border: "none",
                  outline: "none", resize: "none", color: "var(--foreground)", fontSize: "0.92rem",
                  lineHeight: 1.8, fontWeight: 300, letterSpacing: "0.01em",
                }}
              />
              <div className="flex items-center justify-between px-6 pb-5 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                <p style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic", letterSpacing: "0.02em" }}>
                  Schreibt einfach so, wie ihr es mir erzählen würdet.
                </p>
                <button
                  type="submit"
                  style={{
                    background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                    padding: "10px 22px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase",
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Reiseidee entwickeln
                </button>
              </div>
            </div>

            <SectionLabel>Was wisst ihr schon? (optional)</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays size={10} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>Wann</span>
                </div>
                <input
                  name="rough_timeframe" type="text" placeholder="z. B. Oktober 2028"
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}
                />
              </div>

              <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={10} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>Wie lange</span>
                </div>
                <input
                  name="duration_days" type="number" min="1" placeholder="z. B. 14 Tage"
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}
                />
              </div>

              <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Users size={10} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>Wer reist mit</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(persons ?? []).map((p) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input type="checkbox" name="traveler_ids" value={p.id} defaultChecked style={{ accentColor: "var(--accent)", width: "12px", height: "12px", cursor: "pointer" }} />
                      <span style={{ color: "var(--foreground)", fontSize: "0.78rem", fontWeight: 300 }}>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Plane size={10} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>Abflug</span>
                </div>
                <input
                  name="departure_city" type="text" placeholder="z. B. Frankfurt"
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
                Budget (optional)
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  name="budget_amount" type="number" min="0" step="100" placeholder="Gesamtbudget"
                  style={{ width: 140, padding: "8px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
                />
                <select
                  name="budget_currency" defaultValue="EUR"
                  style={{ padding: "8px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="CHF">CHF</option>
                  <option value="GBP">GBP</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input type="checkbox" name="includes_flights" style={{ accentColor: "var(--accent)", width: "12px", height: "12px", cursor: "pointer" }} />
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>inkl. Flüge</span>
                </label>
              </div>
            </div>
          </form>
        </section>

        {/* ── 3. Inspiration Cards ── */}
        <section className="mb-16">
          <SectionLabel>Oder startet mit einem Gefühl</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {INSPIRATIONS.map((inspo) => (
              <InspirationCard key={inspo.title} {...inspo} />
            ))}
          </div>
        </section>

        {/* ── 5. Die App kennt eure Familie ── */}
        <section className="mb-16">
          <div
            className="rounded-xl p-7 md:p-9"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                color: "var(--accent)",
                fontSize: "0.55rem",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Wir planen nicht für irgendeine Familie.
            </div>
            <h2
              className="font-light mb-1"
              style={{ color: "var(--foreground)", fontSize: "1.2rem", letterSpacing: "0.01em" }}
            >
              Wir wissen bereits, was euch wichtig ist.
            </h2>
            <p
              className="mb-7"
              style={{ color: "var(--muted)", fontSize: "0.75rem" }}
            >
              Ihr müsst bei jeder neuen Reise nicht wieder alles von vorne erklären.
            </p>

            {preferences && preferences.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                {[...preferences]
                  .filter((p) => p.weight >= 3)
                  .map((pref) => (
                    <div key={pref.category_key} className="flex items-center gap-3">
                      <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                      <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                        {COMPASS_CATEGORY_LABELS[pref.category_key] ?? pref.category_key}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}>
                Euer Reisekompass ist noch nicht ausgefüllt.
              </p>
            )}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
              <Link
                href="/family"
                style={{
                  color: "var(--accent)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Familienprofil ansehen
                <ArrowRight size={10} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 8. Reise anlegen (echtes Formular) ── */}
        <section>
          <form action={createTrip}>
            {fromIdea && <input type="hidden" name="source_trip_idea_id" value={from_idea} />}
            <div
              className="rounded-xl p-8 md:p-10"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                }}
              >
                Neue Reise anlegen
              </div>
              <h2
                className="font-light mb-2 max-w-sm"
                style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}
              >
                Wenn sich eine Idee richtig anfühlt.
              </h2>
              <p
                className="mb-8 max-w-md"
                style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.7 }}
              >
                Gebt der Reise einen Namen und speichert sie. Alles andere — Etappen, Hotels, Flüge — kommt danach.
              </p>

              {fromIdea && (
                <div
                  className="mb-6 px-4 py-3 rounded-lg"
                  style={{ background: "rgba(184,154,94,0.12)", border: "1px solid rgba(184,154,94,0.3)", color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.02em" }}
                >
                  Aus eurer Reiseidee „{fromIdea.destination}" übernommen — Name bitte prüfen, Termine sind noch offen.
                </div>
              )}

              {error && (
                <Banner variant="error">
                  {error}
                </Banner>
              )}

              {/* Reisenname */}
              <div className="mb-5">
                <label
                  htmlFor="trip-title"
                  style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                >
                  Reisenname *
                </label>
                <input
                  id="trip-title"
                  name="title"
                  type="text"
                  required
                  defaultValue={fromIdea?.destination ?? ""}
                  placeholder="z. B. Oman 2027 oder Sommer in Griechenland"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                    fontWeight: 300,
                    outline: "none",
                  }}
                />
              </div>

              {/* Daten */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label
                    htmlFor="trip-start"
                    style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                  >
                    Von *
                  </label>
                  <input
                    id="trip-start"
                    name="start_date"
                    type="date"
                    required
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="trip-end"
                    style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
                  >
                    Bis *
                  </label>
                  <input
                    id="trip-end"
                    name="end_date"
                    type="date"
                    required
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Wer reist mit */}
              <div className="mb-8">
                <div
                  style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "12px" }}
                >
                  Wer reist mit *
                </div>
                <div className="flex flex-wrap gap-3">
                  {(persons ?? []).map((p) => (
                    <label
                      key={p.id}
                      style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        name="members"
                        value={p.id}
                        defaultChecked
                        style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                      />
                      <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>
                        {p.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
                <button
                  type="submit"
                  style={{
                    background: "var(--foreground)",
                    color: "var(--surface)",
                    border: "none",
                    borderRadius: "6px",
                    padding: "12px 26px",
                    fontSize: "0.65rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Reise anlegen →
                </button>
              </div>
            </div>
          </form>
        </section>

      </div>
    </div>
  );
}
