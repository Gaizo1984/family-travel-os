'use client'

import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { purgeSensitiveOfflineDocuments } from "@/lib/offline-document-cache";

/**
 * §"Löschung bei Logout" (Nutzervorgabe, ESTA/ETA-Sonderregeln): `logout` ist
 * eine Server Action und kann IndexedDB nicht direkt anfassen -- deshalb hier
 * ein client-seitiger Vorab-Aufruf von `purgeSensitiveOfflineDocuments()`
 * (ohne tripId, global) unmittelbar vor dem normalen Form-Submit an `logout`.
 * Fire-and-forget: die Seite navigiert ohnehin sofort weg, ein Warten auf das
 * Ergebnis wäre nur eine unnötige Verzögerung beim Abmelden. Boardingpässe/
 * Gepäckbelege (`policy: 'standard'`) bleiben davon unberührt.
 */
export function LogoutButton() {
  return (
    <form
      action={logout}
      style={{ flexShrink: 0 }}
      onSubmit={() => {
        void purgeSensitiveOfflineDocuments();
      }}
    >
      <button
        type="submit"
        aria-label="Abmelden"
        style={{
          width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "50%",
          color: "var(--muted)", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
        }}
      >
        <LogOut size={16} strokeWidth={1.6} />
      </button>
    </form>
  );
}
