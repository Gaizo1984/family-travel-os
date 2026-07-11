import { MapPin, Plane, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isTripPastEnd } from "@/lib/trip-status";
import { DESTINATIONS } from "@/lib/data/destination-knowledge";
import { searchHotels } from "@/lib/providers/hotel-provider";
import { searchFlights } from "@/lib/providers/flight-provider";
import { searchRestaurants } from "@/lib/providers/restaurant-provider";
import { searchExcursions } from "@/lib/providers/excursion-provider";
import { saveToWishlist } from "@/lib/actions/buchungsportal";
import { JOURNEY_EVENT_CATEGORIES, type JourneyEventCategory } from "@/lib/journey-events";
import { Banner } from "@/components/Banner";

type TripRow = {
  id: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "14px" }}>
      {children}
    </div>
  );
}

function PriceBadge({ value }: { value: string }) {
  return (
    <span style={{ color: "var(--accent)", fontSize: "0.62rem", letterSpacing: "0.04em", background: "rgba(184,154,94,0.1)", border: "1px solid rgba(184,154,94,0.25)", padding: "2px 8px", borderRadius: "20px" }}>
      {value}
    </span>
  );
}

function WishlistButton({ tripId, date, title, category, isSaved }: { tripId: string; date: string; title: string; category: string; isSaved: boolean }) {
  if (isSaved) {
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          color: "var(--muted)", border: "1px solid var(--border)",
          borderRadius: "20px", padding: "5px 14px", fontSize: "0.62rem", whiteSpace: "nowrap",
        }}
      >
        <Heart size={11} strokeWidth={1.8} fill="currentColor" />
        Gemerkt
      </span>
    );
  }
  return (
    <form action={saveToWishlist}>
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="category" value={category} />
      <button
        type="submit"
        style={{
          background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
          borderRadius: "20px", padding: "5px 14px", fontSize: "0.62rem", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        Zur Merkliste
      </button>
    </form>
  );
}

export default async function BuchungsportalPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const familyId = family?.id ?? "";

  const { data: tripsRaw } = await supabase
    .from("trips")
    .select("id, title, subtitle, status, start_date, end_date")
    .eq("family_id", familyId)
    .order("start_date", { ascending: true, nullsFirst: false });

  const trips = (tripsRaw ?? []) as TripRow[];
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeTrip = trips.find((t) => (t.status === "active" || t.status === "planned") && !isTripPastEnd(t, todayIso)) ?? null;

  const destinationMatch = activeTrip
    ? DESTINATIONS.find((d) => {
        const haystack = `${activeTrip.title} ${activeTrip.subtitle ?? ""}`.toLowerCase();
        return haystack.includes(d.name.toLowerCase());
      }) ?? null
    : null;

  const wishlistDate = activeTrip?.start_date ?? todayIso;

  const { data: wishlistRaw } = activeTrip
    ? await supabase
        .from("journey_events")
        .select("id, title, category, date")
        .eq("trip_id", activeTrip.id)
        .eq("status", "idea")
        .order("date", { ascending: true })
    : { data: null };
  const wishlist = (wishlistRaw ?? []) as { id: string; title: string; category: JourneyEventCategory; date: string }[];
  const wishlistTitles = new Set(wishlist.map((w) => w.title));

  const [hotels, flights, restaurants, excursions] = await Promise.all([
    searchHotels({ destinationName: destinationMatch?.name }),
    searchFlights({ destinationId: destinationMatch?.id }),
    searchRestaurants({ destinationName: destinationMatch?.name }),
    searchExcursions({ destinationName: destinationMatch?.name }),
  ]);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Buchungsportal
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "-0.01em" }}>
          Hotels, Flüge & Restaurants im Vergleich
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
          {destinationMatch
            ? `Kuratierte Auswahl für ${destinationMatch.name} — passend zu eurer aktuellen Reise.`
            : "Kuratierte Auswahl zur Orientierung — keine Live-Preise oder Verfügbarkeit."}
        </p>

        {saved && <Banner variant="success">&bdquo;{saved}&ldquo; auf die Merkliste eurer Reise gesetzt.</Banner>}
        {error && <Banner variant="error">{error}</Banner>}

        {/* ── Meine Merkliste ── */}
        {wishlist.length > 0 && (
          <section className="mb-12">
            <SectionLabel>Meine Merkliste</SectionLabel>
            <div className="space-y-2">
              {wishlist.map((w) => {
                const Icon = JOURNEY_EVENT_CATEGORIES[w.category]?.icon ?? Heart;
                return (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <Icon size={13} strokeWidth={1.6} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <span style={{ color: "var(--foreground)", fontSize: "0.8rem", flex: 1 }}>{w.title}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Hotels ── */}
        <section className="mb-12">
          <SectionLabel>Hotelvergleich</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(hotels ?? []).map((h) => (
              <div key={h.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="relative" style={{ height: 150 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.photo} alt={h.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.9) 0%, transparent 60%)" }} />
                  <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2">
                    <div>
                      <div style={{ color: "#C9A96E", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>{h.destination}</div>
                      <div style={{ color: "#F0EBE3", fontSize: "0.95rem", fontWeight: 300 }}>{h.name}</div>
                    </div>
                    <PriceBadge value={h.priceIndicator} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {h.highlights.map((hl) => (
                      <span key={hl} style={{ fontSize: "0.6rem", color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: "20px" }}>
                        {hl}
                      </span>
                    ))}
                  </div>
                  {activeTrip && (
                    <WishlistButton tripId={activeTrip.id} date={wishlistDate} title={`Hotel-Idee: ${h.name}`} category="note" isSaved={wishlistTitles.has(`Hotel-Idee: ${h.name}`)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Flüge ── */}
        <section className="mb-12">
          <SectionLabel>Flugvergleich</SectionLabel>
          <div className="space-y-3">
            {(flights ?? []).map((f) => (
              <div key={f.id} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Plane size={14} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
                    <span style={{ color: "var(--foreground)", fontSize: "0.88rem" }}>{f.route}</span>
                  </div>
                  <PriceBadge value={f.priceIndicator} />
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.74rem", lineHeight: 1.5 }}>
                  {f.airlines.join(', ')} · {f.flightTimeHint}
                  {f.typicalStopovers.length > 0 && ` · Umstieg meist in ${f.typicalStopovers.join(' oder ')}`}
                </p>
                {activeTrip && (
                  <div className="mt-3">
                    <WishlistButton tripId={activeTrip.id} date={wishlistDate} title={`Flugidee: ${f.route}`} category="note" isSaved={wishlistTitles.has(`Flugidee: ${f.route}`)} />
                  </div>
                )}
              </div>
            ))}
            {(flights ?? []).length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Für diese Reise liegt noch keine kuratierte Flugroute vor.
              </p>
            )}
          </div>
        </section>

        {/* ── Restaurants ── */}
        <section className="mb-8">
          <SectionLabel>Restaurantempfehlungen</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(restaurants ?? []).map((r) => (
              <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="relative" style={{ height: 120 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photo} alt={r.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.9) 0%, transparent 60%)" }} />
                  <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2">
                    <div>
                      <div style={{ color: "#C9A96E", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>{r.destination}</div>
                      <div style={{ color: "#F0EBE3", fontSize: "0.9rem", fontWeight: 300 }}>{r.name}</div>
                    </div>
                    <PriceBadge value={r.priceIndicator} />
                  </div>
                </div>
                <div className="p-4">
                  <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}>{r.cuisine} · {r.mood}</p>
                  {activeTrip && (
                    <WishlistButton tripId={activeTrip.id} date={wishlistDate} title={r.name} category="restaurant" isSaved={wishlistTitles.has(r.name)} />
                  )}
                </div>
              </div>
            ))}
            {(restaurants ?? []).length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Für diese Reise liegt noch keine kuratierte Restaurantempfehlung vor.
              </p>
            )}
          </div>
        </section>

        {/* ── Aktivitäten & Ausflüge ── */}
        <section className="mb-8">
          <SectionLabel>Aktivitäten & Ausflüge</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(excursions ?? []).map((e) => (
              <div key={e.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="relative" style={{ height: 120 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.photo} alt={e.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.9) 0%, transparent 60%)" }} />
                  <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2">
                    <div>
                      <div style={{ color: "#C9A96E", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>{e.destination}</div>
                      <div style={{ color: "#F0EBE3", fontSize: "0.9rem", fontWeight: 300 }}>{e.title}</div>
                    </div>
                    <PriceBadge value={e.priceIndicator} />
                  </div>
                </div>
                <div className="p-4">
                  <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>{e.description}</p>
                  <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}>{e.mood}</p>
                  {activeTrip && (
                    <WishlistButton tripId={activeTrip.id} date={wishlistDate} title={`Ausflug-Idee: ${e.title}`} category="activity" isSaved={wishlistTitles.has(`Ausflug-Idee: ${e.title}`)} />
                  )}
                </div>
              </div>
            ))}
            {(excursions ?? []).length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Für diese Reise liegt noch keine kuratierte Aktivität vor.
              </p>
            )}
          </div>
        </section>

        {!activeTrip && (
          <p className="flex items-center gap-2" style={{ color: "var(--muted)", fontSize: "0.7rem", fontStyle: "italic" }}>
            <MapPin size={12} strokeWidth={1.6} />
            Sobald eine Reise aktiv ist, könnt ihr Favoriten direkt auf deren Merkliste setzen.
          </p>
        )}

        <p className="mt-8" style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}>
          Kuratierte Auswahl, keine Live-Verfügbarkeit, keine Preise, keine automatische Buchung.
        </p>
      </div>
    </div>
  );
}
