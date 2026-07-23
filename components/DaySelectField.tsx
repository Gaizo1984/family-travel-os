'use client'

import { useState } from "react";
import { splitIsoDate } from "@/lib/documents";
import { enumerateIsoDates, formatIsoWithWeekday } from "@/lib/date-utils";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none", minHeight: "44px",
};

/**
 * §"Nur anhand des Datums verliert man schnell den Überblick, Wochentag
 * fehlt" (Nutzervorgabe, wörtlich): ersetzt die generische
 * `DateSelectFields` (Tag/Monat/Jahr-Dropdowns über beliebige Jahre) für
 * Journey-Termine durch EINE Liste der tatsächlich sinnvollen Tage
 * (`minIso`…`maxIso`, siehe `getJourneyEventDateRange`) inklusive
 * Wochentag -- bei einer kurzen Reise sind das ohnehin nur eine Handvoll
 * Optionen, eine einzelne durchsuchbare Liste ist da übersichtlicher als
 * drei gekoppelte Dropdowns. Sendet dieselben `${namePrefix}_day/_month/_year`-
 * Hidden-Felder wie `DateSelectFields`, damit die Server Actions
 * (`readDateGroupFromFormData`) unverändert bleiben.
 */
export function DaySelectField({
  label,
  namePrefix,
  defaultIso,
  minIso,
  maxIso,
}: {
  label: string;
  namePrefix: string;
  defaultIso?: string | null;
  minIso: string;
  maxIso: string;
}) {
  const [value, setValue] = useState(defaultIso && defaultIso >= minIso && defaultIso <= maxIso ? defaultIso : "");
  const options = enumerateIsoDates(minIso, maxIso);
  const parts = splitIsoDate(value || null);

  return (
    <div className="mb-5">
      <label htmlFor={`${namePrefix}-day-select`} style={LABEL_STYLE}>{label}</label>
      <select
        id={`${namePrefix}-day-select`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
        style={FIELD_STYLE}
      >
        <option value="">Tag wählen</option>
        {options.map((iso) => (
          <option key={iso} value={iso}>{formatIsoWithWeekday(iso)}</option>
        ))}
      </select>
      <input type="hidden" name={`${namePrefix}_day`} value={parts.day} />
      <input type="hidden" name={`${namePrefix}_month`} value={parts.month} />
      <input type="hidden" name={`${namePrefix}_year`} value={parts.year} />
    </div>
  );
}
