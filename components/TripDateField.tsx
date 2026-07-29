'use client'

import { useState } from "react";
import { splitIsoDate } from "@/lib/documents";
import { enumerateIsoDates, formatIsoWithWeekday, formatIsoFullDE, tripDayNumber, addDaysIso, isoToday } from "@/lib/date-utils";
import { buildStageByDateMap, type StageDateLookupInput } from "@/lib/journey";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "14px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.82rem", fontWeight: 300, outline: "none", minHeight: "44px",
};
const QUICK_ACTION_STYLE: React.CSSProperties = {
  fontSize: "0.65rem", color: "var(--accent)", background: "var(--background)",
  border: "1px solid var(--border)", padding: "8px 14px", borderRadius: "20px",
  cursor: "pointer", minHeight: "36px", WebkitAppearance: "none", appearance: "none",
};
const READOUT_STYLE: React.CSSProperties = { marginTop: "8px", color: "var(--muted)", fontSize: "0.72rem" };
const WARNING_STYLE: React.CSSProperties = { marginTop: "8px", color: "#B5624A", fontSize: "0.68rem", letterSpacing: "0.01em" };

/**
 * §"Reisebezogene Buchungen: eine Datumsauswahl statt drei Dropdowns, auf
 * den Reisezeitraum begrenzt, mit Reisetag/Wochentag" (Nutzervorgabe,
 * wörtlich) -- natives `<select>` (bewusst kein eigener Bottom-Sheet-Dialog,
 * siehe Plan: die Options-Liste des Browsers rendert ohnehin außerhalb der
 * Seiten-DOM-Stapelreihenfolge, "Bottom-Nav überdeckt Dialog" ist damit kein
 * Thema). Nur für die in `TRIP_BOUNDED_BOOKING_TYPES` (lib/bookings.ts)
 * gelisteten Buchungsarten gedacht -- ersetzt dort `DateSelectFields`/
 * `DaySelectField`, die für Journey-Termine, Geburtsdaten, Dokumente,
 * Versicherung, Reise-/Etappen-Anlage sowie Flug/Unterkunft/Versicherung in
 * Buchungen unverändert weiterlaufen (bewusst KEINE Änderung an diesen
 * bestehenden Komponenten, um deren andere Aufrufstellen nicht anzufassen).
 *
 * Eine einzige Regel für "ungültig" (Reisezeitraum-Verstoß UND, über
 * `earliestIso`, Ende-vor-Start bei Mietwagen/Transfer): ein Wert außerhalb
 * `[effectiveMin, effectiveMax]` wird NIE automatisch geändert/geleert --
 * er bleibt ausgewählt (als Zusatzoption ergänzt) und darunter erscheint
 * ein Warnhinweis. Sendet dieselben `${namePrefix}_day/_month/_year`-
 * Hidden-Felder wie `DaySelectField`/`DateSelectFields`, damit
 * `readDateGroupFromFormData` unverändert bleibt.
 */
