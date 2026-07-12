import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateBudgetItem, deleteBudgetItem, removeBudgetItemReceipt } from "@/lib/actions/budget-items";
import { BUDGET_CATEGORY_ORDER, BUDGET_CATEGORY_LABELS } from "@/lib/budget";
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

export default async function EditBudgetItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  const { id, itemId } = await params;
  const { error, return_to } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, subtitle, budget_currency")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: item } = await supabase
    .from("budget_items")
    .select("id, trip_id, stage_id, booking_id, category, label, amount_actual, currency, storage_bucket, storage_path, details")
    .eq("id", itemId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!item) notFound();

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
    item.currency,
  ]));

  let receiptUrl: string | null = null;
  if (item.storage_path) {
    const { data: signed } = await supabase.storage
      .from(item.storage_bucket ?? "documents")
      .createSignedUrl(item.storage_path, 3600);
    receiptUrl = signed?.signedUrl ?? null;
  }
  const isImageReceipt = item.storage_path ? /\.(jpe?g|png|webp)$/i.test(item.storage_path) : false;

  const cancelHref = return_to || `/trips/${trip.slug}/budget`;

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
          Kostenposition bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {item.label}
        </h1>

        <form action={updateBudgetItem}>
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="slug" value={trip.slug} />
          {return_to && <input type="hidden" name="return_to" value={return_to} />}

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label htmlFor="bi-label" style={LABEL_STYLE}>Bezeichnung *</label>
              <input id="bi-label" name="label" type="text" required defaultValue={item.label} style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="bi-category" style={LABEL_STYLE}>Kategorie</label>
              <select id="bi-category" name="category" defaultValue={item.category} style={FIELD_STYLE}>
                {BUDGET_CATEGORY_ORDER.map((key) => (
                  <option key={key} value={key}>{BUDGET_CATEGORY_LABELS[key]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-5">
                <label htmlFor="bi-amount" style={LABEL_STYLE}>Betrag</label>
                <input id="bi-amount" name="amount" type="text" inputMode="decimal" defaultValue={item.amount_actual ?? ""} style={FIELD_STYLE} />
              </div>
              <CurrencyQuickSelect
                name="currency"
                label="Währung"
                suggestions={currencySuggestions}
                defaultValue={item.currency}
              />
            </div>

            {(stages ?? []).length > 0 && (
              <div className="mb-5">
                <label htmlFor="bi-stage" style={LABEL_STYLE}>Aufenthalt (optional)</label>
                <select id="bi-stage" name="stage_id" defaultValue={item.stage_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keinem Aufenthalt zugeordnet</option>
                  {(stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}

            {(bookings ?? []).length > 0 && (
              <div className="mb-8">
                <label htmlFor="bi-booking" style={LABEL_STYLE}>Zu bestehender Buchung (optional)</label>
                <select id="bi-booking" name="booking_id" defaultValue={item.booking_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keiner Buchung zugeordnet</option>
                  {(bookings ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.provider ? `${b.provider} · ${b.title}` : b.title}</option>
                  ))}
                </select>
              </div>
            )}

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
                Änderungen speichern
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-xl p-6 mt-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Beleg
          </div>
          {receiptUrl ? (
            <>
              {isImageReceipt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receiptUrl} alt="Beleg" className="rounded-lg w-full mb-4" style={{ maxHeight: 360, objectFit: "contain", background: "var(--background)" }} />
              ) : (
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block mb-4" style={{ color: "var(--accent)", fontSize: "0.8rem", textDecoration: "none" }}>
                  PDF-Beleg öffnen →
                </a>
              )}
              <form action={removeBudgetItemReceipt}>
                <input type="hidden" name="item_id" value={item.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="storage_path" value={item.storage_path ?? ""} />
                {return_to && <input type="hidden" name="return_to" value={return_to} />}
                <button
                  type="submit"
                  style={{
                    background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
                    borderRadius: "6px", padding: "8px 14px", fontSize: "0.6rem", letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                    WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Beleg entfernen
                </button>
              </form>
            </>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Kein Beleg hinterlegt.
            </p>
          )}
        </div>

        <div
          className="rounded-xl p-6 mt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Kostenposition entfernen (keine Buchung, keine weiteren Auswirkungen{item.storage_path ? " — Beleg wird mitgelöscht" : ""}).
          </p>
          <form action={deleteBudgetItem}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            <input type="hidden" name="storage_path" value={item.storage_path ?? ""} />
            {return_to && <input type="hidden" name="return_to" value={return_to} />}
            <button
              type="submit"
              style={{
                background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em",
                textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer",
                WebkitAppearance: "none", appearance: "none",
              }}
            >
              Kostenposition löschen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
