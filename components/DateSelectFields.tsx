'use client'

import { useEffect, useState } from "react";
import { GERMAN_MONTHS, splitIsoDate } from "@/lib/documents";
import { isoToday, isoMonthOffset } from "@/lib/date-utils";

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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Untere/obere Schranke für Jahr/Monat/Tag aus `minIso`/`maxIso` ableiten,
 * abhängig von den bereits gewählten anderen Teilen (Jahr schränkt Monat
 * ein, Jahr+Monat schränken Tag ein) — Optionen außerhalb bleiben sichtbar,
 * aber `disabled`, statt ausgeblendet zu werden.
 */
function computeBounds(parts: DateParts, minIso?: string | null, maxIso?: string | null) {
  const min = minIso ? splitIsoDate(minIso) : null;
  const max = maxIso ? splitIsoDate(maxIso) : null;
  const minYear = min ? Number(min.year) : undefined;
  const maxYear = max ? Number(max.year) : undefined;

  const selectedYear = parts.year ? Number(parts.year) : undefined;
  const monthMin = min && selectedYear === minYear ? Number(min.month) : 1;
  const monthMax = max && selectedYear === maxYear ? Number(max.month) : 12;

  const selectedMonth = parts.month ? Number(parts.month) : undefined;
  const dayMin = min && selectedYear === minYear && selectedMonth === monthMin ? Number(min.day) : 1;
  const lastDayOfSelectedMonth = selectedYear && selectedMonth ? daysInMonth(selectedYear, selectedMonth) : 31;
  const dayMax = max && selectedYear === maxYear && selectedMonth === monthMax ? Number(max.day) : lastDayOfSelectedMonth;

  return { minYear, maxYear, monthMin, monthMax, dayMin, dayMax: Math.min(dayMax, lastDayOfSelectedMonth) };
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
 * §Reihenfolge Tag → Monat → Jahr (deutsches Datumsformat, zuvor Jahr →
 * Monat → Tag). Rein visuell/DOM-Reihenfolge -- die `name`-Attribute
 * (`${namePrefix}_day/_month/_year`) und damit `readDateGroupFromFormData`
 * bleiben unverändert, nichts an der Formularauswertung hängt an der
 * Anzeigereihenfolge.
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
  minIso,
  maxIso,
  onChange,
}: {
  label: string;
  namePrefix: string;
  defaultIso?: string | null;
  range: { minYear: number; maxYear: number };
  /** Sinnvoll für zukunftsgerichtete Felder (Reise-/Etappendatum), nicht für Geburtsdaten. */
  quickActions?: boolean;
  /** Früheste/späteste wählbare ISO-Datum (z. B. heute, oder das gewählte Hinflugdatum) — Optionen außerhalb bleiben sichtbar, aber deaktiviert. */
  minIso?: string | null;
  maxIso?: string | null;
  onChange?: (iso: string | null, parts: DateParts) => void;
}) {
  const [parts, setParts] = useState<DateParts>(() => splitIsoDate(defaultIso));

  const years: number[] = [];
  for (let y = range.maxYear; y >= range.minYear; y--) years.push(y);

  const bounds = computeBounds(parts, minIso, maxIso);

  // Wird die aktuelle Auswahl durch eine neue minIso/maxIso-Schranke ungültig
  // (z. B. Rückflugdatum liegt jetzt vor dem geänderten Hinflugdatum), leeren
  // wir die Auswahl statt sie stillschweigend als deaktivierte Option stehen
  // zu lassen.
  useEffect(() => {
    if (!parts.day || !parts.month || !parts.year) return;
    const iso = `${parts.year}-${parts.month}-${parts.day}`;
    const tooEarly = minIso ? iso < minIso : false;
    const tooLate = maxIso ? iso > maxIso : false;
    if (tooEarly || tooLate) {
      const cleared: DateParts = { day: "", month: "", year: "" };
      setParts(cleared);
      onChange?.(null, cleared);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minIso, maxIso]);

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
          nicht -- Monat bekommt bewusst mehr Raum als Tag/Jahr, die von
          Natur aus schmaler sein dürfen. */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "0.85fr 1.3fr 0.85fr" }}>
        <select
          name={`${namePrefix}_day`} value={parts.day}
          onChange={(e) => update({ day: e.target.value })}
          style={FIELD_STYLE} aria-label={`${label} – Tag`}
        >
          <option value="">Tag</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d).padStart(2, "0")} disabled={d < bounds.dayMin || d > bounds.dayMax}>{d}</option>
          ))}
        </select>
        <select
          name={`${namePrefix}_month`} value={parts.month}
          onChange={(e) => update({ month: e.target.value })}
          style={FIELD_STYLE} aria-label={`${label} – Monat`}
        >
          <option value="">Monat</option>
          {GERMAN_MONTHS.map((m, idx) => {
            const monthNum = idx + 1;
            return (
              <option key={m} value={String(monthNum).padStart(2, "0")} disabled={monthNum < bounds.monthMin || monthNum > bounds.monthMax}>{m}</option>
            );
          })}
        </select>
        <select
          name={`${namePrefix}_year`} value={parts.year}
          onChange={(e) => update({ year: e.target.value })}
          style={FIELD_STYLE} aria-label={`${label} – Jahr`}
        >
          <option value="">Jahr</option>
          {years.map((y) => (
            <option key={y} value={String(y)} disabled={(bounds.minYear !== undefined && y < bounds.minYear) || (bounds.maxYear !== undefined && y > bounds.maxYear)}>{y}</option>
          ))}
        </select>
      </div>
      {quickActions && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" onClick={() => applyQuickIso(isoToday(1))} style={QUICK_ACTION_STYLE}>Morgen</button>
          <button type="button" onClick={() => applyQuickIso(isoToday(7))} style={QUICK_ACTION_STYLE}>+1 Woche</button>
          <button type="button" onClick={() => applyQuickIso(isoMonthOffset(1))} style={QUICK_ACTION_STYLE}>+1 Monat</button>
        </div>
      )}
    </div>
  );
}
