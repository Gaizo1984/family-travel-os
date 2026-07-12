import { GERMAN_MONTHS, splitIsoDate } from "@/lib/documents";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export function DateSelectFields({
  label,
  namePrefix,
  defaultIso,
  range,
}: {
  label: string;
  namePrefix: string;
  defaultIso: string | null | undefined;
  range: { minYear: number; maxYear: number };
}) {
  const { day, month, year } = splitIsoDate(defaultIso);
  const years: number[] = [];
  for (let y = range.maxYear; y >= range.minYear; y--) years.push(y);

  return (
    <div className="mb-5">
      <label style={LABEL_STYLE}>{label}</label>
      <div className="grid grid-cols-3 gap-2">
        <select name={`${namePrefix}_day`} defaultValue={day} style={FIELD_STYLE} aria-label={`${label} – Tag`}>
          <option value="">Tag</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
          ))}
        </select>
        <select name={`${namePrefix}_month`} defaultValue={month} style={FIELD_STYLE} aria-label={`${label} – Monat`}>
          <option value="">Monat</option>
          {GERMAN_MONTHS.map((m, idx) => (
            <option key={m} value={String(idx + 1).padStart(2, "0")}>{m}</option>
          ))}
        </select>
        <select name={`${namePrefix}_year`} defaultValue={year} style={FIELD_STYLE} aria-label={`${label} – Jahr`}>
          <option value="">Jahr</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
