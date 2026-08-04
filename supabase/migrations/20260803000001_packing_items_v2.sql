-- §"Intelligente Packliste" (Nutzervorgabe): packing_items existierte bereits
-- seit der allerersten Schema-Migration (20260708000001_initial_schema.sql),
-- wurde aber nie von Anwendungscode genutzt (verifiziert: keine Treffer
-- außerhalb generierter Typen) -- sicher erweiterbar ohne Datenverlustrisiko,
-- die Tabelle ist in jeder Umgebung leer.
--
-- is_packed wird durch die neue status-Spalte ersetzt (kein zweiter,
-- überlappender Zustand); is_essential bleibt unverändert stehen und deckt
-- sowohl "Priorität" als auch "als Essentiell markieren" aus der Vorgabe ab.
ALTER TABLE packing_items
  ADD COLUMN quantity           INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN status              TEXT        NOT NULL DEFAULT 'offen'
                                  CHECK (status IN ('offen', 'eingepackt', 'noch_besorgen', 'nicht_benoetigt')),
  -- §"Gepäckzuordnung" (Nutzervorgabe): bewusst nur eine Enum-Spalte, keine
  -- eigene Tabelle -- MVP schließt exakte Gepäckgewichtsermittlung explizit
  -- aus, es gibt nichts weiter zu modellieren als diese fünf Zustände.
  ADD COLUMN luggage_assignment  TEXT        NOT NULL DEFAULT 'unassigned'
                                  CHECK (luggage_assignment IN
                                    ('personal_item', 'hand_luggage', 'checked_luggage', 'stroller_or_separate', 'unassigned')),
  ADD COLUMN reasoning           TEXT,
  -- §"Herkunft des Vorschlags" (Nutzervorgabe): 'manuell' ist der Default,
  -- da jede bereits vorhandene bzw. von Hand angelegte Zeile so beginnt --
  -- die KI-Generierung setzt die übrigen Werte explizit.
  ADD COLUMN source              TEXT        NOT NULL DEFAULT 'manuell'
                                  CHECK (source IN
                                    ('basisliste', 'wetter', 'aktivitaet', 'buchung', 'hotel', 'bestaetigte_vorliebe', 'fruehere_reiseerfahrung', 'manuell')),
  -- §Abgleichsschlüssel für die Aktualisierung ohne Datenverlust (siehe
  -- lib/packing-list-generation.ts): von der KI stabil über Regenerierungen
  -- hinweg vergeben, NULL für manuell angelegte Zeilen (die nie mit der
  -- KI-Ausgabe abgeglichen werden).
  ADD COLUMN source_key          TEXT,
  ADD COLUMN note                TEXT,
  ADD COLUMN sort_order          INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE packing_items DROP COLUMN is_packed;

CREATE INDEX packing_items_trip_source_key_idx ON packing_items(trip_id, source_key);
CREATE INDEX packing_items_trip_status_idx ON packing_items(trip_id, status);

-- §Bestehende Konvention (set_updated_at(), siehe u. a. trips/bookings/
-- journey_events in 20260708000001_initial_schema.sql und
-- past_trips/family_preference_categories in
-- 20260711000013_phase7_family_content_ideas.sql) statt manuell in jeder
-- Server Action gesetztem updated_at.
CREATE TRIGGER packing_items_updated_at
  BEFORE UPDATE ON packing_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- §Bugfix "RLS war nie familien-gescoped" (bei Erweiterung entdeckt):
-- packing_items lief bisher nur unter der generischen, projektweiten
-- "authenticated_only"-Policy aus 20260712000004_auth_lockdown.sql (jeder
-- eingeloggte Nutzer könnte die Packliste jeder Familie lesen/schreiben).
-- Sicher zu verschärfen, da nachweislich kein bestehender Code auf die
-- lockere Policy angewiesen ist (Tabelle war bislang ungenutzt). Gleiches
-- Muster wie family_memories/trip_debriefs, aber über trips.family_id
-- verknüpft, da packing_items keine eigene family_id-Spalte hat.
DROP POLICY IF EXISTS "authenticated_only" ON packing_items;
CREATE POLICY "family_members_only" ON packing_items
  FOR ALL
  USING (trip_id IN (
    SELECT t.id FROM trips t
    JOIN persons p ON p.family_id = t.family_id
    WHERE p.auth_user_id = auth.uid()
  ))
  WITH CHECK (trip_id IN (
    SELECT t.id FROM trips t
    JOIN persons p ON p.family_id = t.family_id
    WHERE p.auth_user_id = auth.uid()
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_items TO service_role;
