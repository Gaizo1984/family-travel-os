import Link from "next/link";
import { ChevronRight, Users, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { getFamily } from "@/lib/family";
import { buildContentStrategyContext } from "@/lib/content-strategy-context";
import type { ContentStrategyContext } from "@/lib/content-strategy-context";
import { QUICK_ACTIONS, buildConciergeCards } from "@/lib/concierge";
import { listTodayConciergeMessages, buildContextFingerprint } from "@/lib/concierge-messages";
import { getCachedTodayRecommendation } from "@/lib/today-recommendation";
import { askConcierge, refreshConciergeMessage, commitConciergeAction } from "@/lib/actions/concierge-actions";

const RETURN_TO = "/concierge";
const RETURN_TO_GENERAL = "/concierge?scope=general";

/** §"Auswahl 'Allgemein' oder konkrete Reise" (Nutzervorgabe) -- einfacher Umschalter zwischen zwei Modi, keine volle Reiseliste (v1-Umfang laut Architekturplan). */
function ScopeSwitch({ isGeneral, tripTitle }: { isGeneral: boolean; tripTitle: string | null }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Link
        href="/concierge"
        className="px-3 py-1.5 rounded-full"
        style={{
          fontSize: "0.68rem", textDecoration: "none",
          background: !isGeneral ? "rgba(184,154,94,0.14)" : "var(--surface)",
          border: `1px solid ${!isGeneral ? "rgba(184,154,94,0.4)" : "var(--border)"}`,
          color: !isGeneral ? "var(--foreground)" : "var(--muted)",
        }}
      >
        {tripTitle ?? "Aktuelle Reise"}
      </Link>
      <Link
        href="/concierge?scope=general"
        className="px-3 py-1.5 rounded-full"
        style={{
          fontSize: "0.68rem", textDecoration: "none",
          background: isGeneral ? "rgba(184,154,94,0.14)" : "var(--surface)",
          border: `1px solid ${isGeneral ? "rgba(184,154,94,0.4)" : "var(--border)"}`,
          color: isGeneral ? "var(--foreground)" : "var(--muted)",
        }}
      >
        Allgemein
      </Link>
    </div>
  );
}

type CardData = ReturnType<typeof buildConciergeCards>[number];

