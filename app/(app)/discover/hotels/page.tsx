import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HOTELS, sortHotelsByFamilyCriteria } from "@/lib/data/hotel-knowledge";
import { HOTEL_CRITERIA_OPTIONS } from "@/lib/family-dna";

export default async function DiscoverHotelsPage() {
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id, exceptional_hotel_criteria").limit(1).single();
  const criteria = new Set(family?.exceptional_hotel_criteria ?? []);

  const sorted = sortHotelsByFamilyCriteria(HOTELS, criteria);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/discover"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Entdecken
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Hotels, für die man eine Reise baut
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Besondere Hotels
        </h1>

        {criteria.size === 0 && (
          <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}>
            Legt eure Kriterien für „außergewöhnliche Hotels" im{" "}
            <Link href="/family/compass/edit" style={{ color: "var(--accent)" }}>Reisekompass</Link> fest, um die Sortierung zu personalisieren.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map((h) => (
            <div key={h.name} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="relative" style={{ height: 180 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.photo} alt={h.name} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.9) 0%, transparent 60%)" }} />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div style={{ color: "#C9A96E", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>{h.destination}</div>
                  <div style={{ color: "#F0EBE3", fontSize: "1rem", fontWeight: 300 }}>{h.name}</div>
                </div>
              </div>
              <div className="p-4">
                <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}>{h.mood}</p>
                <div className="flex flex-wrap gap-1.5">
                  {h.hotelStyleTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "0.58rem", padding: "3px 9px", borderRadius: "20px",
                        color: criteria.has(tag) ? "var(--accent)" : "var(--muted)",
                        background: criteria.has(tag) ? "rgba(184,154,94,0.1)" : "var(--background)",
                        border: `1px solid ${criteria.has(tag) ? "rgba(184,154,94,0.25)" : "var(--border)"}`,
                      }}
                    >
                      {HOTEL_CRITERIA_OPTIONS.find((o) => o.key === tag)?.label ?? tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8" style={{ color: "var(--muted)", fontSize: "0.62rem", fontStyle: "italic" }}>
          Kuratierte Auswahl, keine Live-Verfügbarkeit oder Preise.
        </p>
      </div>
    </div>
  );
}
