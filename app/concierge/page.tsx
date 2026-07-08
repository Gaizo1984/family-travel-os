import Link from "next/link";
import { ArrowRight, Info, Sparkles } from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const PRIORITIES = [
  {
    trip:        "Oman in Balance",
    open:        "Hotel am Meer noch offen.",
    next:        "Entscheidet zuerst das Charakter des letzten Reiseabschnitts – das klärt gleichzeitig das Budget.",
    accent:      true,
    href:        "/plan/oman",
  },
  {
    trip:        "Costa Rica 2026",
    open:        "Mietwagen-Tag braucht noch Lunch-Reservierung.",
    next:        "Der Tagesplan steht – ein guter Tisch fehlt noch. Besser früh als spontan.",
    accent:      false,
    href:        "/today",
  },
  {
    trip:        "Indonesien 2028",
    open:        "Sumba-Transfer noch nicht entschieden.",
    next:        "Kleines Flugzeug oder Privatboot – die Entscheidung beeinflusst Ankunftszeit und Gepäck.",
    accent:      false,
    href:        "/trips/indonesien-2028",
  },
];

const EXAMPLE_QUESTIONS = [
  "Welche Reiseentscheidung ist gerade am wichtigsten?",
  "Wo verlieren wir beim Oman-Budget am wenigsten Reisequalität?",
  "Welche Route ist mit Lumi am entspanntesten?",
  "Was fehlt uns noch für Costa Rica?",
  "Welche Hotels passen wirklich zu uns?",
  "Plane morgen in Costa Rica neu – weniger Fahrzeit.",
];

const FUNCTIONS = [
  {
    title: "Entscheiden",
    text:  "Welche Option passt wirklich zu euch?",
  },
  {
    title: "Priorisieren",
    text:  "Was ist jetzt wichtig – und was später?",
  },
  {
    title: "Vereinfachen",
    text:  "Wo ist die Reise unnötig kompliziert?",
  },
  {
    title: "Erinnern",
    text:  "Was darf nicht vergessen werden?",
  },
];

const FAMILY_PREFS = [
  {
    who:  "Sarah & Marcel",
    pref: "Besondere Hotels, gutes Essen, genug Ruhe",
  },
  {
    who:  "Lia",
    pref: "Natur, Pferde, Abenteuer",
  },
  {
    who:  "Elias",
    pref: "Sport, Bewegung, Entdecken",
  },
  {
    who:  "Lumi",
    pref: "Rhythmus, Pausen, kurze Transfers",
  },
];

const PROACTIVE = [
  "Der Direktflug für Oman ist teurer, aber für eure Familienkonstellation sinnvoll.",
  "Beim Chedi lohnt sich eventuell eine Nacht weniger.",
  "Costa Rica: Der Mietwagen-Tag braucht noch eine Tischreservierung.",
  "Indonesien: Die Sumba-Etappe hängt am Transfer.",
];

