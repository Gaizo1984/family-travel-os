import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getFamily } from "@/lib/family";
import { listFamilyMemories } from "@/lib/family-memories";
import type { FamilyMemory, MemoryType } from "@/lib/family-memories";
import { deleteFamilyMemory, updateFamilyMemorySummary } from "@/lib/actions/family-memories";
import { Banner } from "@/components/Banner";
import { MemoryCandidateCard } from "@/components/MemoryCandidateCard";

const RETURN_TO = "/today/preferences";

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

function ConfirmedRow({ memory }: { memory: FamilyMemory }) {
  return (
    <div className="rounded-xl p-5 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {MEMORY_TYPE_LABELS[memory.memoryType]}
        </span>
        <form action={deleteFamilyMemory}>
          <input type="hidden" name="memory_id" value={memory.id} />
          <input type="hidden" name="return_to" value={RETURN_TO} />
          <button type="submit" style={{ background: "transparent", color: "var(--muted)", border: "none", fontSize: "0.65rem", letterSpacing: "0.04em", cursor: "pointer", textDecoration: "underline" }}>
            Löschen
          </button>
        </form>
      </div>
      <form action={updateFamilyMemorySummary} className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="memory_id" value={memory.id} />
        <input type="hidden" name="return_to" value={RETURN_TO} />
        <input
          name="summary" defaultValue={memory.summary}
          style={{ flex: 1, minWidth: "200px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", color: "var(--foreground)", fontSize: "0.8rem", fontWeight: 300 }}
        />
        <button type="submit" style={{ background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)", borderRadius: "6px", padding: "8px 14px", fontSize: "0.62rem", cursor: "pointer" }}>
          Speichern
        </button>
      </form>
    </div>
  );
}

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { id: familyId } = await getFamily();
  const allMemories = await listFamilyMemories(familyId);

  const pending = allMemories.filter((m) => m.status === "pending");
  const confirmed = allMemories.filter((m) => m.status === "confirmed");

  const byCategory = new Map<string, FamilyMemory[]>();
  for (const m of confirmed) {
    const list = byCategory.get(m.category) ?? [];
    list.push(m);
    byCategory.set(m.category, list);
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        <Link
          href="/today"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          LUMI
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
          Familien-Gedächtnis
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "clamp(1.5rem, 5vw, 2rem)", letterSpacing: "-0.01em" }}>
          Unsere Vorlieben
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          Was LUMI über eure Vorlieben und Erfahrungen weiß -- nur, was ihr bestätigt habt. Frag LUMI erkennt mögliche
          Erinnerungen im Gespräch, speichert sie aber nie ungefragt.
        </p>

        {error && <Banner variant="error">{error}</Banner>}

        {pending.length > 0 && (
          <section className="mb-10">
            <div className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Noch unbestätigt
            </div>
            {pending.map((m) => <MemoryCandidateCard key={m.id} memory={m} returnTo={RETURN_TO} />)}
          </section>
        )}

        {confirmed.length === 0 && pending.length === 0 && (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              Noch nichts gespeichert. Sobald ihr in Frag LUMI eine dauerhafte Vorliebe erwähnt und bestätigt, erscheint sie hier.
            </p>
          </div>
        )}

        {[...byCategory.entries()].map(([category, memories]) => (
          <section key={category} className="mb-10">
            <div className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              {categoryLabel(category)}
            </div>
            {memories.map((m) => <ConfirmedRow key={m.id} memory={m} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
