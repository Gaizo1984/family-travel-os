import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { loadTripParticipantOptions } from "@/lib/trip-participants";
import {
  loadPackingItems, computePackingProgress, isPreDepartureItem, PRE_DEPARTURE_WINDOW_DAYS,
  PACKING_STATUS_ORDER, PACKING_STATUS_LABELS, PACKING_CATEGORY_ORDER, packingCategoryLabel,
  LUGGAGE_ASSIGNMENT_ORDER, LUGGAGE_ASSIGNMENT_LABELS, PACKING_SOURCE_LABELS,
} from "@/lib/packing-list";
import type { PackingItem } from "@/lib/packing-list";
import { addPackingItem, updatePackingItemStatus, updatePackingItemDetails, deletePackingItem } from "@/lib/actions/packing-items";
import { todayIsoInFamilyTimezone } from "@/lib/time";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "6px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.85rem", fontWeight: 300, outline: "none",
};

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + "T00:00:00Z").getTime() - new Date(fromIso + "T00:00:00Z").getTime()) / 86400000);
}

function ProgressBar({ packed, total }: { packed: number; total: number }) {
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
  return (
    <div className="rounded-full overflow-hidden" style={{ height: "6px", background: "var(--border)" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
    </div>
  );
}

function ItemRow({ item, slug, participants }: { item: PackingItem; slug: string; participants: Array<{ id: string; name: string }> }) {
  const packed = item.status === "eingepackt";
  const nextToggleStatus = packed ? "offen" : "eingepackt";
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start gap-3">
        <form action={updatePackingItemStatus}>
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="status" value={nextToggleStatus} />
          <button
            type="submit"
            aria-label={packed ? "Als offen markieren" : "Als eingepackt markieren"}
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{
              width: "30px", height: "30px", cursor: "pointer",
              background: packed ? "var(--accent)" : "var(--background)",
              border: `1px solid ${packed ? "var(--accent)" : "var(--border)"}`,
              color: packed ? "var(--surface)" : "transparent", fontSize: "0.9rem",
            }}
          >
            ✓
          </button>
        </form>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: "var(--foreground)", fontSize: "0.85rem", textDecoration: item.status === "nicht_benoetigt" ? "line-through" : "none" }}>
              {item.label}{item.quantity > 1 ? ` × ${item.quantity}` : ""}
            </span>
            {item.isEssential && (
              <span style={{ color: "#B5624A", fontSize: "0.58rem", letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid rgba(181,98,74,0.35)", borderRadius: "10px", padding: "1px 7px" }}>
                Essentiell
              </span>
            )}
          </div>
          <div className="mt-1" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
            {packingCategoryLabel(item.category)}
            {item.status !== "offen" && item.status !== "eingepackt" && ` · ${PACKING_STATUS_LABELS[item.status]}`}
            {item.luggageAssignment !== "unassigned" && ` · ${LUGGAGE_ASSIGNMENT_LABELS[item.luggageAssignment]}`}
          </div>
          {item.reasoning && (
            <p className="mt-1" style={{ color: "var(--muted)", fontSize: "0.7rem", fontStyle: "italic" }}>{item.reasoning}</p>
          )}
          {item.note && (
            <p className="mt-1" style={{ color: "var(--foreground)", fontSize: "0.72rem" }}>{item.note}</p>
          )}

          <details className="mt-2">
            <summary style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.04em", cursor: "pointer" }}>Bearbeiten</summary>
            <form action={updatePackingItemDetails} className="mt-3 grid grid-cols-2 gap-3">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="slug" value={slug} />
              <div>
                <label style={LABEL_STYLE}>Anzahl</label>
                <input name="quantity" type="number" min={1} defaultValue={item.quantity} style={FIELD_STYLE} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Status</label>
                <select name="status" defaultValue={item.status} style={FIELD_STYLE}>
                  {PACKING_STATUS_ORDER.map((s) => <option key={s} value={s}>{PACKING_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Person</label>
                <select name="person_id" defaultValue={item.personId ?? ""} style={FIELD_STYLE}>
                  <option value="">Gemeinsam</option>
                  {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Gepäckzuordnung</label>
                <select name="luggage_assignment" defaultValue={item.luggageAssignment} style={FIELD_STYLE}>
                  {LUGGAGE_ASSIGNMENT_ORDER.map((l) => <option key={l} value={l}>{LUGGAGE_ASSIGNMENT_LABELS[l]}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label style={LABEL_STYLE}>Notiz</label>
                <input name="note" type="text" defaultValue={item.note ?? ""} placeholder="optional" style={FIELD_STYLE} />
              </div>
              <label className="col-span-2 flex items-center gap-2" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="is_essential" defaultChecked={item.isEssential} style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                <span style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>Essentiell</span>
              </label>
              <div className="col-span-2 flex items-center justify-between mt-1">
                <button type="submit" style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "8px 16px", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                  Speichern
                </button>
              </div>
            </form>
            <form action={deletePackingItem} className="mt-2">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="slug" value={slug} />
              <button type="submit" style={{ background: "none", border: "none", padding: 0, color: "#B5624A", fontSize: "0.65rem", letterSpacing: "0.04em", cursor: "pointer" }}>
                Gegenstand löschen
              </button>
            </form>
            {item.source !== "manuell" && (
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.62rem" }}>Herkunft: {PACKING_SOURCE_LABELS[item.source]}</p>
            )}
          </details>
        </div>
      </div>
    </div>
  );
}

export default async function PackingListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ person?: string; category?: string }>;
}) {
  const { id } = await params;
  const { person: personFilter, category: categoryFilter } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, start_date, end_date")
    .eq("slug", id)
    .maybeSingle();
  if (!trip) notFound();

  const [participants, items] = await Promise.all([
    loadTripParticipantOptions(supabase, trip.id, familyId),
    loadPackingItems(supabase, trip.id),
  ]);

  const todayIso = todayIsoInFamilyTimezone();
  const showPreDeparture = Boolean(trip.start_date) && daysBetween(todayIso, trip.start_date!) >= 0 && daysBetween(todayIso, trip.start_date!) <= PRE_DEPARTURE_WINDOW_DAYS;
  const preDepartureItems = items.filter(isPreDepartureItem);

  const overallProgress = computePackingProgress(items);

  const filteredItems = items.filter((i) => {
    if (categoryFilter && i.category !== categoryFilter) return false;
    if (personFilter === "gemeinsam" && i.personId !== null) return false;
    if (personFilter && personFilter !== "gemeinsam" && i.personId !== personFilter) return false;
    return true;
  });

  type Group = { key: string; label: string; personId: string | null; items: PackingItem[] };
  const groups: Group[] = [
    ...participants.map((p) => ({ key: p.id, label: p.name, personId: p.id, items: filteredItems.filter((i) => i.personId === p.id) })),
    { key: "gemeinsam", label: "Gemeinsam", personId: null, items: filteredItems.filter((i) => i.personId === null) },
  ].filter((g) => !personFilter || personFilter === g.key);

  const hasAnyGenerated = items.some((i) => i.sourceKey !== null);

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
          Packliste
        </div>
        <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {trip.title}
        </h1>

        {/* ── Fortschritt ── */}
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "var(--foreground)", fontSize: "0.8rem" }}>
              {overallProgress.packed} von {overallProgress.total} eingepackt
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
              {overallProgress.toBuy > 0 && `${overallProgress.toBuy} noch besorgen`}
            </span>
          </div>
          <ProgressBar packed={overallProgress.packed} total={overallProgress.total} />
          {overallProgress.unassignedLuggage > 0 && (
            <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
              {overallProgress.unassignedLuggage} Gegenstände noch ohne Gepäckzuordnung
            </p>
          )}
        </div>

        {/* ── Vor der Abfahrt prüfen ── */}
        {showPreDeparture && preDepartureItems.length > 0 && (
          <div className="rounded-xl p-5 mb-6" style={{ background: "rgba(184,154,94,0.08)", border: "1px solid rgba(184,154,94,0.3)" }}>
            <div style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>
              Vor der Abfahrt prüfen
            </div>
            <div className="space-y-1.5">
              {preDepartureItems.map((item) => (
                <div key={item.id} style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>· {item.label}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── KI-Generierung ── */}
        <div className="rounded-xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>
            {hasAnyGenerated
              ? "LUMI kann die Packliste anhand aktueller Reisedaten aktualisieren."
              : "LUMI kann eine Packliste anhand eurer Reisedaten vorschlagen."}
          </p>
          <Link
            href={`/trips/${trip.slug}/packing/generate`}
            style={{
              background: "var(--foreground)", color: "var(--surface)", textDecoration: "none",
              borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.1em",
              textTransform: "uppercase", whiteSpace: "nowrap",
            }}
          >
            {hasAnyGenerated ? "Packliste aktualisieren" : "Intelligente Packliste erstellen"}
          </Link>
        </div>

        {/* ── Filter ── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Link href={`/trips/${trip.slug}/packing`} style={{ fontSize: "0.68rem", padding: "5px 12px", borderRadius: "20px", textDecoration: "none", color: !personFilter ? "var(--surface)" : "var(--muted)", background: !personFilter ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)" }}>
            Alle
          </Link>
          {participants.map((p) => (
            <Link key={p.id} href={`/trips/${trip.slug}/packing?person=${p.id}`} style={{ fontSize: "0.68rem", padding: "5px 12px", borderRadius: "20px", textDecoration: "none", color: personFilter === p.id ? "var(--surface)" : "var(--muted)", background: personFilter === p.id ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)" }}>
              {p.name}
            </Link>
          ))}
          <Link href={`/trips/${trip.slug}/packing?person=gemeinsam`} style={{ fontSize: "0.68rem", padding: "5px 12px", borderRadius: "20px", textDecoration: "none", color: personFilter === "gemeinsam" ? "var(--surface)" : "var(--muted)", background: personFilter === "gemeinsam" ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)" }}>
            Gemeinsam
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <Link href={personFilter ? `/trips/${trip.slug}/packing?person=${personFilter}` : `/trips/${trip.slug}/packing`} style={{ fontSize: "0.64rem", padding: "4px 10px", borderRadius: "20px", textDecoration: "none", color: !categoryFilter ? "var(--foreground)" : "var(--muted)", border: "1px solid var(--border)" }}>
            Alle Kategorien
          </Link>
          {PACKING_CATEGORY_ORDER.map((c) => (
            <Link
              key={c}
              href={`/trips/${trip.slug}/packing?category=${c}${personFilter ? `&person=${personFilter}` : ""}`}
              style={{ fontSize: "0.64rem", padding: "4px 10px", borderRadius: "20px", textDecoration: "none", color: categoryFilter === c ? "var(--foreground)" : "var(--muted)", border: `1px solid ${categoryFilter === c ? "var(--accent)" : "var(--border)"}` }}
            >
              {packingCategoryLabel(c)}
            </Link>
          ))}
        </div>

        {/* ── Gruppen nach Person ── */}
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-center justify-between mb-3">
                <h2 style={{ color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 400 }}>{group.label}</h2>
                <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                  {computePackingProgress(group.items).packed}/{computePackingProgress(group.items).total}
                </span>
              </div>
              {group.items.length > 0 ? (
                <div className="space-y-2.5">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} slug={trip.slug} participants={participants} />
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontStyle: "italic" }}>Noch keine Gegenstände.</p>
              )}
            </section>
          ))}
        </div>

        {/* ── Eigenen Gegenstand hinzufügen ── */}
        <div className="rounded-xl p-5 mt-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "12px" }}>
            Eigenen Gegenstand hinzufügen
          </div>
          <form action={addPackingItem} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            <div className="col-span-2">
              <label style={LABEL_STYLE}>Bezeichnung</label>
              <input name="label" type="text" required placeholder="z. B. Sonnencreme" style={FIELD_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Kategorie</label>
              <select name="category" style={FIELD_STYLE}>
                {PACKING_CATEGORY_ORDER.map((c) => <option key={c} value={c}>{packingCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Person</label>
              <select name="person_id" style={FIELD_STYLE}>
                <option value="">Gemeinsam</option>
                {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Anzahl</label>
              <input name="quantity" type="number" min={1} defaultValue={1} style={FIELD_STYLE} />
            </div>
            <label className="flex items-center gap-2 self-end" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="is_essential" style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
              <span style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>Essentiell</span>
            </label>
            <div className="col-span-2">
              <button type="submit" style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                Hinzufügen
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