export function TripDateField({
  label,
  namePrefix,
  defaultIso,
  required = true,
  tripStartIso,
  tripEndIso,
  marginDays = 0,
  earliestIso,
  stages,
  quickActions,
  onChange,
}: {
  label: string;
  namePrefix: string;
  defaultIso?: string | null;
  /** false für optionale Enddatumsfelder (Mietwagen/Transfer/Zug/Fähre/Sonstiges -- Enddatum bleibt wie bisher optional). */
  required?: boolean;
  tripStartIso: string;
  tripEndIso: string;
  /** 2 nur für Aktivität/Restaurant (bestehender ±2-Tage-Puffer), sonst 0. */
  marginDays?: number;
  /** Für gekoppeltes Enddatum (Mietwagen/Transfer): untere Schranke = aktuell gewähltes Startdatum statt Reisebeginn. */
  earliestIso?: string | null;
  /** Optional: für "· Ort"-Suffix je Option und die Vollanzeige, via buildStageByDateMap (keine parallele Etappenlogik). */
  stages?: StageDateLookupInput[];
  /** "Morgen"/"+1 Woche", je nur wenn das Ergebnis im gültigen Bereich liegt -- kein "+1 Monat" in dieser Komponente. */
  quickActions?: boolean;
  onChange?: (iso: string | null) => void;
}) {
  const [value, setValue] = useState<string>(defaultIso ?? "");

  const naturalMin = addDaysIso(tripStartIso, -marginDays);
  const naturalMax = addDaysIso(tripEndIso, marginDays);
  const effectiveMin = earliestIso && earliestIso > naturalMin ? earliestIso : naturalMin;
  const effectiveMax = naturalMax;
  const lastDayNumber = tripDayNumber(tripEndIso, tripStartIso);

  const baseDays = enumerateIsoDates(effectiveMin, effectiveMax);
  const outOfRange = Boolean(value && (value < effectiveMin || value > effectiveMax));
  const days = outOfRange && !baseDays.includes(value) ? [...baseDays, value].sort() : baseDays;

  const stageByDate = stages && stages.length > 0 ? buildStageByDateMap(stages, effectiveMin) : null;

  function dayLabel(iso: string): string {
    const dayNumber = tripDayNumber(iso, tripStartIso);
    const suffix = dayNumber < 1 ? "Vor Reisebeginn" : dayNumber > lastDayNumber ? "Nach Reiseende" : `Reisetag ${dayNumber}`;
    const stage = stageByDate?.get(iso);
    const place = stage?.location || stage?.title;
    return `${formatIsoWithWeekday(iso)} · ${suffix}${place ? ` · ${place}` : ""}`;
  }

  function update(iso: string) {
    setValue(iso);
    onChange?.(iso || null);
  }

  function applyQuickIso(iso: string) {
    if (iso < effectiveMin || iso > effectiveMax) return;
    update(iso);
  }

  const parts = splitIsoDate(value || null);
  const selectedDayNumber = value ? tripDayNumber(value, tripStartIso) : null;
  const withinTrip = selectedDayNumber !== null && selectedDayNumber >= 1 && selectedDayNumber <= lastDayNumber;

  return (
    <div className="mb-5">
      <label htmlFor={`${namePrefix}-trip-day-select`} style={LABEL_STYLE}>{label}</label>
      <select
        id={`${namePrefix}-trip-day-select`}
        value={value}
        onChange={(e) => update(e.target.value)}
        required={required}
        style={FIELD_STYLE}
      >
        <option value="">{required ? "Tag wählen" : "Kein Datum"}</option>
        {days.map((iso) => (
          <option key={iso} value={iso}>{dayLabel(iso)}</option>
        ))}
      </select>
      <input type="hidden" name={`${namePrefix}_day`} value={parts.day} />
      <input type="hidden" name={`${namePrefix}_month`} value={parts.month} />
      <input type="hidden" name={`${namePrefix}_year`} value={parts.year} />

      {value && (
        <p style={READOUT_STYLE}>
          {formatIsoFullDE(value)}
          {withinTrip ? ` · Reisetag ${selectedDayNumber}` : ""}
        </p>
      )}

      {outOfRange && (
        <p style={WARNING_STYLE}>
          Dieses Datum liegt außerhalb des gültigen Zeitraums ({formatIsoWithWeekday(effectiveMin)} – {formatIsoWithWeekday(effectiveMax)}) und wurde nicht automatisch geändert. Bitte prüfen.
        </p>
      )}

      {quickActions && (
        <div className="flex flex-wrap gap-2 mt-2">
          {[{ label: "Morgen", iso: isoToday(1) }, { label: "+1 Woche", iso: isoToday(7) }]
            .filter(({ iso }) => iso >= effectiveMin && iso <= effectiveMax)
            .map(({ label: actionLabel, iso }) => (
              <button key={actionLabel} type="button" onClick={() => applyQuickIso(iso)} style={QUICK_ACTION_STYLE}>{actionLabel}</button>
            ))}
        </div>
      )}
    </div>
  );
}
