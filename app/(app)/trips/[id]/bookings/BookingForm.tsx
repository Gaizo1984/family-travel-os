import Link from "next/link";
import type { BookingTypeConfig, DetailField } from "@/lib/bookings";
import {
  BOOKING_STATUS_ORDER, BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_ORDER, PAYMENT_STATUS_LABELS,
  splitDateTime,
} from "@/lib/bookings";
import { getDateFieldRange } from "@/lib/documents";
import { DateSelectFields } from "@/components/DateSelectFields";
import { Banner } from "@/components/Banner";
import { BookingDateFields } from "./BookingDateFields";
import { CollapsibleDetailGroup } from "./CollapsibleDetailGroup";
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

const DETAIL_DATE_RANGE = getDateFieldRange("travel");

type BookingValues = {
  stage_id: string | null;
  title: string;
  provider: string | null;
  booking_reference: string | null;
  status: string;
  payment_status: string;
  amount: number | null;
  currency: string;
  start_datetime: string | null;
  end_datetime: string | null;
  notes: string | null;
  details: Record<string, string> | null;
};

function DetailFieldControl({ field, value }: { field: DetailField; value: string }) {
  if (field.type === "date") {
    return (
      <DateSelectFields
        label={field.label}
        namePrefix={field.key}
        defaultIso={value || null}
        range={DETAIL_DATE_RANGE}
      />
    );
  }
  return (
    <div>
      <label htmlFor={`bk-${field.key}`} style={LABEL_STYLE}>{field.label}</label>
      {field.type === "select" ? (
        <select id={`bk-${field.key}`} name={field.key} defaultValue={value} style={FIELD_STYLE}>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          id={`bk-${field.key}`} name={field.key} type="text"
          defaultValue={value}
          placeholder={field.placeholder}
          style={FIELD_STYLE}
        />
      )}
    </div>
  );
}

