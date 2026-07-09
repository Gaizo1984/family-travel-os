import Link from "next/link";
import { DOCUMENT_TYPE_ORDER, DOCUMENT_TYPE_CONFIG, getDateFieldRange } from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { DateSelectFields } from "@/app/family/DateSelectFields";

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
  const config = DOCUMENT_TYPE_CONFIG[type];
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
            placeholder="z. B. ESTA Marcel USA"
            style={FIELD_STYLE}
          />
        </div>

        <div className="mb-5">
          <label htmlFor="doc-type" style={LABEL_STYLE}>Dokumenttyp</label>
          <select id="doc-type" name="doc_type" defaultValue={type} style={FIELD_STYLE}>
            {/* Falls ein bestehendes Dokument einen nicht mehr auswählbaren Typ hat
                (z. B. 'insurance', ersetzt durch den zentralen Versicherungsbereich),
                bleibt er hier als Option erhalten, statt beim Bearbeiten unbemerkt auf
                den ersten Listeneintrag zu wechseln. */}
            {!DOCUMENT_TYPE_ORDER.includes(type) && (
              <option value={type}>{config.label}</option>
            )}
            {DOCUMENT_TYPE_ORDER.map((key) => (
              <option key={key} value={key}>{DOCUMENT_TYPE_CONFIG[key].label}</option>
            ))}
          </select>
        </div>

        {config.isIdentityType && (
          <>
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

            <DateSelectFields
              label="Geburtsdatum"
              namePrefix="birth_date"
              defaultIso={details.birth_date}
              range={getDateFieldRange("birth")}
            />

            <div className="mb-5">
              <label htmlFor="doc-issuing-country" style={LABEL_STYLE}>Ausstellungsland</label>
              <input id="doc-issuing-country" name="issuing_country" type="text" defaultValue={details.issuing_country ?? ""} placeholder="z. B. Deutschland" style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="doc-number" style={LABEL_STYLE}>{config.numberLabel}</label>
              <input id="doc-number" name="passport_number" type="text" defaultValue={details.passport_number ?? ""} style={FIELD_STYLE} />
            </div>

            <DateSelectFields
              label="Ausstellungsdatum"
              namePrefix="issue_date"
              defaultIso={details.issue_date}
              range={getDateFieldRange("issue")}
            />
          </>
        )}

        {config.isEntryDocumentType && (
          <>
            <div className="mb-5">
              <label htmlFor="doc-issuing-country" style={LABEL_STYLE}>Land / Zielgebiet</label>
              <input id="doc-issuing-country" name="issuing_country" type="text" defaultValue={details.issuing_country ?? ""} placeholder="z. B. USA" style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="doc-number" style={LABEL_STYLE}>{config.numberLabel}</label>
              <input id="doc-number" name="passport_number" type="text" defaultValue={details.passport_number ?? ""} style={FIELD_STYLE} />
            </div>

            <DateSelectFields
              label="Genehmigungsdatum"
              namePrefix="issue_date"
              defaultIso={details.issue_date}
              range={getDateFieldRange("issue")}
            />

            <div className="mb-5">
              <label htmlFor="doc-approval-status" style={LABEL_STYLE}>Status</label>
              <select id="doc-approval-status" name="approval_status" defaultValue={details.approval_status ?? "approved"} style={FIELD_STYLE}>
                <option value="approved">Genehmigt</option>
                <option value="pending">Beantragt / ausstehend</option>
              </select>
            </div>
          </>
        )}

        <DateSelectFields
          label="Ablaufdatum"
          namePrefix="expires_at"
          defaultIso={values?.expires_at}
          range={getDateFieldRange("expiry")}
        />

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
