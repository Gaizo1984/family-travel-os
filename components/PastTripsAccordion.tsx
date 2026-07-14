'use client'

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type PastYearGroup = {
  year: number | null;
  count: number;
  node: React.ReactNode;
};

/**
 * §"DropDown-Menü nach Jahreszahl: 2025 -- öffnen -- danach erscheinen die
 * Reisen": Jahre starten eingeklappt, ein Klick öffnet genau ein Jahr und
 * zeigt dessen Reisen inline -- kein Seiten-Reload/Query-Param mehr nötig
 * (ersetzt die vorherige `YearFilterSelect`-Navigation).
 */
export function PastTripsAccordion({ groups }: { groups: PastYearGroup[] }) {
  const [openYear, setOpenYear] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = openYear === g.year || (g.year === null && openYear === -1);
        const key = g.year ?? -1;
        return (
          <div key={key} className="rounded-xl" style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setOpenYear(isOpen ? null : key)}
              className="w-full flex items-center justify-between px-5 py-4"
              style={{ background: "var(--surface)", border: "none", cursor: "pointer" }}
            >
              <span style={{ color: "var(--foreground)", fontSize: "0.92rem", fontWeight: 300 }}>
                {g.year ?? "Ohne Datum"}
              </span>
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.06em" }}>
                  {g.count} {g.count === 1 ? "Reise" : "Reisen"}
                </span>
                <ChevronDown
                  size={14}
                  strokeWidth={1.6}
                  style={{ color: "var(--muted)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}
                />
              </div>
            </button>
            {isOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4" style={{ background: "var(--background)" }}>
                {g.node}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
