# LUMI Security Foundation 1A — Abschlussbericht

Datum: 2026-07-12
Umsetzung: Supabase Auth + RLS-Lockdown für Marcel und Sarah.

## Root Cause

Seit der allerersten Schema-Migration (`20260708000002`/`20260708000003`, 2026-07-08) waren RLS-Policies auf allen Tabellen offen (`USING (true)`) und die `anon`-Rolle hatte volle Lese-/Schreib-Grants — mit dem expliziten Kommentar "DEV-ONLY, Phase 7 ersetzt dies durch echtes Auth". Phase 7 (`20260711000013`) kam, ergänzte aber nur weitere Tabellen im selben offenen Muster — echtes Auth wurde nie gebaut. Der öffentliche `anon`-Key (sichtbar in jedem Client-Bundle) gewährte damit jedem im Internet vollen Lese-/Schreibzugriff auf alle Familien-, Reise-, Dokument- und Fotodaten.

## Umgesetzt

- **Supabase Auth**: E-Mail/Passwort, Login/Logout, Passwort-Reset per E-Mail-Link (`lib/actions/auth.ts`, `app/auth/confirm/route.ts`).
- **`proxy.ts`**: Session-Refresh + Routenschutz für alle Seiten außer `/login` und `/auth/confirm` (Next.js benennt `middleware.ts` in dieser Version in `proxy.ts` um).
- **Route-Group-Split**: `app/(app)/` (bestehende Navigation/Sidebar, unverändert) vs. `app/(auth)/` (Login/Passwort-Reset, nav-frei). `app/layout.tsx` bleibt einziges Root-Layout (html/body/Metadata/Fonts/SplashScreen).
- **RLS-Lockdown**: alle 32 Tabellen + Storage-Bucket `documents` von offenen `dev_select`/`dev_write`-Policies auf `auth.uid() IS NOT NULL` umgestellt; `anon`-Rolle jeglicher Zugriff entzogen — bestehend (`REVOKE`) und zukünftig (`ALTER DEFAULT PRIVILEGES`).
- **`persons.auth_user_id`** (nullable, `ON DELETE SET NULL`) verknüpft Marcel und Sarah mit ihren Supabase-Auth-Konten.
- **Passkeys/WebAuthn**: nicht implementiert (wie gefordert), aber architektonisch vorbereitet — Supabase Auth unterstützt Passkeys nativ im Beta seit 2026-05-28 (`@supabase/supabase-js` ≥ 2.105.0, Projekt nutzt bereits 2.110.1), keine zusätzliche Abstraktion nötig.

**Bewusste Abweichung vom ursprünglichen Auftrag** (mit Nutzer abgestimmt): statt Familien-scoped RLS (30 tabellenspezifische Join-Policies über `family_id`) wurde eine einheitliche `auth.uid() IS NOT NULL`-Policie je Tabelle umgesetzt. Da aktuell und auf absehbare Zeit nur eine Familie existiert, ist der Sicherheitsgewinn identisch, bei einem Bruchteil der Komplexität und Fehleroberfläche. Architektur bleibt für 1B nachrüstbar (siehe Empfehlungen).

## Vorfall während der Umsetzung (Transparenz)

Beim Anwenden der Verknüpfungs-Migration (`persons.auth_user_id` für Marcel/Sarah) wendete `supabase db push` zusätzlich die bereits vorbereitete, aber noch nicht freigegebene Lockdown-Migration mit an — der Befehl wendet grundsätzlich alle ausstehenden Migrationen an, nicht selektiv einzelne Dateien. Dadurch verlor die zu diesem Zeitpunkt noch nicht auf Login umgestellte Produktion kurzzeitig jeglichen Datenzugriff (anon-Key gesperrt, Login-Code noch nicht deployt). Sofort behoben durch Notfall-Deploy des bereits fertigen, lokal geprüften Login-Codes; binnen der Deploy-Zeit (~85 Sekunden) war der Zugriff über Login wiederhergestellt. Kein Datenverlust, keine Kompromittierung, aber eine kurze Downtime für berechtigte Nutzer, die vermeidbar gewesen wäre.

## Testergebnisse

- `npx tsc --noEmit`: sauber (nach jeder Änderung wiederholt geprüft)
- `npx next build`: sauber, alle Routen vorhanden (inkl. `/login`, `/login/reset`, `/reset-password`, `/auth/confirm`)
- Lokaler Produktions-Server-Smoketest: alle Kernseiten wie erwartet
- Direkter anon-Key-Test gegen Produktion: vor Lockdown voller Zugriff (Ausgangslücke bestätigt), nach Lockdown "permission denied" auf allen getesteten Tabellen (Fix bestätigt)
- Proxy-Redirect in Produktion verifiziert: geschützte Routen → 307 zu `/login` ohne Session, `/login` selbst 200
- Nutzerbestätigt: Login funktioniert, voller Zugriff nach Login vorhanden; vollständige Regressions-Checkliste bestanden — Dokumente-Hub, Versicherungen, Buchungen/Bordkarten, Budget-Beleg-Upload, Profilfoto-Crop, Travel Memory Einzel- und Mehrfach-Upload, Titelbild/Highlight, Yearbook, Content Studio Foto-Upload und "Bilder analysieren"

## Risiken / offene Punkte

1. Kein Rate-Limiting/Brute-Force-Schutz auf dem Login-Formular über Supabase Auths Standardgrenzen hinaus — bei 2 Nutzern geringes Risiko, aber erwähnenswert.
2. Familien-Scoping (echtes `family_id`-RLS) ist noch nicht umgesetzt — aktuell irrelevant (1 Familie), relevant erst bei einer zweiten Familie.
3. Kein anwendungsseitig sichtbares Audit-Log für Login-Versuche/Passwort-Änderungen (Supabase führt intern Logs, aber nicht in der App einsehbar).
4. Passwort-Reset-E-Mails laufen über Supabase Standard-SMTP (kostenlose Stufe, rate-limited) — für 2 Nutzer unproblematisch.
5. Keine Zwei-Faktor-Authentifizierung.

## Empfehlungen für Security Foundation 1B

1. **Passkeys/WebAuthn aktivieren** (Supabase Dashboard) — größter UX-/Sicherheitsgewinn, Architektur ist bereits kompatibel.
2. **Familien-Scoped RLS nachrüsten**, falls je eine zweite Familie hinzukommt (`persons.auth_user_id` + `family_id`-Join-Policies je Tabelle).
3. **`lib/family.ts::getFamily()`** auf session-basierte Auflösung umstellen, sobald 1B Familien-Scoping einführt (aktuell bewusst unverändert gelassen, um den Blast-Radius von 1A klein zu halten).
4. Login-Rate-Limiting/Anomalie-Erkennung prüfen.
5. Eigene Custom-SMTP-Domain für Auth-E-Mails erwägen, falls die Supabase-Standard-Zustellung unzuverlässig wird.

## Commit

Bereits committed und auf `main` gepusht (Notfall-Deploy, siehe Vorfall oben) — Commit `7a985a8`.
