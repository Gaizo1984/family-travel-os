import Link from "next/link";
import { DOCUMENT_TYPE_ORDER, DOCUMENT_TYPE_CONFIG } from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

type DocumentValues = {
  label: string;
  doc_type: DocumentType;
  expires_at: string | null;
  notes: string | null;
  details: DocumentDetails | null;
};

export function DocumentForm({
  action,
  hiddenFields,
  defaultType,
  values,
  fileRequired,
  submitLabel,
  cancelHref,
  errorMessage,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  defaultType: DocumentType;
  values?: DocumentValues;
  fileRequired: boolean;
  submitLabel: string;
  cancelHref: string;
  errorMessage?: string;
}) {
  const type = values?.doc_type ?? defaultType;
  const numberLabel = DOCUMENT_TYPE_CONFIG[type].numberLabel;
  const details = values?.details ?? {};

  return (
    <form action={action} encType="multipart/form-data">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div
        className="rounded-xl p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {errorMessage && (
          <div
            className="mb-6 px-4 py-3 rounded-lg"
            style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
          >
            {errorMessage}
          </div>
        )}

        <div className="mb-5">
          <label htmlFor="doc-label" style={LABEL_STYLE}>Dokumentname *</label>
          <input
            id="doc-label" name="label" type="text" required
            defaultValue={values?.label}
            placeholder="z. B. Reisepass Marcel"
            style={FIELD_STYLE}
          />
        </div>

        <div className="mb-5">
          <label htmlFor="doc-type" style={LABEL_STYLE}>Dokumenttyp</label>
          <select id="doc-type" name="doc_type" defaultValue={type} style={FIELD_STYLE}>
            {DOCUMENT_TYPE_ORDER.map((key) => (
              <option key={key} value={key}>{DOCUMENT_TYPE_CONFIG[key].label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label htmlFor="doc-first-name" style={LABEL_STYLE}>Vorname</label>
            <input id="doc-first-name" name="first_name" type="text" defaultValue={details.first_name ?? ""} style={FIELD_STYLE} />
          </div>
          <div>
            <label htmlFor="doc-last-name" style={LABEL_STYLE}>Nachname</label>
            <input id="doc-last-name" name="last_name" type="text" defaultValue={details.last_name ?? ""} style={FIELD_STYLE} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label htmlFor="doc-birth-date" style={LABEL_STYLE}>Geburtsdatum</label>
            <input id="doc-birth-date" name="birth_date" type="date" defaultValue={details.birth_date ?? ""} style={FIELD_STYLE} />
          </div>
          <div>
            <label htmlFor="doc-issuing-country" style={LABEL_STYLE}>Ausstellungsland</label>
            <input id="doc-issuing-country" name="issuing_country" type="text" defaultValue={details.issuing_country ?? ""} placeholder="z. B. Deutschland" style={FIELD_STYLE} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label htmlFor="doc-number" style={LABEL_STYLE}>{numberLabel}</label>
            <input id="doc-number" name="passport_number" type="text" defaultValue={details.passport_number ?? ""} style={FIELD_STYLE} />
          </div>
          <div>
            <label htmlFor="doc-issue-date" style={LABEL_STYLE}>Ausstellungsdatum</label>
            <input id="doc-issue-date" name="issue_date" type="date" defaultValue={details.issue_date ?? ""} style={FIELD_STYLE} />
          </div>
        </div>

        <div className="mb-5">
          <label htmlFor="doc-expires" style={LABEL_STYLE}>Ablaufdatum</label>
          <input id="doc-expires" name="expires_at" type="date" defaultValue={values?.expires_at ?? ""} style={FIELD_STYLE} />
        </div>

        <div className="mb-5">
          <label htmlFor="doc-notes" style={LABEL_STYLE}>Notizen</label>
          <textarea id="doc-notes" name="notes" rows={3} defaultValue={values?.notes ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
        </div>

        <div className="mb-8">
          <label htmlFor="doc-file" style={LABEL_STYLE}>
            {fileRequired ? "Foto aufnehmen oder Datei/PDF auswählen *" : "Neue Datei hochladen (optional, ersetzt vorhandene Datei)"}
          </label>
          <input
            id="doc-file" name="file" type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            required={fileRequired}
            style={{ ...FIELD_STYLE, padding: "10px 16px" }}
          />
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
            Erlaubt: JPEG, PNG, WebP oder PDF, maximal 10 MB.
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
          <Link href={cancelHref} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
            Abbrechen
          </Link>
          <button
            type="submit"
            style={{
              background: "var(--foreground)", color: "var(--surface)", border: "none",
              borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
              letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
              whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
