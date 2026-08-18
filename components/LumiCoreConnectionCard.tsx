import { getCurrentPerson } from "@/lib/current-person";
import { disconnectLumiCoreSession } from "@/lib/actions/lumi-core";
import { getTravelModuleAccess } from "@/lib/lumi-core-identity";

/**
 * FINALER CUTOVER: Lumi Core ist der primäre Login -- `getCurrentPerson()`
 * ist bereits Lumi-Core-authentifiziert, es gibt keinen unverbundenen
 * Zustand mehr für eine normal eingeloggte Person (der frühere "Mit Lumi
 * Core verbinden"-Formularpfad war dadurch unerreichbar geworden und schrieb
 * zudem in Travels eigene persons/families-Tabellen -- entfernt). Diese
 * Karte zeigt nur noch den (informativen, nie blockierenden) Verbindungs-
 * status + die Möglichkeit, ausschließlich die Lumi-Core-Sitzung zu trennen.
 */
export async function LumiCoreConnectionCard() {
  const person = await getCurrentPerson();
  if (!person) return null;

  const travelAccess = await getTravelModuleAccess(person.id);

  return (
    <div className="mb-14 p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
        Lumi Core
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>
            Verbunden mit Lumi Core als <strong>{person.name}</strong>.
          </p>
          {travelAccess === "unavailable" && (
            <p style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: "4px" }}>
              Hinweis: Lumi Core zeigt für dieses Profil keinen Travel-Modulzugriff (rein informativ, blockiert nichts).
            </p>
          )}
        </div>
        <form action={disconnectLumiCoreSession}>
          <button
            type="submit"
            style={{ color: "var(--muted)", fontSize: "0.72rem", background: "none", border: "none", cursor: "pointer" }}
          >
            Lumi-Core-Sitzung trennen
          </button>
        </form>
      </div>
    </div>
  );
}
