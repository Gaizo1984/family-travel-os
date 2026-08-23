-- =====================================================================
-- Lumi Travel -- "intelligentes Reise-Postfach" (E-Mail-Import), Schritt 1
-- des freigegebenen Plans: NUR die zwei minimalen neuen Tabellen. Kein
-- Google-Cloud-/OAuth-/Pub-Sub-Anteil ist Teil dieser Migration.
-- Manuell im Supabase-SQL-Editor des LUMI-CORE-Projekts auszuführen
-- (gleiche Vorgehensweise wie 01-05 in diesem Ordner) -- NICHT automatisch
-- durch den Agenten ausgeführt.
--
-- Bewusst NUR zwei neue Tabellen, keine Änderung an travel_bookings/
-- travel_documents/travel_trips/household_members -- die bestehende
-- Buchungs-/Dokument-/Personen-Architektur wird 1:1 wiederverwendet:
--
-- 1) travel_email_allowed_senders -- reine Konfiguration ("Mehr ->
--    Reise-Postfach -> Erlaubte Absender"). Passt zu keiner bestehenden
--    Tabelle, deshalb neu.
--
-- 2) travel_email_imports -- die Warteschlange/Inbox-Übersicht
--    ("Verarbeitet"/"Zuordnung prüfen"/"Fehler"). Notwendig, weil
--    travel_bookings.trip_id NOT NULL ist: bei mittlerer/niedriger
--    Zuordnungssicherheit kann noch KEINE travel_bookings-Zeile entstehen
--    (§Nutzervorgabe "niemals automatisch bei mittlerer/niedriger
--    Sicherheit zuordnen") -- die extrahierten Rohdaten müssen bis zur
--    Bestätigung durch einen Menschen irgendwo geparkt werden. Bewusst
--    NICHT in travel_bookings.details geschrieben: dieses Feld wird bei
--    jedem manuellen Speichern der Buchung (createBooking/updateBooking,
--    lib/actions/bookings.ts::readCommonFields) komplett aus den
--    Formularfeldern neu aufgebaut -- jede dort "versteckte" E-Mail-
--    Provenienz würde beim nächsten manuellen Edit stillschweigend
--    verschwinden.
--
-- RLS-Konvention: exakt wie in 05_module_access_enforcement.sql etabliert
-- (aktueller Stand, NICHT das ältere is_household_member-only-Muster aus
-- 01-04) -- is_household_member(household_id) UND
-- has_module_access(household_id, 'travel') in derselben Policy, sonst
-- wären diese beiden neuen Tabellen ab dem ersten Tag schwächer
-- abgesichert als der Rest von travel_*.
--
-- Additiv, keine bestehende Tabelle/Policy/Funktion wird verändert.
-- =====================================================================

BEGIN;

-- ─── travel_email_allowed_senders ──────────────────────────────────────
-- §Nutzervorgabe ("Whitelist-Prüfung erfolgt vor jeder KI-Verarbeitung"):
-- email wird case-insensitiv verglichen (funktionaler Unique-Index auf
-- lower(email)) -- die App normalisiert zusätzlich beim Schreiben, die DB
-- erzwingt es aber unabhängig von der App-Schicht. household_member_id ist
-- NOT NULL: ein Whitelist-Eintrag ohne zugeordnete Person ergibt fachlich
-- keinen Sinn (wessen Weiterleitung wäre das sonst?).

CREATE TABLE travel_email_allowed_senders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  household_member_id   UUID        NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  email                 TEXT        NOT NULL,
  active                BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX travel_email_allowed_senders_household_email_idx
  ON travel_email_allowed_senders (household_id, lower(email));
CREATE INDEX travel_email_allowed_senders_household_id_idx ON travel_email_allowed_senders(household_id);

CREATE TRIGGER travel_email_allowed_senders_updated_at
  BEFORE UPDATE ON travel_email_allowed_senders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE travel_email_allowed_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members_only" ON travel_email_allowed_senders
  FOR ALL USING (
    is_household_member(household_id) AND has_module_access(household_id, 'travel')
  ) WITH CHECK (
    is_household_member(household_id) AND has_module_access(household_id, 'travel')
  );

-- ─── travel_email_imports ───────────────────────────────────────────────
-- Eine Zeile pro verarbeiteter (oder zu verarbeitender) E-Mail. Bewusst
-- KEIN Status "suggested"/"new" getrennt von "pending" -- 'pending' deckt
-- "gerade erst empfangen, noch nicht fertig verarbeitet" ab (z. B. während
-- der Extraktion), reicht für den aktuellen Bedarf.
--
-- gmail_message_id ist die harte Duplikatsprüfung (§Nutzervorgabe "Dubletten
-- ... mindestens anhand von Gmail Message-ID"): UNIQUE je Household --
-- dieselbe Nachricht (z. B. durch einen erneuten Pub/Sub-Push oder einen
-- manuellen Wiederholungslauf) erzeugt nie eine zweite Zeile.
--
-- extracted_data (JSONB) hält die vom KI-Auslesen gelieferten Rohfelder
-- (dieselbe Form wie der bestehende BookingDraft aus
-- lib/actions/booking-extraction.ts, um später ohne Konvertierung in den
-- bestehenden draft-Query-Parameter-Mechanismus einspeisbar zu sein) --
-- niemals Freitext/HTML der Original-Mail (§Nutzervorgabe "keine
-- Mailinhalte ... in Logs/Storage").
--
-- suggested_trip_id ist NUR ein Vorschlag (mittlere Sicherheit) -- erst
-- resulting_booking_id (gesetzt, sobald tatsächlich eine travel_bookings-
-- Zeile entstanden ist, ob automatisch bei hoher Sicherheit oder nach
-- manueller Bestätigung) markiert eine wirklich vorgenommene Zuordnung.
--
-- import_status als TEXT + CHECK statt eigenem ENUM-Typ -- konsistent mit
-- den bestehenden travel_*-Tabellen in Lumi Core (travel_bookings.status,
-- travel_documents.doc_type, ... sind dort ebenfalls TEXT, kein
-- Postgres-ENUM; anders als z. B. Lumi Tax).

CREATE TABLE travel_email_imports (
  id                                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                        UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  gmail_message_id                    TEXT        NOT NULL,
  gmail_thread_id                     TEXT,
  sender_email                        TEXT        NOT NULL,
  forwarded_by_household_member_id    UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  received_at                         TIMESTAMPTZ,
  extracted_data                      JSONB       NOT NULL DEFAULT '{}',
  suggested_booking_type              TEXT,
  suggested_trip_id                   UUID        REFERENCES travel_trips(id) ON DELETE SET NULL,
  assignment_confidence               NUMERIC,
  import_status                       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN ('pending', 'processed', 'needs_confirmation', 'needs_review', 'error', 'skipped')),
  resulting_booking_id                UUID        REFERENCES travel_bookings(id) ON DELETE SET NULL,
  error_message                       TEXT,
  processed_at                        TIMESTAMPTZ,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX travel_email_imports_household_message_idx
  ON travel_email_imports (household_id, gmail_message_id);
CREATE INDEX travel_email_imports_household_id_idx ON travel_email_imports(household_id);
CREATE INDEX travel_email_imports_status_idx ON travel_email_imports(import_status);

CREATE TRIGGER travel_email_imports_updated_at
  BEFORE UPDATE ON travel_email_imports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE travel_email_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members_only" ON travel_email_imports
  FOR ALL USING (
    is_household_member(household_id) AND has_module_access(household_id, 'travel')
  ) WITH CHECK (
    is_household_member(household_id) AND has_module_access(household_id, 'travel')
  );

COMMIT;

-- =====================================================================
-- Verifikation (read-only, kein Effekt) -- nach dem Anwenden prüfen.
-- =====================================================================

SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('travel_email_allowed_senders', 'travel_email_imports')
ORDER BY tablename;
