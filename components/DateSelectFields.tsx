'use client'

import { useState } from "react";
import { GERMAN_MONTHS, splitIsoDate } from "@/lib/documents";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "14px 6px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.82rem", fontWeight: 300, outline: "none", minHeight: "44px",
};
const QUICK_ACTION_STYLE: React.CSSProperties = {
  fontSize: "0.65rem", color: "var(--accent)", background: "var(--background)",
  border: "1px solid var(--border)", padding: "8px 14px", borderRadius: "20px",
  cursor: "pointer", minHeight: "36px", WebkitAppearance: "none", appearance: "none",
};

export type DateParts = { day: string; month: string; year: string };

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function isoMonthOffset(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

/**
 * Gemeinsame Datumsauswahl-Komponente für Reisen, Etappen, Dokumente,
 * Versicherungen und weitere Datumsfelder — ersetzt sowohl die frühere
 * eigene Implementierung dieser Komponente als auch die rohen
 * `<input type="date">`-Felder in StageDateFields/BookingDateFields/
 * trips/new/trips/edit/plan/memories, deren natives Betriebssystem-
 * Kalender-UI auf manchen Mobile-Browsern abgeschnittene Schrift,
 * Viewport-Überlauf und monatelanges Zurückklicken verursachte (kein
 * Problem bei drei unabhängigen <select>-Feldern, die immer sofort das
 * volle Jahr/Monat/Tag-Angebot zeigen).
 *
 * Reihenfolge Jahr → Monat → Tag (schnelle Jahresauswahl zuerst, wichtig für
 * weit zurückliegende Geburtsdaten wie für weit entfernte Reisedaten).
 * Intern kontrolliert (eigener State) — `onChange` erlaubt umgebenden
 * Komponenten (Start-/Enddatum-Kopplung, Nächte-Berechnung) auf Änderungen
 * zu reagieren, ohne dass diese Komponente selbst kontrolliert werden muss.
 */
export function DateSelectFields({
  label,
  namePrefix,
  defaultIso,
  range,
  quickActions,
  onChange,
}: {
  label: string;
  namePrefix: string;
  defaultIso?: string | null;
  range: { minYear: number; maxYear: number };
  /** Sinnvoll für zukunftsgerichtete Felder (Reise-/Etappendatum), nicht für Geburtsdaten. */
  quickActions?: boolean;
  onChange?: (iso: string | null, parts: DateParts) => void;
}) {
  const [parts, setParts] = useState<DateParts>(() => splitIsoDate(defaultIso));

  const years: number[] = [];
  for (let y = range.maxYear; y >= range.minYear; y--) years.push(y);

  function update(next: Partial<DateParts>) {
    const merged = { ...parts, ...next };
    setParts(merged);
    if (onChange) {
      const iso = merged.day && merged.month && merged.year ? `${merged.year}-${merged.month}-${merged.day}` : null;
      onChange(iso, merged);
    }
  }

  function applyQuickIso(iso: string) {
    update(splitIsoDate(iso));
  }

  return (
    <div className="mb-5">
      <label style={LABEL_STYLE}>{label}</label>
      {/* §"Längere Monatsnamen wie September sind abgeschnitten": bei
          gleich breiten Dritteln reicht der Platz für "September"/"Dezember"
          nicht -- Monat bekommt bewusst mehr Raum als Jahr (4 Ziffern) und
          Tag (max. 2 Ziffern), die von Natur aus schmaler sein dürfen. */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "0.85fr 1.3fr 0.85fr" }}>
        <select
          name={`${namePrefix}_year`} value={parts.year}
          onChange={(e) => update({ year: e.target.value })}
          style={FIELD_STYLE} aria-label={`${label} – Jahr`}
        >
          <option value="">Jahr</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select
          name={`${namePrefix}_month`} value={parts.month}
          onChange={(e) => update({ month: e.target.value })}
          style={FIELD_STYLE} aria-label={`${label} – Monat`}
        >
          <option value="">Monat</option>
          {GERMAN_MONTHS.map((m, idx) => (
            <option key={m} value={String(idx + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <select
          name={`${namePrefix}_day`} value={parts.day}
          onChange={(e) => update({ day: e.target.value })}
          style={FIELD_STYLE} aria-label={`${label} – Tag`}
        >
          <option value="">Tag</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
          ))}
        </select>
      </div>
      {quickActions && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" onClick={() => applyQuickIso(isoToday(0))} style={QUICK_ACTION_STYLE}>Heute</button>
          <button type="button" onClick={() => applyQuickIso(isoToday(1))} style={QUICK_ACTION_STYLE}>Morgen</button>
          <button type="button" onClick={() => applyQuickIso(isoToday(7))} style={QUICK_ACTION_STYLE}>+1 Woche</button>
          <button type="button" onClick={() => applyQuickIso(isoMonthOffset(1))} style={QUICK_ACTION_STYLE}>+1 Monat</button>
        </div>
      )}
    </div>
  );
}
