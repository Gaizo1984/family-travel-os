import Link from "next/link";
import { ChevronRight, Users, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { getFamily } from "@/lib/family";
import { buildContentStrategyContext } from "@/lib/content-strategy-context";
import type { ContentStrategyContext } from "@/lib/content-strategy-context";
import { QUICK_ACTIONS, buildConciergeCards } from "@/lib/concierge";
import { listTodayConciergeMessages, buildContextFingerprint } from "@/lib/concierge-messages";
import { getCachedTodayRecommendation } from "@/lib/today-recommendation";
import { askConcierge, refreshConciergeMessage, commitConciergeAction } from "@/lib/actions/concierge-actions";
import { listTripsForPicker, resolveDefaultTripId, getRememberedTripId } from "@/lib/lumi-trip-picker";
import type { TripPickerEntry } from "@/lib/lumi-trip-picker";
import { LumiTripPicker } from "@/components/LumiTripPicker";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import { listFamilyMemories } from "@/lib/family-memories";
import type { FamilyMemory } from "@/lib/family-memories";
import { MemoryCandidateCard } from "@/components/MemoryCandidateCard";

/** §"Basierend auf..." (Nutzervorgabe) -- rein deterministisch, keine KI-Vorschau; identischer Wortlaut wie lib/lumi-brain-ai.ts::buildBasisLabel, hier nur als UI-Text ohne KI-Aufruf dupliziert. */
function basisLabelFor(selectedTrip: TripPickerEntry | null): string {
  return selectedTrip ? `Basierend auf eurer Reise ${selectedTrip.title}` : "Basierend auf euren bisherigen Reisen und euren Präferenzen";
}

/** §"Reiseauswahl in Frag LUMI" (Nutzervorgabe): Pill "Reise auswählen"/Titel öffnet den Picker, daneben "Allgemein" -- keine weiteren langen Pill-Reihen. */
function ModeSwitch({ trips, selectedTripId, familyId, isGeneral }: { trips: TripPickerEntry[]; selectedTripId: string | null; familyId: string; isGeneral: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <LumiTripPicker trips={trips} selectedTripId={selectedTripId} familyId={familyId} returnToBase="/concierge" />
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

function AnswerCard({ card, hiddenFields, allowCommit }: { card: CardData; hiddenFields: React.ReactNode; allowCommit: boolean }) {
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
              <SubmitButtonWithProgress
                label={card.stale ? "Empfehlung aktualisieren" : "Änderung prüfen"}
                pendingLabel="Wird geprüft..."
                icon={<RefreshCw size={11} strokeWidth={1.6} />}
                style={{
                  background: card.stale ? "rgba(184,154,94,0.12)" : "transparent",
                  color: card.stale ? "var(--accent)" : "var(--muted)",
                  border: card.stale ? "1px solid rgba(184,154,94,0.35)" : "1px solid var(--border)",
                  borderRadius: "20px", padding: "6px 12px", fontSize: "0.62rem",
                  textTransform: "none", letterSpacing: "normal",
                }}
              />
            </form>
          )}
          {card.canCommit && allowCommit && (
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

/** §"Kontextbezogene Schnellfragen" (Nutzervorgabe): deckt gezielt die LUMI-Brain-Intents ab (Familienfit/Vergleich/Journey-Lücken), als Freitext vorbelegt statt eigener Buttons/Server-Actions -- funktioniert unabhängig vom Aktiv-Status der Reise. */
const TRIP_QUICK_QUESTIONS = [
  "Ist dieser Flug mit unseren Kindern sinnvoll?",
  "Welches Hotel passt besser zu uns?",
  "Wo gibt es noch freie Tage?",
];

function QuickQuestionButtons({ questions, hiddenFields }: { questions: string[]; hiddenFields: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {questions.map((q) => (
        <form key={q} action={askConcierge}>
          {hiddenFields}
          <input type="hidden" name="question_key" value="freetext" />
          <input type="hidden" name="question_text" value={q} />
          <SubmitButtonWithProgress
            label={q}
            pendingLabel="LUMI denkt nach..."
            className="w-full text-left"
            style={{
              background: "var(--surface)", color: "var(--foreground)", border: "1px dashed var(--border)",
              borderRadius: "10px", padding: "12px 14px", fontSize: "0.78rem",
              textTransform: "none", letterSpacing: "normal", justifyContent: "flex-start",
            }}
          />
        </form>
      ))}
    </div>
  );
}

function FreetextForm({ hiddenFields, placeholder }: { hiddenFields: React.ReactNode; placeholder: string }) {
  return (
    <form action={askConcierge} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {hiddenFields}
      <input type="hidden" name="question_key" value="freetext" />
      <textarea
        name="question_text"
        rows={3}
        required
        placeholder={placeholder}
        style={{ width: "100%", padding: "16px 18px", background: "transparent", border: "none", outline: "none", resize: "none", color: "var(--foreground)", fontSize: "0.85rem", lineHeight: 1.6, fontWeight: 300 }}
      />
      <div className="flex items-center justify-end px-4 pb-4">
        <SubmitButtonWithProgress label="LUMI fragen" pendingLabel="LUMI denkt nach..." />
      </div>
    </form>
  );
}

function ContextFields({
  familyId, tripId, tripSlug, forDate, dateLabel, locationLabel, weatherSummary, knownPlanText, highlightTitle, memberNames, returnTo,
}: {
  familyId: string; tripId: string; tripSlug: string; forDate: string; dateLabel: string; locationLabel: string
  weatherSummary: string | null; knownPlanText: string; highlightTitle: string | null; memberNames: string[]; returnTo: string
}) {
  return (
    <>
      <input type="hidden" name="family_id" value={familyId} />
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="trip_slug" value={tripSlug} />
      <input type="hidden" name="for_date" value={forDate} />
      <input type="hidden" name="date_label" value={dateLabel} />
      <input type="hidden" name="location_label" value={locationLabel} />
      <input type="hidden" name="weather_summary" value={weatherSummary ?? ""} />
      <input type="hidden" name="known_plan_text" value={knownPlanText} />
      <input type="hidden" name="highlight_title" value={highlightTitle ?? ""} />
      <input type="hidden" name="member_names" value={memberNames.join(",")} />
      <input type="hidden" name="return_to" value={returnTo} />
    </>
  );
}

function StatusNotices({ sp }: { sp: { error?: string; notice?: string } }) {
  return (
    <>
      {sp.error && <Banner variant="error">{sp.error}</Banner>}
      {sp.notice && (
        <div className="mb-6 px-4 py-3 rounded-lg" style={{ background: "rgba(184,154,94,0.08)", border: "1px solid rgba(184,154,94,0.25)", color: "var(--muted)", fontSize: "0.75rem", lineHeight: 1.6 }}>
          {sp.notice}
        </div>
      )}
    </>
  );
}

export default async function ConciergePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; trip?: string; error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const { id: familyId } = await getFamily();
  const todayIso = todayIsoInFamilyTimezone();

  const trips = await listTripsForPicker(familyId);
  const rememberedTripId = await getRememberedTripId(familyId);

  let selectedTripId: string | null;
  if (sp.scope === "general") {
    selectedTripId = null;
  } else if (sp.trip) {
    const found = trips.find((t) => t.slug === sp.trip);
    selectedTripId = found ? found.id : resolveDefaultTripId(trips, rememberedTripId);
  } else {
    selectedTripId = resolveDefaultTripId(trips, rememberedTripId);
  }

  const selectedTrip = selectedTripId ? trips.find((t) => t.id === selectedTripId) ?? null : null;
  const isGeneral = !selectedTrip;
  const returnTo = isGeneral ? "/concierge?scope=general" : `/concierge?trip=${selectedTrip.slug}`;
  const basisLabel = basisLabelFor(selectedTrip);

  const modeSwitch = <ModeSwitch trips={trips} selectedTripId={selectedTripId} familyId={familyId} isGeneral={isGeneral} />;
  const basisLine = (
    <div className="mb-6" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
      {basisLabel}
    </div>
  );

  // §"Memory-Vorschläge in Frag LUMI als kleine Bestätigungskarte anzeigen"
  // (Nutzervorgabe): familienweite Kandidaten (kein trip_id) erscheinen in
  // jedem Modus, reisegebundene Kandidaten nur bei der passenden Reise.
  const allPendingMemories = await listFamilyMemories(familyId, "pending");
  const pendingMemories: FamilyMemory[] = allPendingMemories.filter(
    (m) => m.tripId === null || m.tripId === selectedTrip?.id,
  );
  const memoryCandidatesSection = pendingMemories.length > 0 && (
    <section className="mb-6">
      {pendingMemories.map((m) => <MemoryCandidateCard key={m.id} memory={m} returnTo={returnTo} />)}
    </section>
  );

  // ── Allgemein ──────────────────────────────────────────────────────────
  if (isGeneral) {
    const messages = await listTodayConciergeMessages(familyId, null, todayIso, "");
    const cards = buildConciergeCards(null, messages);
    const hiddenFields = (
      <ContextFields
        familyId={familyId} tripId="" tripSlug="" forDate={todayIso} dateLabel={todayIso}
        locationLabel="" weatherSummary={null} knownPlanText="" highlightTitle={null} memberNames={[]} returnTo={returnTo}
      />
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
          {modeSwitch}
          {basisLine}
          <StatusNotices sp={sp} />
          {memoryCandidatesSection}

          <section className="mb-8">
            <div style={{ color: "var(--muted)", fontSize: "0.68rem", marginBottom: "10px" }}>
              Fragen ohne Bezug zu einer bestimmten Reise -- z. B. Inspiration aus euren bisherigen Reisen.
            </div>
            <QuickQuestionButtons questions={GENERAL_QUICK_QUESTIONS} hiddenFields={hiddenFields} />
          </section>

          <section className="mb-10">
            <FreetextForm hiddenFields={hiddenFields} placeholder="Zum Beispiel: Welche Hotels ähneln One&Only Mandarina?" />
          </section>

          {cards.length > 0 && (
            <section>
              {cards.map((card) => <AnswerCard key={card.key} card={card} hiddenFields={hiddenFields} allowCommit={false} />)}
            </section>
          )}
        </div>
      </div>
    );
  }

  // ── Konkrete Reise gewählt ───────────────────────────────────────────
  const ctx: ContentStrategyContext | null = await buildContentStrategyContext(familyId, selectedTrip.id);

  if (ctx) {
    // Reise ist aktiv gerade laufend -- voller "heutiger" Kontext (unverändert).
    const fingerprint = buildContextFingerprint(ctx.weatherSummary, ctx.knownPlanText);
    const [messages, todayRec] = await Promise.all([
      listTodayConciergeMessages(familyId, ctx.tripId, ctx.forDate, fingerprint),
      getCachedTodayRecommendation(familyId, ctx.tripId, ctx.forDate),
    ]);
    const cards = buildConciergeCards(todayRec, messages);
    const hiddenFields = (
      <ContextFields
        familyId={familyId} tripId={ctx.tripId} tripSlug={ctx.tripSlug} forDate={ctx.forDate} dateLabel={ctx.dateLabel}
        locationLabel={ctx.locationLabel} weatherSummary={ctx.weatherSummary} knownPlanText={ctx.knownPlanText}
        highlightTitle={ctx.highlightTitle} memberNames={ctx.memberNames} returnTo={returnTo}
      />
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
          {modeSwitch}
          {basisLine}
          <StatusNotices sp={sp} />
          {memoryCandidatesSection}

          <section className="mb-4">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((qa) => (
                <form key={qa.key} action={askConcierge}>
                  {hiddenFields}
                  <input type="hidden" name="question_key" value={qa.key} />
                  <input type="hidden" name="question_text" value={qa.label} />
                  <SubmitButtonWithProgress
                    label={qa.label}
                    pendingLabel="LUMI denkt nach..."
                    className="w-full text-left"
                    style={{
                      background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)",
                      borderRadius: "10px", padding: "12px 14px", fontSize: "0.78rem",
                      textTransform: "none", letterSpacing: "normal", justifyContent: "flex-start",
                    }}
                  />
                </form>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <QuickQuestionButtons questions={TRIP_QUICK_QUESTIONS} hiddenFields={hiddenFields} />
          </section>

          <section className="mb-10">
            <FreetextForm hiddenFields={hiddenFields} placeholder="Zum Beispiel: Sollen wir bei diesem Wetter lieber drinnen bleiben?" />
          </section>

          {cards.length > 0 && (
            <section>
              {cards.map((card) => <AnswerCard key={card.key} card={card} hiddenFields={hiddenFields} allowCommit />)}
            </section>
          )}
        </div>
      </div>
    );
  }

  // ── Konkrete Reise gewählt, aber nicht aktiv laufend (geplant/vergangen) ──
  // §"Bei ausgewählter Reise muss Frag LUMI den vollständigen vorhandenen
  // Kontext nutzen" (Nutzervorgabe): "heutiger Plan"/Wetter ergeben hier
  // keinen Sinn (siehe buildContentStrategyContext), Readiness/Journey/
  // Dokumente/Flüge/Hotels bleiben über buildLumiBrainContext trotzdem
  // vollständig nutzbar -- daher bleiben Freitext + Schnellfragen aktiv,
  // nur die "heute"-QUICK_ACTIONS entfallen (die diesen Kontext brauchen).
  const messages = await listTodayConciergeMessages(familyId, selectedTrip.id, todayIso, "");
  const cards = buildConciergeCards(null, messages);
  const hiddenFields = (
    <ContextFields
      familyId={familyId} tripId={selectedTrip.id} tripSlug={selectedTrip.slug} forDate={todayIso} dateLabel={todayIso}
      locationLabel={selectedTrip.destinationLabel ?? ""} weatherSummary={null} knownPlanText="" highlightTitle={null}
      memberNames={[]} returnTo={returnTo}
    />
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
        <div className="flex items-center gap-4 flex-wrap" style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
          <span>{selectedTrip.title}</span>
          <span>{selectedTrip.dateRangeLabel}</span>
          {selectedTrip.destinationLabel && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
              {selectedTrip.destinationLabel}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-8">
        {modeSwitch}
        {basisLine}
        <StatusNotices sp={sp} />
        {memoryCandidatesSection}

        <section className="mb-8">
          <QuickQuestionButtons questions={TRIP_QUICK_QUESTIONS} hiddenFields={hiddenFields} />
        </section>

        <section className="mb-10">
          <FreetextForm hiddenFields={hiddenFields} placeholder="Zum Beispiel: Was fehlt für diese Reise noch?" />
        </section>

        {cards.length > 0 && (
          <section>
            {cards.map((card) => <AnswerCard key={card.key} card={card} hiddenFields={hiddenFields} allowCommit={false} />)}
          </section>
        )}
      </div>
    </div>
  );
}
