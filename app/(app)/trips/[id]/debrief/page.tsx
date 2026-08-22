import Link from "next/link";
import { notFound } from "next/navigation";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import { getFamily } from "@/lib/family";
import {
  loadActiveDebrief, buildDebriefMemoryCandidates, DEBRIEF_STEPS, DEBRIEF_STEP_LABELS,
  PACKING_FEEDBACK_TYPES, PACKING_FEEDBACK_TYPE_LABELS,
} from "@/lib/trip-debriefs";
import type { DebriefStep, PackingFeedbackEntry } from "@/lib/trip-debriefs";
import { loadTripParticipantOptions } from "@/lib/trip-participants";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { loadPackingItems } from "@/lib/packing-list";
import {
  saveDebriefStep, goToPreviousDebriefStep, skipDebrief, closeDebrief, confirmDebrief, toggleMemoryPhotoHighlight,
} from "@/lib/actions/trip-debriefs";

const STEP_FORM_ID = "debrief-step-form";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};
const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  background: "var(--foreground)", color: "var(--surface)", border: "none",
  borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem", letterSpacing: "0.16em",
  textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
};
const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  background: "transparent", color: "var(--muted)", border: "none",
  fontSize: "0.68rem", letterSpacing: "0.04em", cursor: "pointer", padding: 0,
};

function RadioChip({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: string }) {
  return (
    <label
      className="flex items-center gap-2 rounded-full px-4 py-2.5 cursor-pointer"
      style={{ background: checked ? "rgba(184,154,94,0.14)" : "var(--background)", border: `1px solid ${checked ? "rgba(184,154,94,0.4)" : "var(--border)"}` }}
    >
      <input type="radio" name={name} value={value} defaultChecked={checked} form={STEP_FORM_ID} style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
      <span style={{ color: checked ? "var(--foreground)" : "var(--muted)", fontSize: "0.8rem" }}>{label}</span>
    </label>
  );
}

/**
 * §"Zurück" und "Weiter" gehören zu zwei verschiedenen Server Actions
 * (goToPreviousDebriefStep vs. saveDebriefStep) -- HTML erlaubt keine
 * verschachtelten <form>-Elemente, deshalb NICHT ineinander, sondern als
 * Geschwister: "Weiter" ist ein Button AUSSERHALB des Antwort-Formulars,
 * per `form`-Attribut (STEP_FORM_ID) trotzdem damit verknüpft.
 */
