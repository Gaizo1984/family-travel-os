import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createBudgetItem } from "@/lib/actions/budget-items";
import { extractReceiptData } from "@/lib/actions/receipt-extraction";
import { BUDGET_CATEGORY_ORDER, BUDGET_CATEGORY_LABELS } from "@/lib/budget";
import type { BudgetCategory } from "@/lib/budget";
import { suggestTripCurrencies } from "@/lib/currency-suggestions";
import { CurrencyQuickSelect } from "@/components/CurrencyQuickSelect";
import { Banner } from "@/components/Banner";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

type ReceiptDraft = {
  readable?: boolean;
  merchant?: string | null;
  date?: string | null;
  amount?: number | null;
  currency?: string | null;
  receipt_number?: string | null;
  label?: string | null;
  category?: string | null;
  location?: string | null;
  suggested_stage_id?: string | null;
  suggested_booking_id?: string | null;
};

export default async function NewBudgetItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; return_to?: string; draft?: string; storage_path?: string }>;
}) {
  const { id } = await params;
  const { error, return_to, draft: draftRaw, storage_path } = await searchParams;

  let draft: ReceiptDraft | null = null;
  if (draftRaw) {
    try { draft = JSON.parse(draftRaw) as ReceiptDraft; } catch { draft = null; }
  }

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, subtitle, budget_currency")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: stages } = await supabase
    .from("stages")
    .select("id, title, location")
    .eq("trip_id", trip.id)
    .order("sort_order");

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, title, provider")
    .eq("trip_id", trip.id)
    .order("start_datetime");

  const currencySuggestions = Array.from(new Set([
    trip.budget_currency,
    ...suggestTripCurrencies(trip, stages ?? [], trip.budget_currency),
    "USD", "CHF", "GBP",
  ]));

  const cancelHref = return_to || `/trips/${trip.slug}/budget`;
  const suggestedCategory = draft?.category && (BUDGET_CATEGORY_ORDER as string[]).includes(draft.category)
    ? (draft.category as BudgetCategory)
    : BUDGET_CATEGORY_ORDER[0];

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={cancelHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Kostenposition
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Manuelle Kosten ergänzen
        </h1>

        <form action={createBudgetItem} encType="multipart/form-data">
          <input type="hidden" name="trip_id" value={trip.id} />
          <input type="hidden" name="slug" value={trip.slug} />
          {return_to && <input type="hidden" name="return_to" value={return_to} />}
          {storage_path && <input type="hidden" name="existing_storage_path" value={storage_path} />}
          {draft?.merchant && <input type="hidden" name="merchant" value={draft.merchant} />}
          {draft?.receipt_number && <input type="hidden" name="receipt_number" value={draft.receipt_number} />}

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="mb-5">
              <label htmlFor="bi-label" style={LABEL_STYLE}>Bezeichnung *</label>
              <input
                id="bi-label" name="label" type="text" required
                defaultValue={draft?.label ?? ""}
                placeholder="z. B. Visagebühren Oman"
                style={FIELD_STYLE}
              />
            </div>

            <div className="mb-5">
              <label htmlFor="bi-category" style={LABEL_STYLE}>Kategorie</label>
              <select id="bi-category" name="category" defaultValue={suggestedCategory} style={FIELD_STYLE}>
                {BUDGET_CATEGORY_ORDER.map((key) => (
                  <option key={key} value={key}>{BUDGET_CATEGORY_LABELS[key]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-5">
                <label htmlFor="bi-amount" style={LABEL_STYLE}>Betrag {draft && <span style={{ color: "var(--accent)" }}>· bitte prüfen</span>}</label>
                <input
                  id="bi-amount" name="amount" type="text" inputMode="decimal"
                  defaultValue={draft?.amount != null ? String(draft.amount) : ""}
                  placeholder="z. B. 120.00" style={FIELD_STYLE}
                />
              </div>
              <CurrencyQuickSelect
                name="currency"
                label="Währung · bitte prüfen"
                suggestions={currencySuggestions}
                defaultValue={draft?.currency ?? trip.budget_currency}
              />
            </div>

            {(stages ?? []).length > 0 && (
              <div className="mb-5">
                <label htmlFor="bi-stage" style={LABEL_STYLE}>Aufenthalt (optional)</label>
                <select id="bi-stage" name="stage_id" defaultValue={draft?.suggested_stage_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keinem Aufenthalt zugeordnet</option>
                  {(stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                {draft?.suggested_stage_id && (
                  <p className="mt-2" style={{ color: "var(--accent)", fontSize: "0.65rem" }}>
                    Anhand des Belegdatums vorgeschlagen — bitte prüfen.
                  </p>
                )}
              </div>
            )}

            {(bookings ?? []).length > 0 && (
              <div className="mb-8">
                <label htmlFor="bi-booking" style={LABEL_STYLE}>Zu bestehender Buchung (optional)</label>
                <select id="bi-booking" name="booking_id" defaultValue={draft?.suggested_booking_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keiner Buchung zugeordnet</option>
                  {(bookings ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.provider ? `${b.provider} · ${b.title}` : b.title}</option>
                  ))}
                </select>
                {draft?.suggested_booking_id && (
                  <p className="mt-2" style={{ color: "var(--accent)", fontSize: "0.65rem" }}>
                    Anhand des erkannten Händlers vorgeschlagen — bestehende Buchung wird dadurch nicht verändert.
                  </p>
                )}
              </div>
            )}

            <div className="mb-8">
              <label htmlFor="bi-file" style={LABEL_STYLE}>
                {storage_path ? "Beleg bereits hochgeladen ✓ (ersetzen optional)" : "Beleg als Foto/PDF (optional)"}
              </label>

              {error && (
                <Banner variant="error" className="mb-3 px-4 py-3 rounded-lg">
                  {error}
                </Banner>
              )}

              {draft && (
                <div
                  className="mb-3 px-4 py-3 rounded-lg"
                  style={{ background: "rgba(184,154,94,0.12)", border: "1px solid rgba(184,154,94,0.3)", color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.02em" }}
                >
                  🤖 Beleg automatisch ausgelesen — bitte Betrag, Währung und die übrigen Felder prüfen und bei Bedarf korrigieren.
                  {draft.location && ` Erkannter Ort: „${draft.location}“.`}
                </div>
              )}

              <input
                id="bi-file" name="file" type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                capture="environment"
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
              <div className="flex items-center gap-3 flex-wrap">
                {!storage_path && (
                  <button
                    type="submit"
                    formAction={extractReceiptData}
                    formNoValidate
                    style={{
                      background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                      borderRadius: "6px", padding: "10px 18px", fontSize: "0.65rem",
                      letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
                      whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                    }}
                  >
                    🤖 Mit KI auslesen
                  </button>
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
                  Kostenposition speichern
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
