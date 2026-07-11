import Link from "next/link";
import type { BookingTypeConfig } from "@/lib/bookings";
import {
  BOOKING_STATUS_ORDER, BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_ORDER, PAYMENT_STATUS_LABELS,
  splitDateTime,
} from "@/lib/bookings";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

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

export function BookingForm({
  config,
  action,
  hiddenFields,
  submitLabel,
  cancelHref,
  errorMessage,
  values,
}: {
  config: BookingTypeConfig;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  submitLabel: string;
  cancelHref: string;
  errorMessage?: string;
  values?: BookingValues;
}) {
  const start = splitDateTime(values?.start_datetime ?? null);
  const end = splitDateTime(values?.end_datetime ?? null);
  const details = values?.details ?? {};

  return (
    <form action={action}>
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

        {/* Titel */}
        <div className="mb-5">
          <label htmlFor="bk-title" style={LABEL_STYLE}>{config.titleLabel} *</label>
          <input
            id="bk-title" name="title" type="text" required
            defaultValue={values?.title}
            placeholder={config.titlePlaceholder}
            style={FIELD_STYLE}
          />
        </div>

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
        {config.detailFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {config.detailFields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`bk-${field.key}`} style={LABEL_STYLE}>{field.label}</label>
                {field.type === "select" ? (
                  <select
                    id={`bk-${field.key}`} name={field.key}
                    defaultValue={details[field.key] ?? ""}
                    style={FIELD_STYLE}
                  >
                    {(field.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`bk-${field.key}`} name={field.key} type="text"
                    defaultValue={details[field.key] ?? ""}
                    placeholder={field.placeholder}
                    style={FIELD_STYLE}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Start-/Enddatum */}
        <div className={`grid grid-cols-1 ${config.showEnd ? "sm:grid-cols-2" : "sm:grid-cols-2 sm:max-w-md"} gap-4 mb-5`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="bk-start-date" style={LABEL_STYLE}>{config.startLabel} *</label>
              <input id="bk-start-date" name="start_date" type="date" required defaultValue={start.date} style={FIELD_STYLE} />
            </div>
            <div>
              <label htmlFor="bk-start-time" style={{ ...LABEL_STYLE, opacity: 0 }}>Zeit</label>
              <input id="bk-start-time" name="start_time" type="time" defaultValue={start.time} style={FIELD_STYLE} />
            </div>
          </div>
          {config.showEnd && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="bk-end-date" style={LABEL_STYLE}>{config.endLabel}</label>
                <input id="bk-end-date" name="end_date" type="date" defaultValue={end.date} style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="bk-end-time" style={{ ...LABEL_STYLE, opacity: 0 }}>Zeit</label>
                <input id="bk-end-time" name="end_time" type="time" defaultValue={end.time} style={FIELD_STYLE} />
              </div>
            </div>
          )}
        </div>

        {/* Buchungsnummer */}
        <div className="mb-5">
          <label htmlFor="bk-ref" style={LABEL_STYLE}>Buchungs- / Reservierungsnummer</label>
          <input id="bk-ref" name="booking_reference" type="text" defaultValue={values?.booking_reference ?? ""} style={FIELD_STYLE} />
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label htmlFor="bk-status" style={LABEL_STYLE}>Buchungsstatus</label>
            <select id="bk-status" name="status" defaultValue={values?.status ?? "pending"} style={FIELD_STYLE}>
              {BOOKING_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bk-payment" style={LABEL_STYLE}>Zahlungsstatus</label>
            <select id="bk-payment" name="payment_status" defaultValue={values?.payment_status ?? "unpaid"} style={FIELD_STYLE}>
              {PAYMENT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

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
        <div className="mb-8">
          <label htmlFor="bk-notes" style={LABEL_STYLE}>Notizen</label>
          <textarea id="bk-notes" name="notes" rows={3} defaultValue={values?.notes ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
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
