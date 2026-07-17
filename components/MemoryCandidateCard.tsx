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

/**
 * §"Memory-Vorschläge in Frag LUMI als kleine Bestätigungskarte anzeigen,
 * nicht als langer Chattext" (Nutzervorgabe): geteilt zwischen /concierge
 * (direkt nach dem Gespräch) und /today/preferences ("Unsere Vorlieben",
 * Abschnitt "Noch unbestätigt") -- eine Quelle für dieses Muster.
 */
export function MemoryCandidateCard({ memory, returnTo }: { memory: FamilyMemory; returnTo: string }) {
  return (
    <div className="rounded-xl p-5 mb-3" style={{ background: "var(--surface)", border: "1px dashed rgba(184,154,94,0.4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {MEMORY_TYPE_LABELS[memory.memoryType]} · {categoryLabel(memory.category)}
        </span>
      </div>
      <p className="mb-3" style={{ color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 300 }}>
        Soll ich mir merken, dass {memory.summary.charAt(0).toLowerCase() + memory.summary.slice(1)}?
      </p>
      <div className="flex items-center gap-2">
        <form action={confirmFamilyMemory}>
          <input type="hidden" name="memory_id" value={memory.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <SubmitButtonWithProgress
            label="Bestätigen" pendingLabel="Speichert..."
            style={{ padding: "6px 14px", fontSize: "0.62rem" }}
          />
        </form>
        <form action={declineFamilyMemory}>
          <input type="hidden" name="memory_id" value={memory.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 14px", fontSize: "0.62rem", cursor: "pointer" }}
          >
            Nicht merken
          </button>
        </form>
      </div>
    </div>
  );
}
