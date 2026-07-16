import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { searchHotelsStandalone } from "@/lib/actions/hotel-search";
import { HotelSearchForm } from "@/components/HotelSearchForm";
import { HotelCard } from "@/components/HotelCard";
import { Banner } from "@/components/Banner";
import type { HotelShortlistItem } from "@/lib/trip-idea-hotel-types";

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

  let hotelResult: { items: HotelShortlistItem[]; belowStandard: boolean; searchedAt: string } | null = null;
  if (sp.search_key) {
    const { data: cached } = await supabase
      .from("hotel_search_cache")
      .select("results, is_below_standard, updated_at")
      .eq("family_id", familyId)
      .eq("search_key", sp.search_key)
      .maybeSingle();
    hotelResult = cached
      ? { items: cached.results as unknown as HotelShortlistItem[], belowStandard: cached.is_below_standard, searchedAt: cached.updated_at }
      : null;
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/discover"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Entdecken
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

        {hotelResult && (
          <>
            {hotelResult.belowStandard && (
              <Banner variant="error">
                Kein Hotel in dieser Region erfüllt den gewünschten gehobenen 5-Sterne-Mindeststandard (Westin/Le Méridien oder besser) — hier die besten real verfügbaren Optionen, deutlich unterhalb des gewünschten Niveaus.
              </Banner>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hotelResult.items.map((h) => (
                <HotelCard key={h.placeId} hotel={h} destination={sp.destination ?? ""} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
