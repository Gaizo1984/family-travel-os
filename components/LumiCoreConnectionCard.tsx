import { getCurrentPerson } from "@/lib/current-person";
import { connectLumiCore, disconnectLumiCoreSession } from "@/lib/actions/lumi-core";
import { getTravelModuleAccess } from "@/lib/lumi-core-identity";

/**
 * Phase 3A -- rein informative Anzeige der Lumi-Core-Verbindung. Blockiert
 * nichts: Travel funktioniert für jede Person exakt gleich, ob verbunden
 * oder nicht (siehe Master-Prompt §9). Kein Fehler, wenn keine Person zur
 * aktuellen Session gefunden wird (z.B. ein Account ohne persons-Zeile) --
 * die Karte wird dann einfach nicht angezeigt.
 */
export async function LumiCoreConnectionCard({
  error,
  connected,
}: {
  error?: string;
  connected?: boolean;
}) {
  const person = await getCurrentPerson();
  if (!person) return null;

  const isConnected = !!person.lumiCoreProfileId;
  const travelAccess = isConnected ? await getTravelModuleAccess() : "unknown";

  return (
    <div className="mb-14 p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
        Lumi Core
      </div>

      {error && (
        <p className="mb-3" style={{ color: "#B0453D", fontSize: "0.78rem" }}>
          {error}
        </p>
      )}
      {connected && (
        <p className="mb-3" style={{ color: "#4C7A5B", fontSize: "0.78rem" }}>
          Verbindung erfolgreich hergestellt.
        </p>
      )}

      {isConnected ? (
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
      ) : (
        <form action={connectLumiCore} className="flex flex-col sm:flex-row gap-2 items-stretch">
          <input
            type="email"
            name="email"
            placeholder="Lumi-Core-E-Mail"
            required
            className="flex-1 px-3 py-2 rounded-lg"
            style={{ background: "var(--background)", border: "1px solid var(--border)", fontSize: "0.82rem" }}
          />
          <input
            type="password"
            name="password"
            placeholder="Lumi-Core-Passwort"
            required
            className="flex-1 px-3 py-2 rounded-lg"
            style={{ background: "var(--background)", border: "1px solid var(--border)", fontSize: "0.82rem" }}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg"
            style={{ background: "var(--accent)", color: "var(--surface)", fontSize: "0.78rem", border: "none", cursor: "pointer" }}
          >
            Mit Lumi Core verbinden
          </button>
        </form>
      )}
    </div>
  );
}