function AnswerCard({ card, hiddenFields, returnTo }: { card: CardData; hiddenFields: React.ReactNode; returnTo: string }) {
  return (
    <div className="rounded-xl p-6 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {card.questionLabel}
        </span>
      </div>
      <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: 400 }}>
        {card.title}
      </div>
      {/* §"Strukturierte, kurze Antworten statt langer Textblöcke": Zeilenumbrüche (Basis-Label/Empfehlung/fehlende Angabe, siehe lib/lumi-brain-ai.ts) werden als eigene Absätze dargestellt statt als ein einziger Fließtext-Block. */}
      {card.body.split("\n\n").filter(Boolean).map((paragraph, i) => (
        <p key={i} className="mb-2" style={{ color: i === 0 ? "var(--accent)" : "var(--muted)", fontSize: i === 0 ? "0.68rem" : "0.8rem", lineHeight: 1.6 }}>
          {paragraph}
        </p>
      ))}

      {card.links.length > 0 && (
        <div className="mb-3 mt-1 space-y-1.5">
          {card.links.map((l, i) => (
            <Link
              key={i}
              href={l.href}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--background)", border: "1px solid var(--border)", textDecoration: "none" }}
            >
              <span style={{ color: "var(--foreground)", fontSize: "0.74rem" }}>{l.label}</span>
              <ChevronRight size={12} strokeWidth={1.6} style={{ color: "var(--muted)", flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>
          {new Date(card.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {card.showRefresh && (
            <form action={refreshConciergeMessage}>
              {hiddenFields}
              <input type="hidden" name="question_key" value={card.key} />
              <input type="hidden" name="question_text" value={card.questionLabel} />
              <button
                type="submit"
                className="flex items-center gap-1.5"
                style={{
                  background: card.stale ? "rgba(184,154,94,0.12)" : "transparent",
                  color: card.stale ? "var(--accent)" : "var(--muted)",
                  border: card.stale ? "1px solid rgba(184,154,94,0.35)" : "1px solid var(--border)",
                  borderRadius: "20px", padding: "6px 12px", fontSize: "0.62rem", cursor: "pointer",
                }}
              >
                <RefreshCw size={11} strokeWidth={1.6} />
                {card.stale ? "Empfehlung aktualisieren" : "Änderung prüfen"}
              </button>
            </form>
          )}
          {card.canCommit && returnTo === RETURN_TO && (
            <form action={commitConciergeAction}>
              {hiddenFields}
              <input type="hidden" name="event_title" value={card.eventTitle} />
              <button
                type="submit"
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "20px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
                }}
              >
                {card.commitLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const GENERAL_QUICK_QUESTIONS = [
  "Welche Reiseziele passen zu unseren bisherigen Reisen?",
  "Welche bisherigen Hotels passen am besten zu unseren Vorlieben?",
];

/** §"Allgemein"-Modus (Nutzervorgabe): kein tripId, leichterer Kontext (Reisehistorie/Präferenzen statt einer konkreten Reise). */
async function GeneralConciergeView({ familyId }: { familyId: string }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const messages = await listTodayConciergeMessages(familyId, null, todayIso, "");
  const cards = buildConciergeCards(null, messages);

  const hiddenFields = (
    <>
      <input type="hidden" name="family_id" value={familyId} />
      <input type="hidden" name="trip_id" value="" />
      <input type="hidden" name="trip_slug" value="" />
      <input type="hidden" name="for_date" value={todayIso} />
      <input type="hidden" name="date_label" value={todayIso} />
      <input type="hidden" name="location_label" value="" />
      <input type="hidden" name="weather_summary" value="" />
      <input type="hidden" name="known_plan_text" value="" />
      <input type="hidden" name="highlight_title" value="" />
      <input type="hidden" name="member_names" value="" />
      <input type="hidden" name="return_to" value={RETURN_TO_GENERAL} />
    </>
  );

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="px-5 md:px-10 py-9" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
          Euer persönlicher Reiseberater
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "clamp(1.5rem, 5vw, 2rem)", letterSpacing: "-0.01em" }}>
          Was sollen wir als Nächstes klären?
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-8">
        <ScopeSwitch isGeneral tripTitle={null} />

        <section className="mb-8">
          <div style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: "10px" }}>
            Fragen ohne Bezug zu einer bestimmten Reise -- z. B. Inspiration aus euren bisherigen Reisen.
          </div>
          <div className="grid grid-cols-1 gap-2">
            {GENERAL_QUICK_QUESTIONS.map((q) => (
              <form key={q} action={askConcierge}>
                {hiddenFields}
                <input type="hidden" name="question_key" value="freetext" />
                <input type="hidden" name="question_text" value={q} />
                <button
                  type="submit"
                  className="w-full text-left"
                  style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px", fontSize: "0.78rem", cursor: "pointer" }}
                >
                  {q}
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <form action={askConcierge} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {hiddenFields}
            <input type="hidden" name="question_key" value="freetext" />
            <textarea
              name="question_text"
              rows={3}
              required
              placeholder="Zum Beispiel: Welche Hotels ähneln One&Only Mandarina?"
              style={{ width: "100%", padding: "16px 18px", background: "transparent", border: "none", outline: "none", resize: "none", color: "var(--foreground)", fontSize: "0.85rem", lineHeight: 1.6, fontWeight: 300 }}
            />
            <div className="flex items-center justify-end px-4 pb-4">
              <button type="submit" style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
                LUMI fragen
              </button>
            </div>
          </form>
        </section>

        {cards.length > 0 && (
          <section>
            {cards.map((card) => <AnswerCard key={card.key} card={card} hiddenFields={hiddenFields} returnTo={RETURN_TO_GENERAL} />)}
          </section>
        )}
      </div>
    </div>
  );
}

function ContextFields({ familyId, ctx }: { familyId: string; ctx: ContentStrategyContext }) {
  return (
    <>
      <input type="hidden" name="family_id" value={familyId} />
      <input type="hidden" name="trip_id" value={ctx.tripId} />
      <input type="hidden" name="trip_slug" value={ctx.tripSlug} />
      <input type="hidden" name="for_date" value={ctx.forDate} />
      <input type="hidden" name="date_label" value={ctx.dateLabel} />
      <input type="hidden" name="location_label" value={ctx.locationLabel} />
      <input type="hidden" name="weather_summary" value={ctx.weatherSummary ?? ""} />
      <input type="hidden" name="known_plan_text" value={ctx.knownPlanText} />
      <input type="hidden" name="highlight_title" value={ctx.highlightTitle ?? ""} />
      <input type="hidden" name="member_names" value={ctx.memberNames.join(",")} />
      <input type="hidden" name="return_to" value={RETURN_TO} />
    </>
  );
}

/** §"Kontextbezogene Schnellfragen" (Nutzervorgabe): zusätzlich zu den bestehenden deterministischen QUICK_ACTIONS -- deckt gezielt die neuen LUMI-Brain-Intents ab (Familienfit/Vergleich/Journey-Lücken), als Freitext vorbelegt statt eigener Buttons/Server-Actions. */
const TRIP_QUICK_QUESTIONS = [
  "Ist dieser Flug mit unseren Kindern sinnvoll?",
  "Welches Hotel passt besser zu uns?",
  "Wo gibt es noch freie Tage?",
];

export default async function ConciergePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const { id: familyId } = await getFamily();

  if (scope === "general") {
    return <GeneralConciergeView familyId={familyId} />;
  }

  const ctx = await buildContentStrategyContext(familyId);

  if (!ctx) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Euer persönlicher Reiseberater
          </div>
          <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "-0.01em" }}>
            Was sollen wir als Nächstes klären?
          </h1>
          <ScopeSwitch isGeneral={false} tripTitle={null} />
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Aktuell läuft keine Reise. Sobald eine Reise begonnen hat, hilft euch der Concierge hier mit Tagesplanung,
              offenen Punkten und schnellen Antworten. Allgemeine Fragen (z. B. Inspiration aus euren bisherigen Reisen)
              gehen auch ohne aktive Reise -- oben "Allgemein" wählen.
            </p>
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 mt-4"
              style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", textDecoration: "none" }}
            >
              Zu euren Reisen <ChevronRight size={13} strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fingerprint = buildContextFingerprint(ctx.weatherSummary, ctx.knownPlanText);
  const [messages, todayRec] = await Promise.all([
    listTodayConciergeMessages(familyId, ctx.tripId, ctx.forDate, fingerprint),
    getCachedTodayRecommendation(familyId, ctx.tripId, ctx.forDate),
  ]);

  const cards = buildConciergeCards(todayRec, messages);
  const hiddenFields = <ContextFields familyId={familyId} ctx={ctx} />;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div
        className="px-5 md:px-10 py-9"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
          Euer persönlicher Reiseberater
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "clamp(1.5rem, 5vw, 2rem)", letterSpacing: "-0.01em" }}>
          Was sollen wir als Nächstes klären?
        </h1>
        <div className="flex items-center gap-4 flex-wrap" style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
          <span>{ctx.tripTitle}</span>
          <div className="flex items-center gap-1.5">
            <MapPin size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
            {ctx.locationLabel}
          </div>
          {ctx.memberNames.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
              {ctx.memberNames.join(", ")}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-8">
        <ScopeSwitch isGeneral={false} tripTitle={ctx.tripTitle} />

        {/* ── Schnellaktionen ── */}
        <section className="mb-4">
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((qa) => (
              <form key={qa.key} action={askConcierge}>
                {hiddenFields}
                <input type="hidden" name="question_key" value={qa.key} />
                <input type="hidden" name="question_text" value={qa.label} />
                <button
                  type="submit"
                  className="w-full text-left"
                  style={{
                    background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)",
                    borderRadius: "10px", padding: "12px 14px", fontSize: "0.78rem", cursor: "pointer",
                  }}
                >
                  {qa.label}
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="grid grid-cols-1 gap-2">
            {TRIP_QUICK_QUESTIONS.map((q) => (
              <form key={q} action={askConcierge}>
                {hiddenFields}
                <input type="hidden" name="question_key" value="freetext" />
                <input type="hidden" name="question_text" value={q} />
                <button
                  type="submit"
                  className="w-full text-left"
                  style={{ background: "var(--surface)", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "10px", padding: "12px 14px", fontSize: "0.78rem", cursor: "pointer" }}
                >
                  {q}
                </button>
              </form>
            ))}
          </div>
        </section>

        {/* ── Freitextfrage ── */}
        <section className="mb-10">
          <form action={askConcierge} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {hiddenFields}
            <input type="hidden" name="question_key" value="freetext" />
            <textarea
              name="question_text"
              rows={3}
              required
              placeholder="Zum Beispiel: Sollen wir bei diesem Wetter lieber drinnen bleiben?"
              style={{
                width: "100%", padding: "16px 18px", background: "transparent", border: "none", outline: "none",
                resize: "none", color: "var(--foreground)", fontSize: "0.85rem", lineHeight: 1.6, fontWeight: 300,
              }}
            />
            <div className="flex items-center justify-end px-4 pb-4">
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                  padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                }}
              >
                Concierge fragen
              </button>
            </div>
          </form>
        </section>

        {/* ── Antworten als Karten ── */}
        {cards.length > 0 && (
          <section>
            {cards.map((card) => <AnswerCard key={card.key} card={card} hiddenFields={hiddenFields} returnTo={RETURN_TO} />)}
          </section>
        )}
      </div>
    </div>
  );
}
