import { Star, ExternalLink, Search, Sparkles, Bookmark } from "lucide-react";
import { LUXURY_TIER_LABELS, type LuxuryHotelTier } from "@/lib/data/luxury-hotel-brands";
import { buildHolidayCheckSearchUrl } from "@/lib/hotel-qualification";
import type { HotelShortlistItem } from "@/lib/trip-idea-hotel-types";

export const TIER_COLORS: Record<LuxuryHotelTier, string> = {
  upper_upscale: "var(--accent)",
  premium_luxury: "#8B6F47",
  ultra_luxury: "#B5624A",
};
export const BELOW_STANDARD_COLOR = "#8A8578";

export const PRICE_LEVEL_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: "Kostenlos",
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

/**
 * §"Keine doppelte Logik": von der idee-gekoppelten Hotel-Shortlist
 * (app/(app)/plan/ideas/[sessionId]/[ideaId]/page.tsx) UND der eigenständigen
 * Hotelsuche (/hotels) genutzt -- extrahiert aus Ersterer, keine
 * Verhaltensänderung an deren bestehender Darstellung. `destination` wird
 * für den "Bei HolidayCheck prüfen"-Link benötigt (Google-Suche mit
 * `site:holidaycheck.de`, siehe `buildHolidayCheckSearchUrl` -- KEIN
 * erfundenes HolidayCheck-Deep-Link-Format, keine vorgetäuschten Preise).
 */
/**
 * §"Echte Hotel-Merkfunktion ergänzen" (Nutzervorgabe, kombinierter Fix-
 * Sprint): optionale Merk-Props, 1:1 nach Vorbild von FlightCard -- ohne
 * `searchKey`/`saveAction` (bestehende Aufrufstellen, z. B. die ideen-
 * gekoppelte Shortlist) bleibt die Karte unverändert.
 */
export function HotelCard({
  hotel, destination, searchKey, saveAction, isSaved, saveDisabled, returnTo,
}: {
  hotel: HotelShortlistItem; destination: string
  searchKey?: string
  saveAction?: (formData: FormData) => void | Promise<void>
  isSaved?: boolean
  saveDisabled?: boolean
  returnTo?: string
}) {
  const isUnverified = (field: string) => hotel.unverifiedFields.includes(field);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {hotel.photoName && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/places-photo/${hotel.photoName}?maxWidthPx=400`}
          alt={hotel.name}
          className="w-full object-cover"
          style={{ height: "140px" }}
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-light" style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{hotel.name}</div>
          {hotel.priceLevel && !isUnverified("priceLevel") && (
            <span style={{ color: "var(--accent)", fontSize: "0.68rem", whiteSpace: "nowrap" }}>
              {PRICE_LEVEL_LABELS[hotel.priceLevel] ?? hotel.priceLevel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            style={{
              color: hotel.tier ? TIER_COLORS[hotel.tier] : BELOW_STANDARD_COLOR,
              fontSize: "0.6rem", letterSpacing: "0.06em", textTransform: "uppercase",
              border: `1px solid ${(hotel.tier ? TIER_COLORS[hotel.tier] : BELOW_STANDARD_COLOR)}55`, borderRadius: "20px", padding: "2px 9px",
            }}
          >
            {hotel.tier ? LUXURY_TIER_LABELS[hotel.tier] : "Unterhalb des gewünschten Niveaus"}
          </span>
          {hotel.isIconic && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                color: "#C9A96E", fontSize: "0.6rem", letterSpacing: "0.06em", textTransform: "uppercase",
                border: "1px solid rgba(201,169,110,0.4)", borderRadius: "20px", padding: "2px 9px",
              }}
            >
              <Sparkles size={10} strokeWidth={1.8} />
              Iconic
            </span>
          )}
          {hotel.tier && hotel.tierBasis === "heuristic" && (
            <span style={{ color: "var(--muted)", fontSize: "0.6rem", fontStyle: "italic" }}>
              (keine offizielle Sterne-Klassifizierung — Einordnung aus Bewertung/Preisniveau)
            </span>
          )}
        </div>

        {hotel.isIconic && hotel.iconicReason && (
          <p className="mb-2" style={{ color: "#C9A96E", fontSize: "0.68rem", fontStyle: "italic" }}>{hotel.iconicReason}</p>
        )}

        <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{hotel.address}</p>

        <div className="flex flex-wrap items-center gap-3 mb-3" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          {hotel.rating !== null && !isUnverified("rating") ? (
            <span className="flex items-center gap-1">
              <Star size={11} strokeWidth={1.6} fill="var(--accent)" style={{ color: "var(--accent)" }} />
              {hotel.rating} ({hotel.reviewCount ?? 0})
            </span>
          ) : (
            <span>Bewertung nicht verifiziert</span>
          )}
          {hotel.transferMinutes !== null ? (
            <span>{hotel.transferMinutes} Min Transfer</span>
          ) : (
            <span>Transferzeit nicht verifiziert</span>
          )}
        </div>

        <p className="mb-2 italic leading-relaxed" style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{hotel.familyFitReasoning}</p>
        <p className="mb-2" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{hotel.styleImpression} · {hotel.bestFor}</p>
        {hotel.caveats && (
          <p className="mb-3" style={{ color: "#B5624A", fontSize: "0.7rem" }}>{hotel.caveats}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-2">
          {hotel.websiteUri && (
            <a
              href={hotel.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
              style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.04em", textDecoration: "none" }}
            >
              Hotelwebsite öffnen <ExternalLink size={11} strokeWidth={1.6} />
            </a>
          )}
          <a
            href={buildHolidayCheckSearchUrl(hotel.name, destination)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
            style={{ color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.04em", textDecoration: "none" }}
          >
            Bei HolidayCheck prüfen <Search size={11} strokeWidth={1.6} />
          </a>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.6rem", fontStyle: "italic" }}>Preise nicht live geprüft.</p>

        {searchKey && saveAction && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            {isSaved ? (
              <span className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)", fontSize: "0.7rem" }}>
                <Bookmark size={12} strokeWidth={1.8} fill="currentColor" />
                Gemerkt
              </span>
            ) : (
              <form action={saveAction}>
                <input type="hidden" name="search_key" value={searchKey} />
                <input type="hidden" name="option_id" value={hotel.placeId} />
                <input type="hidden" name="destination" value={destination} />
                <input type="hidden" name="return_to" value={returnTo ?? ""} />
                <button
                  type="submit"
                  disabled={saveDisabled}
                  className="inline-flex items-center gap-1.5"
                  style={{
                    background: "none", border: "none", padding: 0, fontSize: "0.7rem",
                    color: saveDisabled ? "var(--muted)" : "var(--accent)",
                    cursor: saveDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  <Bookmark size={12} strokeWidth={1.8} />
                  {saveDisabled ? "Limit erreicht -- bitte erst eins löschen" : "Dieses Hotel merken"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
