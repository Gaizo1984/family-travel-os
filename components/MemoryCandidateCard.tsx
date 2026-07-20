'use client'

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { confirmFamilyMemory, declineFamilyMemory } from "@/lib/actions/family-memories";
import type { FamilyMemory, MemoryType } from "@/lib/family-memories";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  confirmed_preference: "Bestätigte Vorliebe",
  observed_pattern: "Beobachtetes Muster",
  trip_specific_preference: "Reisespezifische Vorliebe",
  family_member_preference: "Persönliche Vorliebe",
  experience: "Erfahrung",
};

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
}

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: "6px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer",
};

/**
 * §"Memory-Vorschläge in Frag LUMI als kleine Bestätigungskarte anzeigen,
 * nicht als langer Chattext" (Nutzervorgabe): geteilt zwischen /concierge
 * (direkt nach dem Gespräch), /today (eingebettetes Frag-LUMI-Panel) und
 * /today/preferences ("Unsere Vorlieben", Abschnitt "Noch unbestätigt") --
 * eine Quelle für dieses Muster.
 *
 * §"Buttons: Speichern / Bearbeiten / Nicht speichern" (Nutzervorgabe,
 * Frag-LUMI-Fix Punkt 1): "Bearbeiten" schaltet lokal in einen Bearbeiten-
 * Modus (reiner Anzeige-/Formular-Umschalter, kein zusätzlicher Server-
 * Roundtrip) -- der abschließende "Speichern"-Klick dort sendet die
 * bearbeitete Zusammenfassung im selben `confirmFamilyMemory`-Aufruf mit
 * (siehe lib/actions/family-memories.ts), kein zweiter Bestätigungsschritt
 * nötig. Deshalb Client-Komponente (lokaler Bearbeiten-Zustand), Server
 * Actions bleiben über `action={...}` auf den Formularen unverändert
 * nutzbar.
 */
export function MemoryCandidateCard({ memory, returnTo }: { memory: FamilyMemory; returnTo: string }) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(memory.summary);

  return (
    <div className="rounded-xl p-5 mb-3" style={{ background: "var(--surface)", border: "1px dashed rgba(184,154,94,0.4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {MEMORY_TYPE_LABELS[memory.memoryType]} · {categoryLabel(memory.category)}
        </span>
      </div>

      {!editing ? (
        <>
          <p className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 300 }}>
            {/* §Bugfix "Aktivitäten-Vorschläge beginnen mit Personenname" (Nutzer-Nachbesserung):
               personenbezogene Vorschläge (z. B. "Elias mag ...") beginnen mit einem
               Eigennamen -- der sollte nie kleingeschrieben werden. Familienweite
               Vorschläge (personId null) verhalten sich exakt wie bisher. */}
            Soll ich mir merken, dass {memory.personId ? summary : summary.charAt(0).toLowerCase() + summary.slice(1)}?
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <form action={confirmFamilyMemory}>
              <input type="hidden" name="memory_id" value={memory.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <SubmitButtonWithProgress
                label="Speichern" pendingLabel="Speichert..."
                style={{ padding: "6px 14px", fontSize: "0.62rem" }}
              />
            </form>
            <button type="button" onClick={() => setEditing(true)} style={SECONDARY_BUTTON_STYLE}>
              Bearbeiten
            </button>
            <form action={declineFamilyMemory}>
              <input type="hidden" name="memory_id" value={memory.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button type="submit" style={SECONDARY_BUTTON_STYLE}>
                Nicht speichern
              </button>
            </form>
          </div>
        </>
      ) : (
        <form action={confirmFamilyMemory}>
          <input type="hidden" name="memory_id" value={memory.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <textarea
            name="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="mb-3"
            style={{
              width: "100%", padding: "10px 12px", background: "var(--background)", border: "1px solid var(--border)",
              borderRadius: "6px", color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5, fontWeight: 300, resize: "none",
            }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <SubmitButtonWithProgress
              label="Speichern" pendingLabel="Speichert..."
              style={{ padding: "6px 14px", fontSize: "0.62rem" }}
            />
            <button type="button" onClick={() => setEditing(false)} style={SECONDARY_BUTTON_STYLE}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
