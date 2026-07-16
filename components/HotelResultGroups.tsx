import { HotelCard } from "@/components/HotelCard";
import type { HotelShortlistItem } from "@/lib/trip-idea-hotel-types";
import type { LuxuryHotelTier } from "@/lib/data/luxury-hotel-brands";

type CategoryKey = "iconic" | LuxuryHotelTier;

const CATEGORY_ORDER: Array<{ key: CategoryKey; label: string }> = [
  { key: "iconic", label: "Iconic Hotels" },
  { key: "ultra_luxury", label: "Ultra Luxury" },
  { key: "premium_luxury", label: "Premium Luxury" },
  { key: "upper_upscale", label: "Gehobene 5 Sterne" },
];

function categoryOf(item: HotelShortlistItem): CategoryKey | null {
  if (item.isIconic) return "iconic";
  return item.tier;
}

/**
 * §"Aufstellung fängt mit dem höchsten Standard an, Kategorien per Dropdown
 * auf-/zuklappbar" (Nutzervorgabe): gruppiert die bereits von
 * `selectBalancedQualified` in Anzeigereihenfolge gelieferte Liste nach
 * Kategorie (Iconic → Ultra Luxury → Premium Luxury → Gehobene 5 Sterne) --
 * leere Kategorien werden nicht angezeigt (keine künstliche Auffüllung).
 * Fallback-Kandidaten unterhalb des Mindeststandards (`tier: null`, siehe
 * `belowStandard`) bleiben ungruppiert. Von der idee-gekoppelten
 * Hotel-Shortlist UND der eigenständigen Hotelsuche gemeinsam genutzt.
 */
export function HotelResultGroups({ items, destination }: { items: HotelShortlistItem[]; destination: string }) {
  const grouped = new Map<CategoryKey, HotelShortlistItem[]>();
  const belowStandardItems: HotelShortlistItem[] = [];
  for (const item of items) {
    const category = categoryOf(item);
    if (!category) {
      belowStandardItems.push(item);
      continue;
    }
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(item);
  }

  const firstNonEmptyKey = CATEGORY_ORDER.find(({ key }) => (grouped.get(key)?.length ?? 0) > 0)?.key;

  return (
    <div className="flex flex-col gap-4">
      {CATEGORY_ORDER.map(({ key, label }) => {
        const groupItems = grouped.get(key);
        if (!groupItems || groupItems.length === 0) return null;
        return (
          <details key={key} open={key === firstNonEmptyKey} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <summary
              className="cursor-pointer p-4"
              style={{ background: "var(--surface)", color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
            >
              {label} ({groupItems.length})
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
              {groupItems.map((h) => <HotelCard key={h.placeId} hotel={h} destination={destination} />)}
            </div>
          </details>
        );
      })}
      {belowStandardItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {belowStandardItems.map((h) => <HotelCard key={h.placeId} hotel={h} destination={destination} />)}
        </div>
      )}
    </div>
  );
}