function StepNav({ debriefId, slug, step }: { debriefId: string; slug: string; step: DebriefStep }) {
  const isFirstStep = DEBRIEF_STEPS.indexOf(step) === 0;
  return (
    <div className="flex items-center justify-between">
      {isFirstStep ? (
        <span />
      ) : (
        <form action={goToPreviousDebriefStep}>
          <input type="hidden" name="debrief_id" value={debriefId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="step" value={step} />
          <button type="submit" style={SECONDARY_BUTTON_STYLE}>← Zurück</button>
        </form>
      )}
      <button type="submit" form={STEP_FORM_ID} style={PRIMARY_BUTTON_STYLE}>Weiter</button>
    </div>
  );
}

export default async function TripDebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const family = await getFamily();
  const lumiCore = await createLumiCoreClient();

  const { data: trip } = await lumiCore
    .from("travel_trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();
  if (!trip) notFound();

  const debrief = await loadActiveDebrief(trip.id);

  if (!debrief) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Für diese Reise gibt es aktuell keinen offenen Rückblick.
            </p>
            <Link href={`/trips/${trip.slug}`} className="inline-flex items-center gap-1 mt-4" style={{ color: "var(--accent)", fontSize: "0.75rem", textDecoration: "none" }}>
              Zur Reise
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const participants = await loadTripParticipantOptions(lumiCore, trip.id, family.id);
  const step = debrief.currentStep;
  const stepIndex = DEBRIEF_STEPS.indexOf(step);

  let photos: Array<{ id: string; url: string | null; isHighlight: boolean }> = [];
  if (step === "highlight_photos" || step === "summary") {
    const { data: photosRaw } = await lumiCore
      .from("travel_memory_photos")
      .select("id, storage_path, is_highlight")
      .eq("trip_id", trip.id)
      .is("is_duplicate_of", null);
    const urlByPath = await getPhotoDisplayUrls(LUMI_CORE_DOCUMENTS_BUCKET, (photosRaw ?? []).map((p) => p.storage_path), "thumb400");
    photos = (photosRaw ?? []).map((p) => ({ id: p.id, isHighlight: p.is_highlight, url: urlByPath.get(p.storage_path)?.url ?? null }));
  }

  const packingItems = step === "packing_feedback" || step === "summary" ? await loadPackingItems(lumiCore, trip.id) : [];
  const selectedByType = new Map<string, Set<string>>(
    PACKING_FEEDBACK_TYPES.map((t) => [
      t,
      new Set((debrief.answers.packing_feedback ?? []).filter((e: PackingFeedbackEntry) => e.feedback_type === t && e.item_id).map((e: PackingFeedbackEntry) => e.item_id as string)),
    ]),
  );

  const previewCandidates = step === "summary" ? buildDebriefMemoryCandidates(trip.title, debrief.answers, participants, packingItems) : [];

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        <div className="flex items-center justify-between mb-6">
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            Rückblick · {trip.title}
          </div>
          <form action={closeDebrief}>
            <input type="hidden" name="debrief_id" value={debrief.id} />
            <input type="hidden" name="return_to" value={`/trips/${trip.slug}`} />
            <button type="submit" style={SECONDARY_BUTTON_STYLE}>Nicht mehr fragen</button>
          </form>
        </div>

        {step !== "intro" && (
          <>
            <div className="flex gap-1 mb-2">
              {DEBRIEF_STEPS.map((s, i) => (
                <div key={s} style={{ flex: 1, height: "3px", borderRadius: "2px", background: i <= stepIndex ? "var(--accent)" : "var(--border)" }} />
              ))}
            </div>
            <div className="mb-6" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Schritt {stepIndex + 1} von {DEBRIEF_STEPS.length} · {DEBRIEF_STEP_LABELS[step]}
            </div>
          </>
        )}

        <div className="rounded-xl p-6 md:p-8 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

          {step === "intro" && (
            <>
              <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
                Wie war eure Reise?
              </h1>
              <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                Ein paar kurze Fragen zu &quot;{trip.title}&quot; -- dauert nur wenige Minuten und hilft LUMI, künftige Vorschläge besser auf euch abzustimmen.
                Nichts wird automatisch gespeichert, ihr entscheidet am Ende, was übernommen wird.
              </p>
              <div className="flex items-center gap-4">
                <form action={saveDebriefStep}>
                  <input type="hidden" name="debrief_id" value={debrief.id} />
                  <input type="hidden" name="slug" value={trip.slug} />
                  <input type="hidden" name="step" value="intro" />
                  <button type="submit" style={PRIMARY_BUTTON_STYLE}>Loslegen</button>
                </form>
                <form action={skipDebrief}>
                  <input type="hidden" name="debrief_id" value={debrief.id} />
                  <input type="hidden" name="return_to" value={`/trips/${trip.slug}`} />
                  <button type="submit" style={SECONDARY_BUTTON_STYLE}>Überspringen</button>
                </form>
              </div>
            </>
          )}

          {step === "hotel_rating" && (
            <>
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <h2 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Wie hat euch die Unterkunft gefallen?</h2>
              <div className="flex flex-wrap gap-2 mb-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <RadioChip key={n} name="rating" value={String(n)} checked={debrief.answers.hotel_rating?.rating === n} label={"★".repeat(n)} />
                ))}
              </div>
              <label htmlFor="db-note" style={LABEL_STYLE}>Kurze Notiz (optional)</label>
              <textarea id="db-note" name="note" form={STEP_FORM_ID} rows={2} defaultValue={debrief.answers.hotel_rating?.note ?? ""} style={{ ...FIELD_STYLE, resize: "none", marginBottom: "20px" }} />
              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "best_moment" && (
            <>
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <h2 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Was war das schönste Erlebnis?</h2>
              <textarea name="text" form={STEP_FORM_ID} rows={3} defaultValue={debrief.answers.best_moment?.text ?? ""} placeholder="z. B. der Sonnenuntergang am Strand am dritten Tag" style={{ ...FIELD_STYLE, resize: "none", marginBottom: "20px" }} />
              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "worst_moment" && (
            <>
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <h2 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Was war enttäuschend, oder was würdet ihr anders machen?</h2>
              <textarea name="text" form={STEP_FORM_ID} rows={3} defaultValue={debrief.answers.worst_moment?.text ?? ""} placeholder="optional -- einfach freilassen, falls nichts einfällt" style={{ ...FIELD_STYLE, resize: "none", marginBottom: "20px" }} />
              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "person_highlights" && (
            <>
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <h2 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Was hat wem besonders gefallen?</h2>
              <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.76rem" }}>Optional, pro Person -- einfach freilassen, wo nichts passt.</p>
              <div className="space-y-4 mb-5">
                {participants.map((p) => (
                  <div key={p.id}>
                    <label htmlFor={`db-hl-${p.id}`} style={LABEL_STYLE}>{p.name}</label>
                    <input
                      id={`db-hl-${p.id}`} name={`highlight_${p.id}`} type="text" form={STEP_FORM_ID}
                      defaultValue={debrief.answers.person_highlights?.[p.id] ?? ""}
                      placeholder="z. B. die Wüstensafari"
                      style={FIELD_STYLE}
                    />
                  </div>
                ))}
              </div>
              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "would_revisit" && (
            <>
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <h2 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Würdet ihr das Ziel oder Hotel wieder besuchen?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                <RadioChip name="value" value="yes" checked={debrief.answers.would_revisit?.value === "yes"} label="Ja, gerne wieder" />
                <RadioChip name="value" value="maybe" checked={debrief.answers.would_revisit?.value === "maybe"} label="Vielleicht" />
                <RadioChip name="value" value="no" checked={debrief.answers.would_revisit?.value === "no"} label="Eher nicht" />
              </div>
              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "highlight_photos" && (
            <>
              <h2 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Welche Fotos gehören zu den Highlights?</h2>
              <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.76rem" }}>Antippen zum Markieren -- optional.</p>
              {photos.length === 0 ? (
                <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.8rem", fontStyle: "italic" }}>Für diese Reise sind noch keine Fotos hinterlegt.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {photos.map((photo) => (
                    <form key={photo.id} action={toggleMemoryPhotoHighlight}>
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <input type="hidden" name="slug" value={trip.slug} />
                      <input type="hidden" name="currently_highlighted" value={String(photo.isHighlight)} />
                      <button
                        type="submit"
                        className="relative block w-full rounded-lg overflow-hidden"
                        style={{ aspectRatio: "1", border: photo.isHighlight ? "2px solid var(--accent)" : "1px solid var(--border)", padding: 0, cursor: "pointer" }}
                      >
                        {photo.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        {photo.isHighlight && (
                          <span className="absolute top-1 right-1 rounded-full" style={{ background: "var(--accent)", color: "var(--surface)", fontSize: "0.6rem", padding: "2px 6px" }}>
                            ✓
                          </span>
                        )}
                      </button>
                    </form>
                  ))}
                </div>
              )}
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "packing_feedback" && (
            <>
              <form id={STEP_FORM_ID} action={saveDebriefStep}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="step" value={step} />
              </form>
              <h2 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Wie war&apos;s mit der Packliste?</h2>
              <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.76rem" }}>Optional -- hilft LUMI, künftige Packlisten für euch zu verbessern. Bestehende Gegenstände direkt anhaken, Fehlendes per Freitext ergänzen.</p>

              <div className="space-y-4 mb-6">
                {PACKING_FEEDBACK_TYPES.map((type) => {
                  const selected = selectedByType.get(type) ?? new Set<string>();
                  const existingFreeText = (debrief.answers.packing_feedback ?? [])
                    .find((e) => e.feedback_type === type && e.item_id === null)?.free_text ?? "";
                  return (
                    <details key={type} className="rounded-lg" style={{ border: "1px solid var(--border)" }} open={selected.size > 0 || Boolean(existingFreeText)}>
                      <summary className="p-3" style={{ color: "var(--foreground)", fontSize: "0.8rem", cursor: "pointer" }}>
                        {PACKING_FEEDBACK_TYPE_LABELS[type]}
                        {selected.size > 0 && <span style={{ color: "var(--accent)", fontSize: "0.68rem" }}> · {selected.size} ausgewählt</span>}
                      </summary>
                      <div className="p-3 pt-0">
                        {packingItems.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {packingItems.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer"
                                style={{ background: selected.has(item.id) ? "rgba(184,154,94,0.14)" : "var(--background)", border: `1px solid ${selected.has(item.id) ? "rgba(184,154,94,0.4)" : "var(--border)"}` }}
                              >
                                <input
                                  type="checkbox" name={`packing_feedback_${type}_items`} value={item.id}
                                  defaultChecked={selected.has(item.id)} form={STEP_FORM_ID}
                                  style={{ accentColor: "var(--accent)", width: "13px", height: "13px" }}
                                />
                                <span style={{ color: "var(--foreground)", fontSize: "0.74rem" }}>{item.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <input
                          name={`packing_feedback_${type}_text`} type="text" form={STEP_FORM_ID}
                          defaultValue={existingFreeText}
                          placeholder="Weiteres ergänzen (optional)"
                          style={FIELD_STYLE}
                        />
                      </div>
                    </details>
                  );
                })}
              </div>

              <StepNav debriefId={debrief.id} slug={trip.slug} step={step} />
            </>
          )}

          {step === "summary" && (
            <>
              <form id={STEP_FORM_ID} action={confirmDebrief}>
                <input type="hidden" name="debrief_id" value={debrief.id} />
                <input type="hidden" name="trip_id" value={trip.id} />
                <input type="hidden" name="family_id" value={family.id} />
                <input type="hidden" name="trip_title" value={trip.title} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="participants_json" value={JSON.stringify(participants.map((p) => ({ id: p.id, name: p.name })))} />
              </form>
              <h2 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.1rem" }}>Zusammenfassung</h2>

              {previewCandidates.length > 0 ? (
                <>
                  <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                    Diese Erkenntnisse werden als Vorschlag unter &quot;Unsere Vorlieben&quot; angelegt -- gespeichert wird erst, wenn ihr sie dort bestätigt:
                  </p>
                  <ul className="mb-6 space-y-2">
                    {previewCandidates.map((c, i) => (
                      <li key={i} className="rounded-lg px-3 py-2.5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{c.summary}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.78rem", fontStyle: "italic" }}>
                  Aus euren Antworten ergibt sich kein dauerhafter Vorschlag -- eure Angaben bleiben trotzdem bei der Reise gespeichert.
                </p>
              )}

              <div className="flex items-center justify-between">
                <form action={goToPreviousDebriefStep}>
                  <input type="hidden" name="debrief_id" value={debrief.id} />
                  <input type="hidden" name="slug" value={trip.slug} />
                  <input type="hidden" name="step" value={step} />
                  <button type="submit" style={SECONDARY_BUTTON_STYLE}>← Zurück</button>
                </form>
                <button type="submit" form={STEP_FORM_ID} style={PRIMARY_BUTTON_STYLE}>Bestätigen</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
