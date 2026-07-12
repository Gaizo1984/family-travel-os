import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plane, BedDouble, Car, Compass, UtensilsCrossed, FileText, Shield, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeTripBudget, BUDGET_CATEGORY_ORDER, BUDGET_CATEGORY_LABELS } from "@/lib/budget";
import { formatDateDE, formatCurrencyDE } from "@/lib/demo-data";
import type { BudgetCategory } from "@/lib/budget";
import { setTripBudget } from "@/lib/actions/budget-items";
import { refreshExchangeRate, setManualExchangeRate } from "@/lib/actions/exchange-rates";
import { suggestTripCurrencies } from "@/lib/currency-suggestions";
import { Banner } from "@/components/Banner";
import { CurrencyQuickSelect } from "@/components/CurrencyQuickSelect";

const CATEGORY_ICONS: Record<BudgetCategory, typeof Plane> = {
  flights: Plane,
  accommodation: BedDouble,
  transport: Car,
  activities: Compass,
  restaurants: UtensilsCrossed,
  documents: FileText,
  insurance: Shield,
  other: Receipt,
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.85rem", fontWeight: 300, outline: "none",
};

const money = formatCurrencyDE;

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, subtitle, budget_amount, budget_currency")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const budget = await computeTripBudget(trip.id);
  const returnTo = `/trips/${trip.slug}/budget`;

  const { data: rateRows } = await supabase
    .from("trip_exchange_rates")
    .select("currency, rate, source, updated_at")
    .eq("trip_id", trip.id)
    .order("currency");

  const { data: stagesForCurrency } = await supabase
    .from("stages")
    .select("title, location")
    .eq("trip_id", trip.id);

  const tripCurrencyOptions = Array.from(new Set([
    trip.budget_currency, "EUR", "USD", "CHF", "GBP",
    ...suggestTripCurrencies(trip, stagesForCurrency ?? []),
  ]));
  const foreignCurrencySuggestions = Array.from(new Set([
    ...suggestTripCurrencies(trip, stagesForCurrency ?? [], trip.budget_currency),
    "USD", "CHF", "GBP",
  ])).filter((c) => c !== trip.budget_currency);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Budget
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Kosten &amp; Budget
        </h1>

        {error && (
          <Banner variant="error">
            {error}
          </Banner>
        )}

        {/* ── Summary ── */}
        <div className="rounded-xl p-6 mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                Bisher erfasst
              </div>
              <div className="text-2xl font-light" style={{ color: "var(--foreground)" }}>
                {money(budget.totalConverted, budget.tripCurrency)}
              </div>
            </div>
            {budget.budgetAmount !== null && (
              <div className="text-right">
                <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Restbudget
                </div>
                <div
                  className="text-lg font-light"
                  style={{ color: (budget.remaining ?? 0) < 0 ? "#B5624A" : "var(--foreground)" }}
                >
                  {money(budget.remaining ?? 0, budget.tripCurrency)}
                </div>
              </div>
            )}
          </div>

          {budget.budgetAmount !== null && budget.percentUsed !== null && (
            <div className="mb-4">
              <div style={{ height: "6px", borderRadius: "3px", background: "var(--background)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%", borderRadius: "3px", width: `${Math.min(100, budget.percentUsed)}%`,
                    background: budget.percentUsed > 100 ? "#B5624A" : budget.percentUsed > 85 ? "#B89A5E" : "#4C7A5D",
                  }}
                />
              </div>
              <div className="mt-1.5" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                {budget.percentUsed.toFixed(0)}% von {money(budget.budgetAmount, budget.tripCurrency)}
              </div>
            </div>
          )}

          {budget.missingRateCurrencies.length > 0 && (
            <p className="mb-4" style={{ color: "#B89A5E", fontSize: "0.72rem" }}>
              Kurs fehlt für: {budget.missingRateCurrencies.join(", ")} — Beträge in dieser Währung sind oben nicht mitgerechnet.
            </p>
          )}

          <details>
            <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em" }}>
              {budget.budgetAmount !== null ? "Budget ändern" : "Gesamtbudget festlegen"}
            </summary>
            <form action={setTripBudget} className="mt-4 flex items-end gap-3 flex-wrap">
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="slug" value={trip.slug} />
              <div>
                <label htmlFor="budget-amount" style={LABEL_STYLE}>Budget</label>
                <input
                  id="budget-amount" name="budget_amount" type="text" inputMode="decimal"
                  defaultValue={trip.budget_amount ?? ""} placeholder="z. B. 5000"
                  style={{ ...FIELD_STYLE, width: "140px" }}
                />
              </div>
              <div style={{ minWidth: "140px" }}>
                <CurrencyQuickSelect
                  name="budget_currency"
                  label="Reisewährung"
                  suggestions={tripCurrencyOptions}
                  defaultValue={trip.budget_currency}
                />
              </div>
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none",
                  borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem",
                  letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                Speichern
              </button>
            </form>
          </details>
        </div>

        {/* ── Wechselkurse ── */}
        <div className="rounded-xl p-6 mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Wechselkurse → {trip.budget_currency}
          </div>
          {(rateRows ?? []).length > 0 && (
            <div className="space-y-1.5 mb-4">
              {(rateRows ?? []).map((r) => (
                <div key={r.currency} className="flex items-center justify-between" style={{ fontSize: "0.78rem" }}>
                  <span style={{ color: "var(--foreground)" }}>1 {r.currency} = {r.rate} {trip.budget_currency}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                    {r.source === "eodhd" ? "automatisch" : "manuell"} · {formatDateDE(r.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <form action={refreshExchangeRate} className="flex items-end gap-3 flex-wrap mb-4">
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            <input type="hidden" name="return_to" value={returnTo} />
            <div style={{ minWidth: "140px" }}>
              <CurrencyQuickSelect
                name="currency"
                label="Fremdwährung"
                suggestions={foreignCurrencySuggestions.length > 0 ? foreignCurrencySuggestions : ["USD", "CHF", "GBP"]}
              />
            </div>
            <button
              type="submit"
              style={{
                background: "var(--accent)", color: "var(--surface)", border: "none",
                borderRadius: "6px", padding: "11px 16px", fontSize: "0.62rem", letterSpacing: "0.1em",
                textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Kurs abrufen (EODHD)
            </button>
          </form>

          <details>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.08em" }}>
              Kurs manuell eintragen (Fallback)
            </summary>
            <div className="mt-4">
              <form action={setManualExchangeRate} className="flex items-end gap-3 flex-wrap">
                <input type="hidden" name="trip_id" value={trip.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="return_to" value={returnTo} />
                <div style={{ minWidth: "140px" }}>
                  <CurrencyQuickSelect
                    name="currency"
                    label="Fremdwährung"
                    suggestions={foreignCurrencySuggestions.length > 0 ? foreignCurrencySuggestions : ["USD", "CHF", "GBP"]}
                  />
                </div>
                <div>
                  <label htmlFor="manual-rate" style={LABEL_STYLE}>Kurs (1 Fremdwährung = ? {trip.budget_currency})</label>
                  <input id="manual-rate" name="rate" type="text" inputMode="decimal" placeholder="z. B. 0.92" style={{ ...FIELD_STYLE, width: "140px" }} />
                </div>
                <button
                  type="submit"
                  style={{
                    background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
                    borderRadius: "6px", padding: "10px 16px", fontSize: "0.62rem", letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Manuell speichern
                </button>
              </form>
            </div>
          </details>
        </div>

        {/* ── Kategorien ── */}
        <div className="flex items-center justify-between mb-5">
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Kostenpositionen
          </div>
          <Link
            href={`/trips/${trip.slug}/budget/new`}
            style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
          >
            + Kostenposition hinzufügen
          </Link>
        </div>

        <div className="space-y-6">
          {BUDGET_CATEGORY_ORDER.map((cat) => {
            const group = budget.byCategory[cat];
            if (group.items.length === 0) return null;
            const Icon = CATEGORY_ICONS[cat];
            return (
              <section key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                    <span style={{ color: "var(--foreground)", fontSize: "0.75rem", fontWeight: 500 }}>
                      {BUDGET_CATEGORY_LABELS[cat]}
                    </span>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                    {money(group.total, budget.tripCurrency)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          style={{
                            fontSize: "0.55rem", letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
                            color: item.source === "booking" ? "var(--accent)" : "var(--muted)",
                            border: `1px solid ${item.source === "booking" ? "rgba(184,154,94,0.4)" : "var(--border)"}`,
                            padding: "2px 7px", borderRadius: "10px",
                          }}
                        >
                          {item.source === "booking" ? "Buchung" : "Manuell"}
                        </span>
                        <span className="truncate" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
                          {item.label}
                        </span>
                      </div>
                      <span className="shrink-0" style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
                        {item.convertedAmount !== null
                          ? money(item.convertedAmount, budget.tripCurrency)
                          : `${money(item.amount, item.currency)} · Kurs fehlt`}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {budget.items.length === 0 && (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Kosten erfasst. Buchungen mit Betrag erscheinen hier automatisch.
            </p>
            <Link
              href={`/trips/${trip.slug}/budget/new`}
              style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
            >
              Erste Kostenposition hinzufügen →
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
