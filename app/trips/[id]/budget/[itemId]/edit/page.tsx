import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateBudgetItem, deleteBudgetItem } from "@/lib/actions/budget-items";
import { BUDGET_CATEGORY_ORDER, BUDGET_CATEGORY_LABELS } from "@/lib/budget";

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
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: item } = await supabase
    .from("budget_items")
    .select("id, trip_id, stage_id, category, label, amount_actual, currency")
    .eq("id", itemId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!item) notFound();

  const { data: stages } = await supabase
    .from("stages")
    .select("id, title")
    .eq("trip_id", trip.id)
    .order("sort_order");

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
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="bi-amount" style={LABEL_STYLE}>Betrag</label>
                <input id="bi-amount" name="amount" type="text" inputMode="decimal" defaultValue={item.amount_actual ?? ""} style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="bi-currency" style={LABEL_STYLE}>Währung</label>
                <input id="bi-currency" name="currency" type="text" defaultValue={item.currency} style={FIELD_STYLE} />
              </div>
            </div>

            {(stages ?? []).length > 0 && (
              <div className="mb-8">
                <label htmlFor="bi-stage" style={LABEL_STYLE}>Aufenthalt (optional)</label>
                <select id="bi-stage" name="stage_id" defaultValue={item.stage_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keinem Aufenthalt zugeordnet</option>
                  {(stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
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

        <div
          className="rounded-xl p-6 mt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Kostenposition entfernen (keine Buchung, keine weiteren Auswirkungen).
          </p>
          <form action={deleteBudgetItem}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="slug" value={trip.slug} />
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
