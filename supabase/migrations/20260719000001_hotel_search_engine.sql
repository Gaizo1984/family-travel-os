-- §"Hotelvergleich zur echten eigenständigen Hotelsuche ausbauen": analog zu
-- flight_search_cache (20260718000001_flight_search_engine.sql) eine eigene,
-- ideen-unabhängige Cache-Tabelle statt einer trip_ideas-JSONB-Spalte --
-- damit die Hotel-Discovery unabhängig von einer Reiseidee genutzt werden
-- kann. search_key ist bewusst NUR nach normalisiertem Ziel qualifiziert
-- (keine Termine/Reisende/Zimmer) -- Google Places liefert ohnehin keine
-- terminabhängige Verfügbarkeit, die realen Hotelkandidaten hängen nur vom
-- Ziel ab.
--
-- §"Idempotent/wiederholbar": CREATE TABLE IF NOT EXISTS, DROP POLICY IF
-- EXISTS + CREATE POLICY (identisches Muster wie die Flug-Engine-Migration).
CREATE TABLE IF NOT EXISTS hotel_search_cache (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  search_key        TEXT        NOT NULL,
  destination       TEXT        NOT NULL,
  is_below_standard BOOLEAN     NOT NULL DEFAULT false,
  results           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, search_key)
);

ALTER TABLE hotel_search_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON hotel_search_cache;
CREATE POLICY "family_members_only" ON hotel_search_cache
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON hotel_search_cache TO authenticated;
