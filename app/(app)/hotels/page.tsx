import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { searchHotelsStandalone } from "@/lib/actions/hotel-search";
import { saveHotelOption, deleteSavedHotelOption } from "@/lib/actions/saved-hotels";
import { MAX_SAVED_HOTELS_PER_DESTINATION } from "@/lib/saved-hotels-shared";
import { HotelSearchForm } from "@/components/HotelSearchForm";
import { HotelResultGroups } from "@/components/HotelResultGroups";
import { HotelCard } from "@/components/HotelCard";
import { Banner } from "@/components/Banner";
import { SMALL_DESTINATION_THRESHOLD } from "@/lib/hotel-qualification";
import type { HotelShortlistItem } from "@/lib/trip-idea-hotel-types";

function formatSearchedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string; check_in?: string; nights?: string
    idea_id?: string; search_key?: string; error?: string
  }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  let hotelResult: { items: HotelShortlistItem[]; belowStandard: boolean; limitedInventory: boolean; searchedAt: string } | null = null;
  if (sp.search_key) {
    const { data: cached } = await supabase
      .from("hotel_search_cache")
      .select("results, is_below_standard, updated_at")
      .eq("family_id", familyId)
      .eq("search_key", sp.search_key)
      .maybeSingle();
    hotelResult = cached
      ? {
          items: cached.results as unknown as HotelShortlistItem[],
          belowStandard: cached.is_below_standard,
          // §"hotel_search_cache hat keine eigene Spalte dafür": Näherung aus
          // der Trefferzahl, rein informativ (siehe getOrSearchHotelOptions).
          limitedInventory: (cached.results as unknown[]).length <= SMALL_DESTINATION_THRESHOLD,
          searchedAt: cached.updated_at,
        }
      : null;
  }

  // §"Letzte 3 Suchanfragen speichern, um Vorschläge später in Ruhe
  // anzuschauen" (Nutzervorgabe): reiner Read auf den bereits vorhandenen
  // hotel_search_cache -- keine neue Tabelle/Migration nötig, jede
  // abgeschlossene Suche liegt dort schon mit destination/search_key/
  // updated_at.
  const { data: recentSearches } = await supabase
    .from("hotel_search_cache")
    .select("destination, search_key, updated_at")
    .eq("family_id", familyId)
    .order("updated_at", { ascending: false })
    .limit(3);

  // §"Echte Hotel-Merkfunktion ergänzen, immer sichtbar" (Nutzervorgabe,
  // kombinierter Fix-Sprint): alle gemerkten Hotels der Familie, unabhängig
  // vom aktuellen Suchzustand -- gruppiert nach Ziel.
  const { data: allSavedRows } = await supabase
    .from("saved_hotel_options")
    .select("id, search_key, destination, option_id, hotel_option, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  const allSavedHotels = allSavedRows ?? [];
  const savedOptionIds = sp.search_key ? allSavedHotels.filter((s) => s.search_key === sp.search_key).map((s) => s.option_id) : [];
  const currentSavedCount = savedOptionIds.length;

  const usp = new URLSearchParams();
  if (sp.destination) usp.set("destination", sp.destination);
  if (sp.check_in) usp.set("check_in", sp.check_in);
  if (sp.nights) usp.set("nights", sp.nights);
  if (sp.search_key) usp.set("search_key", sp.search_key);
  const returnTo = usp.toString() ? `/hotels?${usp.toString()}` : "/hotels";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/today"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          LUMI
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Hotelvergleich
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Beste Hotels finden
        </h1>

        {sp.error && <Banner variant="error">{sp.error}</Banner>}

        <div className="rounded-xl p-6 md:p-8 mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <HotelSearchForm
            action={searchHotelsStandalone}
            defaultDestination={sp.destination}
            defaultCheckInIso={sp.check_in}
            defaultNights={sp.nights}
            ideaId={sp.idea_id}
          />
        </div>

        {(() => {
          const otherSaved = allSavedHotels.filter((s) => s.search_key !== sp.search_key);
          if (otherSaved.length === 0) return null;
          const grouped = new Map<string, typeof otherSaved>();
          for (const s of otherSaved) grouped.set(s.search_key, [...(grouped.get(s.search_key) ?? []), s]);
          return (
            <section className="mb-8">
              <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
                Gemerkte Hotels
              </div>
              <div className="space-y-6">
                {[...grouped.entries()].map(([searchKey, items]) => (
                  <div key={searchKey}>
                    <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>
                      {items[0].destination} <span style={{ color: "var(--muted)" }}>({items.length}/{MAX_SAVED_HOTELS_PER_DESTINATION})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                      {items.map((s) => (
                        <div key={s.id}>
                          <HotelCard hotel={s.hotel_option as unknown as HotelShortlistItem} destination={items[0].destination} />
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <Link
                              href={`/hotels?destination=${encodeURIComponent(items[0].destination)}&search_key=${encodeURIComponent(searchKey)}`}
                              style={{ color: "var(--accent)", fontSize: "0.68rem", textDecoration: "none" }}
                            >
                              Treffer öffnen →
                            </Link>
                            <form action={deleteSavedHotelOption}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <button
                                type="submit"
                                className="flex items-center gap-1.5"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#B5624A", fontSize: "0.68rem", padding: 0 }}
                              >
                                <Trash2 size={12} strokeWidth={1.8} />
                                Nicht mehr merken
                              </button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {!hotelResult && recentSearches && recentSearches.length > 0 && (
          <section className="mb-8">
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
              Zuletzt gesucht
            </div>
            <div className="flex flex-col gap-2">
              {recentSearches.map((s) => (
                <Link
                  key={s.search_key}
                  href={`/hotels?destination=${encodeURIComponent(s.destination)}&search_key=${encodeURIComponent(s.search_key)}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 transition-opacity hover:opacity-80"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>{s.destination}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>{formatSearchedAt(s.updated_at)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {hotelResult && (
          <>
            {hotelResult.belowStandard && (
              <Banner variant="error">
                Kein Hotel in dieser Region erfüllt den gewünschten gehobenen 5-Sterne-Mindeststandard (Westin/Le Méridien oder besser) — hier die besten real verfügbaren Optionen, deutlich unterhalb des gewünschten Niveaus.
              </Banner>
            )}
            {!hotelResult.belowStandard && hotelResult.limitedInventory && (
              <Banner variant="success">
                An diesem Ziel gibt es insgesamt nur wenige Hotels — hier werden alle real gefundenen Optionen gezeigt, nicht nur die üblichen Top-Kategorien.
              </Banner>
            )}
            <HotelResultGroups
              items={hotelResult.items} destination={sp.destination ?? ""}
              searchKey={sp.search_key} saveAction={saveHotelOption} returnTo={returnTo}
              savedOptionIds={savedOptionIds} saveLimitReached={currentSavedCount >= MAX_SAVED_HOTELS_PER_DESTINATION}
            />
          </>
        )}
      </div>
    </div>
  );
}
