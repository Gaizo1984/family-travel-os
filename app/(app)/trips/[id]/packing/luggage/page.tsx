import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { getFamily } from "@/lib/family";
import { loadTripParticipantOptions } from "@/lib/trip-participants";
import { loadPackingItems, loadPackingLuggage, computeLuggageWeightSummary } from "@/lib/packing-list";
import { addPackingLuggage, updatePackingLuggage, deletePackingLuggage } from "@/lib/actions/packing-luggage";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "6px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.85rem", fontWeight: 300, outline: "none",
};

function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;
}

/**
 * §"Optional sollen Gepäckstücke angelegt werden können ... Anzahl der
 * Gegenstände, geschätztes Gesamtgewicht, erlaubtes Gewicht sofern
 * zuverlässig vorhanden, verbleibende Reserve" (Nutzervorgabe, wörtlich):
 * eigene Verwaltungsseite, rein additiv -- die bestehende grobe
 * `luggage_assignment`-Zuordnung auf der Hauptseite bleibt unverändert
 * nutzbar, ohne dass hier je ein Gepäckstück angelegt werden muss.
 */
export default async function PackingLuggagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const lumiCore = await createLumiCoreClient();
  const { id: familyId } = await getFamily();
  const { data: trip } = await lumiCore.from("travel_trips").select("id, slug, title").eq("slug", id).maybeSingle();
  if (!trip) notFound();

  const [participants, items, luggage] = await Promise.all([
    loadTripParticipantOptions(lumiCore, trip.id, familyId),
    loadPackingItems(lumiCore, trip.id),
    loadPackingLuggage(lumiCore, trip.id),
  ]);

  const unassignedCount = items.filter((i) => i.luggageId === null && i.status !== "nicht_benoetigt").length;

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
          Gepäckstücke
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {trip.title}
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          Koffer, Handgepäck und Co. mit optionaler Gewichtsgrenze -- Gewichte sind immer nur eine Schätzung und jederzeit überschreibbar.
          {unassignedCount > 0 && ` ${unassignedCount} Gegenstände sind noch keinem Gepäckstück zugeordnet.`}
        </p>

        <div className="space-y-4 mb-8">
          {luggage.map((l) => {
            const summary = computeLuggageWeightSummary(items, l);
            const personName = l.personId ? participants.find((p) => p.id === l.personId)?.name ?? null : null;
            const assignedItems = items.filter((i) => i.luggageId === l.id && i.status !== "nicht_benoetigt");
            return (
              <div key={l.id} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div>
                    <span style={{ color: "var(--foreground)", fontSize: "0.9rem" }}>{l.label}</span>
                    {personName && <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}> · {personName}</span>}
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{summary.itemCount} Gegenstände</span>
                </div>

                <p style={{ color: summary.remainingGrams !== null && summary.remainingGrams < 0 ? "#B5624A" : "var(--muted)", fontSize: "0.74rem" }}>
                  ~{formatGrams(summary.estimatedWeightGrams)}{summary.hasUnknownWeights ? " (unvollständig)" : ""}
                  {summary.allowedWeightGrams !== null && (
                    summary.remainingGrams !== null && summary.remainingGrams < 0
                      ? ` · ${formatGrams(Math.abs(summary.remainingGrams))} über dem Limit von ${formatGrams(summary.allowedWeightGrams)}`
                      : ` von ${formatGrams(summary.allowedWeightGrams)} (${formatGrams(summary.remainingGrams ?? 0)} Reserve)`
                  )}
                </p>

                {assignedItems.length > 0 && (
                  <p className="mt-2" style={{ color: "var(--foreground)", fontSize: "0.72rem", lineHeight: 1.5 }}>
                    {assignedItems.map((i) => i.label).join(", ")}
                  </p>
                )}

                <details className="mt-3">
                  <summary style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.04em", cursor: "pointer" }}>Bearbeiten</summary>
                  <form action={updatePackingLuggage} className="mt-3 grid grid-cols-2 gap-3">
                    <input type="hidden" name="luggage_id" value={l.id} />
                    <input type="hidden" name="slug" value={trip.slug} />
                    <div className="col-span-2">
                      <label style={LABEL_STYLE}>Bezeichnung</label>
                      <input name="label" type="text" required defaultValue={l.label} style={FIELD_STYLE} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Person</label>
                      <select name="person_id" defaultValue={l.personId ?? ""} style={FIELD_STYLE}>
                        <option value="">Gemeinsam</option>
                        {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Erlaubtes Gewicht (g)</label>
                      <input name="allowed_weight_grams" type="number" min={0} step={500} defaultValue={l.allowedWeightGrams ?? ""} placeholder="optional" style={FIELD_STYLE} />
                    </div>
                    <div className="col-span-2">
                      <button type="submit" style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "8px 16px", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                        Speichern
                      </button>
                    </div>
                  </form>
                  <form action={deletePackingLuggage} className="mt-2">
                    <input type="hidden" name="luggage_id" value={l.id} />
                    <input type="hidden" name="slug" value={trip.slug} />
                    <button type="submit" style={{ background: "none", border: "none", padding: 0, color: "#B5624A", fontSize: "0.65rem", letterSpacing: "0.04em", cursor: "pointer" }}>
                      Gepäckstück löschen
                    </button>
                  </form>
                </details>
              </div>
            );
          })}
          {luggage.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", fontStyle: "italic" }}>Noch keine Gepäckstücke angelegt.</p>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "12px" }}>
            Gepäckstück hinzufügen
          </div>
          <form action={addPackingLuggage} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            <div className="col-span-2">
              <label style={LABEL_STYLE}>Bezeichnung</label>
              <input name="label" type="text" required placeholder="z. B. Koffer 1, Handgepäck Marcel" style={FIELD_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Person</label>
              <select name="person_id" style={FIELD_STYLE}>
                <option value="">Gemeinsam</option>
                {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Erlaubtes Gewicht (g)</label>
              <input name="allowed_weight_grams" type="number" min={0} step={500} placeholder="optional" style={FIELD_STYLE} />
            </div>
            <div className="col-span-2">
              <button type="submit" style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                Hinzufügen
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
