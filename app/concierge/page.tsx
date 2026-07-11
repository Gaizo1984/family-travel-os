import Link from "next/link";
import { ChevronRight, Users, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { getFamily } from "@/lib/family";
import { buildContentStrategyContext } from "@/lib/content-strategy-context";
import type { ContentStrategyContext } from "@/lib/content-strategy-context";
import { QUICK_ACTIONS } from "@/lib/concierge";
import { listTodayConciergeMessages, buildContextFingerprint } from "@/lib/concierge-messages";
import { getCachedTodayRecommendation } from "@/lib/today-recommendation";
import { askConcierge, refreshConciergeMessage, commitConciergeAction } from "@/lib/actions/concierge-actions";

type DisplayCard = {
  key: string;
  questionLabel: string;
  title: string;
  body: string;
  timestamp: string;
  stale: boolean;
  showRefresh: boolean;
  links: Array<{ label: string; href: string }>;
  eventTitle: string;
  canCommit: boolean;
  commitLabel: string;
};

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
    </>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

export default async function ConciergePage() {
  const { id: familyId } = await getFamily();

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
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Aktuell läuft keine Reise. Sobald eine Reise begonnen hat, hilft euch der Concierge hier mit Tagesplanung,
              offenen Punkten und schnellen Antworten.
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

  const DETERMINISTIC_KEYS = new Set(["plan_tomorrow", "whats_missing", "explain_conflict"]);
  const cards: DisplayCard[] = [];

  if (todayRec) {
    cards.push({
      key: "today_important",
      questionLabel: "Was ist heute wichtig?",
      title: todayRec.recommendation.title,
      body: todayRec.recommendation.description,
      timestamp: todayRec.createdAt,
      stale: false,
      showRefresh: false,
      links: [],
      eventTitle: todayRec.recommendation.title,
      canCommit: true,
      commitLabel: "In Journey übernehmen",
    });
  }

  for (const m of messages) {
    const isAiDriven = !DETERMINISTIC_KEYS.has(m.questionKey);
    cards.push({
      key: m.questionKey,
      questionLabel: m.questionText,
      title: m.title,
      body: m.body,
      timestamp: m.createdAt,
      stale: m.stale,
      showRefresh: isAiDriven,
      links: m.links,
      eventTitle: m.eventTitle,
      canCommit: isAiDriven,
      commitLabel: m.questionKey === "find_alternative" ? "Alternative speichern" : "In Journey übernehmen",
    });
  }

  cards.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

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

        {/* ── Schnellaktionen ── */}
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((qa) => (
              <form key={qa.key} action={askConcierge}>
                <ContextFields familyId={familyId} ctx={ctx} />
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

        {/* ── Freitextfrage ── */}
        <section className="mb-10">
          <form action={askConcierge} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <ContextFields familyId={familyId} ctx={ctx} />
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
            {cards.map((card) => (
              <div key={card.key} className="rounded-xl p-6 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {card.questionLabel}
                  </span>
                </div>
                <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: 400 }}>
                  {card.title}
                </div>
                <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                  {card.body}
                </p>

                {card.links.length > 0 && (
                  <div className="mb-3 space-y-1.5">
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
                  <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>{formatTimestamp(card.timestamp)}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {card.showRefresh && (
                      <form action={refreshConciergeMessage}>
                        <ContextFields familyId={familyId} ctx={ctx} />
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
                    {card.canCommit && (
                      <form action={commitConciergeAction}>
                        <input type="hidden" name="trip_id" value={ctx.tripId} />
                        <input type="hidden" name="trip_slug" value={ctx.tripSlug} />
                        <input type="hidden" name="for_date" value={ctx.forDate} />
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
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