export function BookingForm({
  config,
  action,
  extractAction,
  hiddenFields,
  submitLabel,
  cancelHref,
  errorMessage,
  infoMessage,
  values,
  existingStoragePath,
}: {
  config: BookingTypeConfig;
  action: (formData: FormData) => void | Promise<void>;
  /** Optionaler zweiter Submit-Button, der dieselben Formularfelder zur KI-Auslesung schickt (nur bei config.supportsExtraction). */
  extractAction?: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  cancelHref: string;
  errorMessage?: string;
  /** Neutraler Hinweis-Banner, z. B. "Automatisch ausgelesen — bitte prüfen". */
  infoMessage?: string;
  values?: BookingValues;
  /** Bereits hochgeladene Datei (aus einer vorangegangenen KI-Auslesung) — Datei-Feld wird optional. */
  existingStoragePath?: string;
}) {
  const start = splitDateTime(values?.start_datetime ?? null);
  const end = splitDateTime(values?.end_datetime ?? null);
  const details = values?.details ?? {};
  const canExtract = Boolean(extractAction) && config.supportsExtraction;

  const mainFields = config.detailFields.filter((f) => f.visible !== false && !f.group);
  const hiddenDetailFields = config.detailFields.filter((f) => f.visible === false);
  const groupKeys = Array.from(new Set(config.detailFields.filter((f) => f.group).map((f) => f.group!)));

  return (
    <form action={action} encType={canExtract ? "multipart/form-data" : undefined}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {existingStoragePath && <input type="hidden" name="existing_storage_path" value={existingStoragePath} />}

      <div
        className="rounded-xl p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {errorMessage && (
          <Banner variant="error">
            {errorMessage}
          </Banner>
        )}

        {infoMessage && (
          <div
            className="mb-5 px-4 py-3 rounded-lg"
            style={{ background: "rgba(184,154,94,0.12)", border: "1px solid rgba(184,154,94,0.3)", color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.02em" }}
          >
            🤖 {infoMessage}
          </div>
        )}

        {/* Titel */}
        {config.showTitleField && (
          <div className="mb-5">
            <label htmlFor="bk-title" style={LABEL_STYLE}>{config.titleLabel} *</label>
            <input
              id="bk-title" name="title" type="text" required
              defaultValue={values?.title}
              placeholder={config.titlePlaceholder}
              style={FIELD_STYLE}
            />
          </div>
        )}

        {/* Anbieter */}
        {config.providerLabel && (
          <div className="mb-5">
            <label htmlFor="bk-provider" style={LABEL_STYLE}>{config.providerLabel}</label>
            <input
              id="bk-provider" name="provider" type="text"
              defaultValue={values?.provider ?? ""}
              style={FIELD_STYLE}
            />
          </div>
        )}

        {/* Typabhängige Felder */}
        {mainFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {mainFields.map((field) => (
              <DetailFieldControl key={field.key} field={field} value={details[field.key] ?? ""} />
            ))}
          </div>
        )}

        {/* Einklappbare Feldgruppen (z. B. Zwischenstopp) */}
        {groupKeys.map((group) => {
          const groupFields = config.detailFields.filter((f) => f.group === group && f.visible !== false);
          const hasExistingValue = groupFields.some((f) => Boolean(details[f.key]));
          return (
            <CollapsibleDetailGroup
              key={group}
              label={config.collapsibleGroups?.[group] ?? "+ Weitere Angaben"}
              defaultOpen={hasExistingValue}
            >
              {groupFields.map((field) => (
                <DetailFieldControl key={field.key} field={field} value={details[field.key] ?? ""} />
              ))}
            </CollapsibleDetailGroup>
          );
        })}

        {/* Aus der Maske entfernte, aber nicht verworfene Detailfelder (z. B. Mietwagen Abhol-/Rückgabeort) */}
        {hiddenDetailFields.map((field) => (
          <input key={field.key} type="hidden" name={field.key} value={details[field.key] ?? ""} />
        ))}

        {/* Start-/Enddatum */}
        <BookingDateFields
          showEnd={config.showEnd}
          startLabel={config.startLabel}
          endLabel={config.endLabel}
          defaultStartDate={start.date}
          defaultStartTime={start.time}
          defaultEndDate={end.date}
          defaultEndTime={end.time}
          showNightsHelper={config.value === "accommodation"}
        />

        {/* Buchungsnummer */}
        {config.visibleFields.bookingReference ? (
          <div className="mb-5">
            <label htmlFor="bk-ref" style={LABEL_STYLE}>Buchungs- / Reservierungsnummer</label>
            <input id="bk-ref" name="booking_reference" type="text" defaultValue={values?.booking_reference ?? ""} style={FIELD_STYLE} />
          </div>
        ) : (
          <input type="hidden" name="booking_reference" value={values?.booking_reference ?? ""} />
        )}

        {/* Status */}
        {(config.visibleFields.status || config.visibleFields.paymentStatus) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {config.visibleFields.status ? (
              <div>
                <label htmlFor="bk-status" style={LABEL_STYLE}>Buchungsstatus</label>
                <select id="bk-status" name="status" defaultValue={values?.status ?? "pending"} style={FIELD_STYLE}>
                  {BOOKING_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            ) : (
              // §Punkt 8 "Automatisch status='booked' bei vollständiger Buchung":
              // "booked" wird semantisch auf den vorhandenen Status 'confirmed'
              // gemappt, kein neuer DB-Wert nötig.
              <input type="hidden" name="status" value={values?.status ?? "confirmed"} />
            )}
            {config.visibleFields.paymentStatus ? (
              <div>
                <label htmlFor="bk-payment" style={LABEL_STYLE}>Zahlungsstatus</label>
                <select id="bk-payment" name="payment_status" defaultValue={values?.payment_status ?? "unpaid"} style={FIELD_STYLE}>
                  {PAYMENT_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="payment_status" value={values?.payment_status ?? "unpaid"} />
            )}
          </div>
        )}
        {!config.visibleFields.status && !config.visibleFields.paymentStatus && (
          <>
            <input type="hidden" name="status" value={values?.status ?? "confirmed"} />
            <input type="hidden" name="payment_status" value={values?.payment_status ?? "unpaid"} />
          </>
        )}

        {/* Preis */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          <div className="col-span-1 sm:col-span-2">
            <label htmlFor="bk-amount" style={LABEL_STYLE}>Preis</label>
            <input id="bk-amount" name="amount" type="number" step="0.01" min={0} defaultValue={values?.amount ?? ""} style={FIELD_STYLE} />
          </div>
          <div>
            <label htmlFor="bk-currency" style={LABEL_STYLE}>Währung</label>
            <input id="bk-currency" name="currency" type="text" defaultValue={values?.currency ?? "EUR"} style={FIELD_STYLE} />
          </div>
        </div>

        {/* Notizen */}
        {config.visibleFields.notes ? (
          <div className="mb-8">
            <label htmlFor="bk-notes" style={LABEL_STYLE}>Notizen</label>
            <textarea id="bk-notes" name="notes" rows={3} defaultValue={values?.notes ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
          </div>
        ) : (
          <input type="hidden" name="notes" value={values?.notes ?? ""} />
        )}

        {/* KI-Auslesung */}
        {canExtract && !existingStoragePath && (
          <div className="mb-8">
            <label htmlFor="bk-file" style={LABEL_STYLE}>
              Boardingpass, Buchungsbestätigung oder Foto (optional, zur automatischen Auslesung)
            </label>
            <input
              id="bk-file" name="file" type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              style={{ ...FIELD_STYLE, padding: "10px 16px" }}
            />
            <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
              Erlaubt: JPEG, PNG, WebP oder PDF, maximal 10 MB.
            </p>
          </div>
        )}

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
