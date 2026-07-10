const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

const OTHER_VALUE = "__OTHER__";

/**
 * Zero-JS Währungsauswahl: Dropdown mit Reisewährung + automatisch aus der
 * Reise abgeleiteten Vorschlägen + gängigen Reisewährungen, plus eingeklappter
 * Freitext-Fallback ("Andere Währung …"). Der Freitext-Wert (falls ausgefüllt)
 * überschreibt serverseitig die Dropdown-Auswahl — keine Client-Interaktion nötig.
 */
export function CurrencyQuickSelect({
  name,
  label,
  suggestions,
  defaultValue,
}: {
  name: string;
  label: string;
  /** z. B. [Reisewährung, ...abgeleitete Vorschläge, USD, CHF, GBP], bereits dedupliziert. */
  suggestions: string[];
  defaultValue?: string;
}) {
  const isKnown = defaultValue ? suggestions.includes(defaultValue) : true;

  return (
    <div className="mb-5">
      <label htmlFor={`${name}-quick`} style={LABEL_STYLE}>{label}</label>
      <select
        id={`${name}-quick`}
        name={`${name}_quick`}
        defaultValue={isKnown ? (defaultValue ?? suggestions[0]) : OTHER_VALUE}
        style={FIELD_STYLE}
      >
        {suggestions.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
        <option value={OTHER_VALUE}>Andere Währung …</option>
      </select>

      <details className="mt-3" open={!isKnown}>
        <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.06em" }}>
          Andere Währung eingeben
        </summary>
        <div className="mt-2">
          <input
            id={`${name}-custom`}
            name={`${name}_custom`}
            type="text"
            placeholder="z. B. OMR"
            defaultValue={!isKnown ? (defaultValue ?? "") : ""}
            style={FIELD_STYLE}
          />
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.6rem" }}>
            Wenn hier ein Code eingetragen ist, gilt er statt der Auswahl oben.
          </p>
        </div>
      </details>
    </div>
  );
}

export function resolveQuickCurrency(formData: FormData, name: string, fallback = "EUR"): string {
  const custom = String(formData.get(`${name}_custom`) ?? "").trim().toUpperCase();
  if (custom) return custom;
  const quick = String(formData.get(`${name}_quick`) ?? "").trim().toUpperCase();
  return quick && quick !== OTHER_VALUE ? quick : fallback;
}
