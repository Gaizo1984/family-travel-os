import Link from "next/link";
import { Plane, Hotel, Sparkles, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildFamilyDnaSummary } from "@/lib/family-dna";
import { scoreDestinations } from "@/lib/discover-scoring";
import { searchDestinations } from "@/lib/providers/destination-provider";
import { HOTELS, sortHotelsByFamilyCriteria, type CuratedHotel } from "@/lib/data/hotel-knowledge";

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";

type TileIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

function DiscoverTile({ href, icon: Icon, title, subtitle }: { href: string; icon: TileIcon; title: string; subtitle: string }) {
  return (
    <Link href={href} className="block rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
      <Icon size={18} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "12px" }} />
      <div className="font-light mb-1" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>{title}</div>
      <p style={{ color: "var(--muted)", fontSize: "0.68rem", lineHeight: 1.4 }}>{subtitle}</p>
    </Link>
  );
}

function CuratedHotelCard({ hotel }: { hotel: CuratedHotel }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="relative" style={{ height: 200 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hotel.photo} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.9) 0%, transparent 60%)" }} />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div style={{ color: "#C9A96E", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>{hotel.destination}</div>
          <div style={{ color: "#F0EBE3", fontSize: "1rem", fontWeight: 300 }}>{hotel.name}</div>
        </div>
      </div>
      <div className="p-4">
        <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.72rem", fontStyle: "italic" }}>{hotel.mood}</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hotel.highlights.slice(0, 3).map((h) => (
            <span
              key={h}
              style={{
                fontSize: "0.58rem", padding: "3px 9px", borderRadius: "20px",
                color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)",
              }}
            >
              {h}
            </span>
          ))}
        </div>
        <Link href="/discover/hotels" style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.08em", textDecoration: "none" }}>
          Hotel entdecken →
        </Link>
      </div>
    </div>
  );
}

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const [dna, { data: pastTrips }, { data: trips }, destinationsOrNull, { data: family }] = await Promise.all([
    buildFamilyDnaSummary(familyId),
    supabase.from("past_trips").select("country_or_region").eq("family_id", familyId),
    supabase.from("trips").select("title").eq("family_id", familyId).in("status", ["completed", "active"]),
    searchDestinations(),
    supabase.from("families").select("exceptional_hotel_criteria").eq("id", familyId).maybeSingle(),
  ]);
  const avoidNames = [...(pastTrips ?? []).map((p) => p.country_or_region), ...(trips ?? []).map((t) => t.title)];
  const destinations = destinationsOrNull ?? [];

  // §"Radikal entschlackt": nur noch die eine Top-Empfehlung als Hero-Moment,
  // keine Sekundärvorschläge/Saison-/Stimmungs-Kacheln mehr auf dieser Seite.
  const [top] = scoreDestinations(destinations, dna, { avoidNames }).slice(0, 1);

  const criteria = new Set(family?.exceptional_hotel_criteria ?? []);
  const curatedHotels = sortHotelsByFamilyCriteria(HOTELS, criteria).slice(0, 3);

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto w-full px-5 md:px-8 pb-20 pt-9">

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: "14px" }}>
          Kuratiert für euch
        </div>

        {/* ── Hero: eine große Top-Empfehlung ── */}
        {top && (
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-2xl" style={{ height: "360px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={top.destination.photo} alt={top.destination.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.4) 55%, transparent 100%)" }} />
              <div className="absolute top-5 left-5" style={{ background: "var(--accent)", borderRadius: "20px", padding: "4px 13px", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#1a1714", fontWeight: 500 }}>
                Für eure Familie
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <p style={{ color: H_MUTED, fontSize: "0.68rem" }}>{top.destination.tags}</p>
                <h2 className="font-light leading-tight mb-2" style={{ color: H_FG, fontSize: "clamp(1.5rem, 4vw, 2rem)", letterSpacing: "-0.01em" }}>
                  {top.destination.name}
                </h2>
                <p className="max-w-md italic" style={{ color: H_MUTED, fontSize: "0.74rem", lineHeight: 1.6 }}>
                  {top.reasoning}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Vier Funktionskacheln ── */}
        <section className="mb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DiscoverTile href="/discover/flights" icon={Plane} title="Flugvergleich" subtitle="Beste Flüge finden." />
            <DiscoverTile href="/discover/hotels" icon={Hotel} title="Hotelvergleich" subtitle="Die besten Hotels vergleichen." />
            <DiscoverTile href="/plan" icon={Sparkles} title="Reiseidee vorschlagen" subtitle="LUMI schlägt passende Reiseideen vor." />
            <DiscoverTile href="/discover/ideas" icon={Heart} title="Gespeicherte Ideen" subtitle="Alle gemerkten Hotels und Reiseideen." />
          </div>
        </section>

        {/* ── Besondere Hotels ── */}
        <section>
          <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "14px" }}>
            Besondere Hotels
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {curatedHotels.map((h) => <CuratedHotelCard key={h.name} hotel={h} />)}
          </div>
        </section>

      </div>
    </div>
  );
}
