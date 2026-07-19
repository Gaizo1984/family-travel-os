-- §"Echte Hotel-Merkfunktion ergänzen" (Nutzervorgabe, kombinierter
-- Fix-Sprint): Hotels hatten bisher gar keine Merkfunktion, nur eine
-- "zuletzt gesucht"-Liste ganzer Ziel-Trefferlisten (hotel_search_cache).
-- 1:1 nach Vorbild von saved_flight_options (20260721000001), inkl.
-- search_key von Anfang an (für "Treffer öffnen") und echter,
-- familien-gescopter RLS-Policy von Anfang an -- kein Nachbessern nötig
-- wie zuletzt bei concierge_messages.
CREATE TABLE IF NOT EXISTS saved_hotel_options (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  search_key  TEXT        NOT NULL,
  destination TEXT        NOT NULL,
  option_id   TEXT        NOT NULL, -- Places placeId
  hotel_option JSONB      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, search_key, option_id)
);

ALTER TABLE saved_hotel_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON saved_hotel_options
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_hotel_options TO authenticated;
