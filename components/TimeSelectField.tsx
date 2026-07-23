const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none", minHeight: "44px",
};

function buildTimeOptions(): string[] {
  const times: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    times.push(`${h}:${m}`);
  }
  return times;
}
const TIME_OPTIONS = buildTimeOptions();

/**
 * §"Uhrzeiteingabe mit dem nativen Zeit-Feld ist umständlich" (Nutzervorgabe):
 * ersetzt `<input type="time">` durch dieselbe Dropdown-Lösung, die
 * `DateSelectFields` bereits fürs Datum etabliert hat (natives
 * Mobile-Picker-UI dort wie hier eher hinderlich als hilfreich) -- 15-Minuten-
 * Raster, serverseitig unverändert als reiner "HH:MM"-String oder leer
 * (optional) übernommen, kein Format-/Validierungs-Unterschied zu vorher.
 */
export function TimeSelectField({
  id,
  label,
  name,
  defaultValue,
}: {
  id: string;
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="mb-5">
      <label htmlFor={id} style={LABEL_STYLE}>{label}</label>
      <select id={id} name={name} defaultValue={defaultValue ?? ""} style={FIELD_STYLE}>
        <option value="">Keine Uhrzeit</option>
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}