const CAPABILITIES = [
  "Reisen vergleichen und einordnen",
  "Offene Entscheidungen erkennen und priorisieren",
  "Tagespläne anpassen und vereinfachen",
  "Hotels nach Familienpassung bewerten",
  "Flugoptionen ehrlich einordnen",
  "Budgets erklären und transparent machen",
  "Dokumente auf Vollständigkeit prüfen",
  "Preisänderungen im Kontext bewerten",
  "Content-Ideen aus Reisemomenten entwickeln",
  "Erinnerungen und Hinweise vorbereiten",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--accent)",
        fontSize: "0.55rem",
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        marginBottom: "10px",
      }}
    >
      {children}
    </div>
  );
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "var(--muted)",
        fontSize: "0.58rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        marginBottom: "18px",
      }}
    >
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConciergePage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── 1. Editorial Header ── */}
      <div
        className="px-7 md:px-10 py-10 md:py-12"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <Eyebrow>Euer persönlicher Reiseberater</Eyebrow>
        <h1
          className="font-light leading-tight mb-2"
          style={{
            color: "var(--foreground)",
            fontSize: "clamp(1.8rem, 5vw, 2.6rem)",
            letterSpacing: "-0.02em",
          }}
        >
          Was sollen wir als Nächstes klären?
        </h1>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.85rem",
            fontWeight: 300,
            lineHeight: 1.65,
            maxWidth: "480px",
          }}
        >
          Ich kenne eure Reisen, eure Familie und die offenen Entscheidungen.
        </p>
      </div>

      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-20">

          {/* ── 2. Aktuelle Prioritäten ── */}
          <section className="mt-10 mb-12">
            <SecLabel>Aktuelle Prioritäten</SecLabel>
            <div className="space-y-3">
              {PRIORITIES.map(({ trip, open, next, accent, href }) => (
                <Link
                  key={trip}
                  href={href}
                  className="block rounded-xl overflow-hidden"
                  style={{ textDecoration: "none", border: accent ? "1px solid rgba(184,154,94,0.35)" : "1px solid var(--border)" }}
                >
                  {accent && (
                    <div
                      style={{
                        height: "2px",
                        background: "linear-gradient(to right, var(--accent), transparent)",
                      }}
                    />
                  )}
                  <div
                    className="p-5"
                    style={{ background: "var(--surface)" }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.52rem",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            marginBottom: "3px",
                          }}
                        >
                          {trip}
                        </div>
                        <div
                          className="font-medium"
                          style={{ color: "var(--foreground)", fontSize: "0.88rem" }}
                        >
                          {open}
                        </div>
                      </div>
                      {accent && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: "0.48rem",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                            border: "1px solid rgba(184,154,94,0.3)",
                            padding: "2px 8px",
                            borderRadius: "20px",
                          }}
                        >
                          Priorität
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.72rem",
                        fontStyle: "italic",
                        lineHeight: 1.55,
                        borderTop: "1px solid var(--border)",
                        paddingTop: "10px",
                        marginTop: "10px",
                      }}
                    >
                      {next}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── 3. Fragen, die ihr stellen könnt ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-5 md:p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.52rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "14px",
                }}
              >
                Fragt nicht allgemein. Fragt eure Reise.
              </div>
              <div className="space-y-2.5">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.78rem",
                        fontStyle: "italic",
                        fontWeight: 300,
                        lineHeight: 1.4,
                      }}
                    >
                      „{q}"
                    </span>
                    <ArrowRight
                      size={10}
                      strokeWidth={1.5}
                      style={{ color: "var(--muted)", flexShrink: 0 }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── 4. Große Eingabefläche ── */}
          <section className="mb-12">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                style={{
                  padding: "14px 22px 8px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    color: "var(--accent)",
                    fontSize: "0.52rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                  }}
                >
                  Travel Briefing
                </span>
              </div>
              <textarea
                rows={5}
                placeholder="Zum Beispiel: Welche unserer offenen Entscheidungen sollte ich als Nächstes treffen?"
                style={{
                  width: "100%",
                  padding: "20px 22px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                  lineHeight: 1.75,
                  fontWeight: 300,
                }}
              />
              <div
                className="flex items-center justify-end px-5 pb-4 pt-1"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  style={{
                    background: "var(--foreground)",
                    color: "var(--surface)",
                    border: "none",
                    borderRadius: "6px",
                    padding: "10px 22px",
                    fontSize: "0.62rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                  }}
                >
                  Concierge fragen
                  <ArrowRight size={10} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </section>

          {/* ── 5. Demo-Antwort ── */}
          <section className="mb-12">
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* Question */}
              <div
                className="px-6 py-4"
                style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.5rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    marginBottom: "5px",
                  }}
                >
                  Eure Frage
                </div>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.8rem",
                    fontStyle: "italic",
                    fontWeight: 300,
                  }}
                >
                  „Welche Entscheidung ist bei Oman gerade am wichtigsten?"
                </p>
              </div>

              {/* Answer */}
              <div className="px-6 pt-6 pb-5" style={{ background: "var(--surface)" }}>
                <div
                  style={{
                    color: "var(--accent)",
                    fontSize: "0.5rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Concierge
                </div>

                {/* Key statement */}
                <p
                  className="leading-relaxed mb-5"
                  style={{
                    color: "var(--foreground)",
                    fontSize: "1rem",
                    fontStyle: "italic",
                    fontWeight: 300,
                    lineHeight: 1.7,
                  }}
                >
                  „Nicht der Flug. Nicht die Aktivitäten. Die wichtigste offene Entscheidung
                  ist das Hotel am Meer."
                </p>

                {/* Reasoning */}
                <div
                  className="mb-4"
                  style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.52rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      marginBottom: "7px",
                    }}
                  >
                    Warum
                  </div>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.78rem",
                      lineHeight: 1.65,
                    }}
                  >
                    Dort verbringt ihr fünf Nächte. Diese Station prägt den Abschluss der Reise
                    und beeinflusst gleichzeitig das Budget stärker als jede einzelne Aktivität.
                  </p>
                </div>

                {/* Recommendation */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(184,154,94,0.06)",
                    border: "1px solid rgba(184,154,94,0.25)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--accent)",
                      fontSize: "0.52rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      marginBottom: "7px",
                    }}
                  >
                    Empfehlung
                  </div>
                  <p
                    style={{
                      color: "var(--foreground)",
                      fontSize: "0.78rem",
                      lineHeight: 1.65,
                      fontWeight: 300,
                    }}
                  >
                    Entscheidet zuerst, ob diese Station eher Erholung, besonderes Hotelerlebnis
                    oder Familienkomfort sein soll. Danach werden die übrigen Kosten viel klarer.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 6. Entscheidungen statt Informationen ── */}
          <section className="mb-12">
            <SecLabel>Der Concierge hilft nicht nur beim Suchen.</SecLabel>
            <div className="grid grid-cols-2 gap-3">
              {FUNCTIONS.map(({ title, text }) => (
                <div
                  key={title}
                  className="rounded-xl p-5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="font-medium mb-1.5"
                    style={{ color: "var(--foreground)", fontSize: "0.88rem" }}
                  >
                    {title}
                  </div>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.72rem",
                      fontStyle: "italic",
                      lineHeight: 1.5,
                    }}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 7. Familienlogik ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-7"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <SecLabel>Wir planen für euch fünf.</SecLabel>
              <div className="space-y-0">
                {FAMILY_PREFS.map(({ who, pref }, idx) => (
                  <div
                    key={who}
                    className="flex items-start gap-5 py-3.5"
                    style={{
                      borderBottom:
                        idx < FAMILY_PREFS.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: "120px",
                        color: "var(--foreground)",
                        fontSize: "0.78rem",
                        fontWeight: 400,
                        paddingTop: "1px",
                      }}
                    >
                      {who}
                    </div>
                    <p
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.75rem",
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      {pref}
                    </p>
                  </div>
                ))}
              </div>
              <p
                className="mt-5"
                style={{
                  color: "var(--muted)",
                  fontSize: "0.72rem",
                  fontStyle: "italic",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "14px",
                }}
              >
                Eine gute Empfehlung passt nicht nur zur Reise. Sie passt zu allen, die mitreisen.
              </p>
            </div>
          </section>

          {/* ── 8. Proaktive Hinweise ── */}
          <section className="mb-12">
            <SecLabel>Bevor ihr fragen müsst</SecLabel>
            <div className="space-y-2.5">
              {PROACTIVE.map((hint) => (
                <div
                  key={hint}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    style={{
                      width: "2px",
                      minHeight: "14px",
                      background: "var(--accent)",
                      borderRadius: "2px",
                      flexShrink: 0,
                      marginTop: "3px",
                    }}
                  />
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.78rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {hint}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 9. Was der Concierge später können soll ── */}
          <section className="mb-12">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <Sparkles
                  size={12}
                  strokeWidth={1.4}
                  style={{ color: "var(--muted)" }}
                />
                <SecLabel>Was später möglich ist</SecLabel>
              </div>
              <p
                className="mb-6"
                style={{
                  color: "var(--muted)",
                  fontSize: "0.78rem",
                  lineHeight: 1.65,
                }}
              >
                Für diesen Schritt ist alles ein visueller Rohling. Keine echte KI.
                Aber so soll es sich anfühlen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                {CAPABILITIES.map((cap) => (
                  <div key={cap} className="flex items-start gap-3">
                    <div
                      style={{
                        width: "2px",
                        minHeight: "14px",
                        background: "var(--accent)",
                        borderRadius: "2px",
                        flexShrink: 0,
                        marginTop: "4px",
                      }}
                    />
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.77rem",
                        lineHeight: 1.5,
                      }}
                    >
                      {cap}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 10. Abschluss ── */}
          <section>
            <div
              className="rounded-2xl p-8 md:p-10"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2
                className="font-light leading-tight mb-3"
                style={{
                  color: "var(--foreground)",
                  fontSize: "clamp(1.2rem, 3vw, 1.7rem)",
                  letterSpacing: "0.01em",
                }}
              >
                Ihr müsst nicht alles gleichzeitig planen.
              </h2>
              <p
                className="mb-8"
                style={{
                  color: "var(--muted)",
                  fontSize: "0.85rem",
                  lineHeight: 1.65,
                }}
              >
                Der Concierge zeigt euch, was als Nächstes wirklich zählt.
              </p>
              <Link
                href="/plan"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--foreground)",
                  color: "var(--surface)",
                  borderRadius: "6px",
                  padding: "12px 26px",
                  fontSize: "0.65rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Neue Reise planen
                <ArrowRight size={11} strokeWidth={1.5} />
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
