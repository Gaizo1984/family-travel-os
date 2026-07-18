'use client'

import { purgeSensitiveOfflineDocuments } from "@/lib/offline-document-cache";

/**
 * §"Löschung bei Reise-Löschung" (Nutzervorgabe, ESTA/ETA-Sonderregeln):
 * `deleteTripPermanently` ist eine Server Action und kann IndexedDB nicht
 * direkt anfassen -- deshalb hier ein client-seitiger Vorab-Aufruf von
 * `purgeSensitiveOfflineDocuments(tripId)` unmittelbar vor dem normalen
 * Form-Submit. Nur ESTA/ETA-Einträge dieser einen Reise betroffen, alle
 * anderen Reise-Daten (Boardingpässe/Gepäckbelege im Cache anderer Reisen,
 * die eigentliche Löschung selbst) unverändert über die bestehende
 * Server Action.
 */
export function DeleteTripSubmitButton({ tripId }: { tripId: string }) {
  return (
    <button
      type="submit"
      onClick={() => {
        void purgeSensitiveOfflineDocuments(tripId);
      }}
      style={{
        background: "#B5624A", color: "#F0EBE3", border: "none",
        borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
        letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
        whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
      }}
    >
      Ja, endgültig löschen
    </button>
  );
}
