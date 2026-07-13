import Link from "next/link";
import { DOCUMENT_TYPE_ORDER, DOCUMENT_TYPE_CONFIG, getDateFieldRange } from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { DateSelectFields } from "@/components/DateSelectFields";
import { Banner } from "@/components/Banner";
import { ExtractSubmitButton } from "@/components/ExtractSubmitButton";

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
  extractAction,
  hiddenFields,
  defaultType,
  values,
  fileRequired,
  existingStoragePath,
  infoMessage,
  detectedName,
  submitLabel,
  cancelHref,
  errorMessage,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Optionaler zweiter Submit-Button, der dieselben Formularfelder zur KI-Auslesung schickt. */
  extractAction?: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  defaultType: DocumentType;
  values?: DocumentValues;
  fileRequired: boolean;
  /** Bereits hochgeladene Datei (z. B. aus einer vorangegangenen KI-Auslesung) — Datei-Feld wird optional. */
  existingStoragePath?: string;
  /** Neutraler Hinweis-Banner, z. B. "Automatisch ausgelesen — bitte prüfen". */
  infoMessage?: string;
  /** Nur zum Abgleich angezeigter, im Dokument erkannter Name (nicht gespeichert). */
  detectedName?: string;
  submitLabel: string;
  cancelHref: string;
  errorMessage?: string;
}) {
  const type = values?.doc_type ?? defaultType;
  const config = DOCUMENT_TYPE_CONFIG[type];
  const details = values?.details ?? {};
  const canExtract = Boolean(extractAction) && (config.isIdentityType || config.isEntryDocumentType);

  return (
    <form action={action} encType="multipart/form-data">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {existingStoragePath && <input type="hidden" name="existing_storage_path" value={existingStoragePath} />}

      <div
        className="rounded-xl p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="doc-gender" style={LABEL_STYLE}>Geschlecht</label>
                <select id="doc-gender" name="gender" defaultValue={details.gender ?? ""} style={FIELD_STYLE}>
                  <option value="">—</option>
                  <option value="male">Männlich</option>
                  <option value="female">Weiblich</option>
                  <option value="other">Divers</option>
                </select>
              </div>
              <div>
                <label htmlFor="doc-nationality" style={LABEL_STYLE}>Nationalität</label>
                <input id="doc-nationality" name="nationality" type="text" defaultValue={details.nationality ?? ""} placeholder="z. B. Deutsch" style={FIELD_STYLE} />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="doc-birth-place" style={LABEL_STYLE}>Geburtsort</label>
              <input id="doc-birth-place" name="birth_place" type="text" defaultValue={details.birth_place ?? ""} style={FIELD_STYLE} />
            </div>

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

        {type === "esta" && (
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
              <label htmlFor="doc-issuing-country" style={LABEL_STYLE}>Zielland</label>
              <input id="doc-issuing-country" name="issuing_country" type="text" defaultValue={details.issuing_country ?? "United States"} style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="doc-application-number" style={LABEL_STYLE}>Application Number</label>
              <input id="doc-application-number" name="passport_number" type="text" defaultValue={details.passport_number ?? ""} style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="doc-passport-number" style={LABEL_STYLE}>Passnummer</label>
              <input id="doc-passport-number" name="related_passport_number" type="text" defaultValue={details.related_passport_number ?? ""} style={FIELD_STYLE} />
            </div>
          </>
        )}

        {config.isEntryDocumentType && type !== "esta" && (
          <>
            <div className="mb-5">
              <label htmlFor="doc-issuing-country" style={LABEL_STYLE}>Land / Zielgebiet</label>
              <input id="doc-issuing-country" name="issuing_country" type="text" defaultValue={details.issuing_country ?? ""} placeholder="z. B. USA" style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="doc-number" style={LABEL_STYLE}>{config.numberLabel}</label>
              <input id="doc-number" name="passport_number" type="text" defaultValue={details.passport_number ?? ""} style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="doc-related-passport" style={LABEL_STYLE}>Referenzierte Passnummer (falls im Dokument genannt)</label>
              <input id="doc-related-passport" name="related_passport_number" type="text" defaultValue={details.related_passport_number ?? ""} style={FIELD_STYLE} />
            </div>

            <DateSelectFields
              label="Gültig ab"
              namePrefix="valid_from"
              defaultIso={details.valid_from}
              range={getDateFieldRange("issue")}
            />

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
            {existingStoragePath
              ? "Neues Foto/PDF hochladen (ersetzt die bereits hochgeladene Datei)"
              : fileRequired ? "Foto aufnehmen oder Datei/PDF auswählen *" : "Neue Datei hochladen (optional, ersetzt vorhandene Datei)"}
          </label>

          {errorMessage && (
            <Banner variant="error" className="mb-3 px-4 py-3 rounded-lg">
              {errorMessage}
            </Banner>
          )}

          {infoMessage && (
            <div
              className="mb-3 px-4 py-3 rounded-lg"
              style={{ background: "rgba(184,154,94,0.12)", border: "1px solid rgba(184,154,94,0.3)", color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.02em" }}
            >
              🤖 {infoMessage}
              {detectedName && ` — im Dokument erkannter Name: „${detectedName}“, bitte mit der ausgewählten Person abgleichen.`}
            </div>
          )}

          <input
            id="doc-file" name="file" type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            required={fileRequired && !existingStoragePath}
            style={{ ...FIELD_STYLE, padding: "10px 16px" }}
          />
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
            {existingStoragePath ? "✓ Datei bereits hochgeladen. " : ""}Erlaubt: JPEG, PNG, WebP oder PDF, maximal 10 MB.
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
          <Link href={cancelHref} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
            Abbrechen
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            {canExtract && !existingStoragePath && extractAction && (
              <ExtractSubmitButton
                formAction={extractAction}
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "6px", padding: "10px 18px", fontSize: "0.65rem",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              />
            )}
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
      </div>
    </form>
  );
}
