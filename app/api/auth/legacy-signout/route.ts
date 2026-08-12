import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * §Zentraler Lumi-Login, zentraler Logout (Masterprompt §10): "Solange
 * Legacy-Travel-Passkey noch existiert, dessen alte Session beim Logout
 * ebenfalls sauber beenden." Der zentrale Launcher-Logout kann Travels
 * EIGENE (Legacy-Passkey-)Session nicht direkt beenden -- anderes
 * Supabase-Projekt, andere Credentials, Launcher hat dafür keinen Client.
 * Dieser Route Handler läuft dagegen auf Travels eigenem Server (auch über
 * den bestehenden Multi-Zones-Rewrite unter /travel/api/... erreichbar)
 * und hat den passenden Client -- wird vom zentralen Launcher-Logout als
 * Best-Effort-Zusatzschritt aufgerufen. Rührt NICHT die Lumi-Core-Session
 * an (die beendet der Launcher selbst über seinen eigenen Client).
 *
 * `auth.signOut()` widerruft den Refresh-Token serverseitig bei Supabase --
 * das ist der sicherheitsrelevante Teil (eine noch im Browser vorhandene
 * Cookie-Kopie wird dadurch ungültig, unabhängig davon, ob sie im selben
 * Zug auch tatsächlich aus dem Browser gelöscht wird). Diese Route wird
 * server-seitig innerhalb einer anderen Server Action aufgerufen (siehe
 * lumi-launcher/lib/actions/auth.ts::logout) -- ihre Set-Cookie-Antwort
 * erreicht den Browser deshalb nicht direkt; das ist ein bewusst
 * akzeptierter Kompromiss (Session-Widerruf ist der sicherheitskritische
 * Teil, eine kurzzeitig noch im Browser liegende, aber bereits ungültige
 * Cookie ist unkritisch).
 */
export async function POST() {
  // Route Handler laufen im selben Next.js-Request-Kontext -- createClient()
  // liest die eingehenden Cookies bereits automatisch über next/headers'
  // cookies() (siehe lib/supabase/server.ts), kein manuelles Header-Parsing nötig.
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
