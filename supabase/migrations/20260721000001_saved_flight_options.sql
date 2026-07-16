-- §"Bis zu 3 Flugverbindungen pro Strecke merken" (Nutzervorgabe,
-- 2026-07-17): Route-basiert, DATUMSUNABHÄNGIG -- ein Nutzer soll die besten
-- Treffer über mehrere Datums-Suchläufe hinweg für dieselbe Strecke sammeln
-- können, nicht nur für einen exakten Suchlauf (anders als flight_search_cache,
-- dessen search_key immer inkl. Datum/Reisende qualifiziert ist). route_key
-- ist deshalb eine eigene, schwächere Kennung (nur Abflughäfen + Ziel).
--
-- §"Idempotent/wiederholbar": CREATE TABLE IF NOT EXISTS, DROP POLICY IF
-- EXISTS + CREATE POLICY (identisches Muster wie flight_search_cache/
-- hotel_search_cache).
CREATE TABLE IF NOT EXISTS saved_flight_options (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  route_key           TEXT        NOT NULL,
  origin_codes        TEXT[]      NOT NULL,
  destination_code    TEXT        NOT NULL,
  option_id           TEXT        NOT NULL,
  flight_option       JSONB       NOT NULL,
  found_departure_date DATE       NOT NULL,
  found_return_date    DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- §"Bis zu 3 pro Strecke": die Obergrenze wird in der Server Action
  -- geprüft (lib/actions/saved-flights.ts) -- diese UNIQUE-Constraint
  -- verhindert nur, dass dieselbe Verbindung durch einen Doppelklick
  -- zweimal gespeichert wird.
  UNIQUE (family_id, route_key, option_id)
);

ALTER TABLE saved_flight_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON saved_flight_options;
CREATE POLICY "family_members_only" ON saved_flight_options
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_flight_options TO authenticated;
