-- §"LUMI - Intelligente Packliste 2.0" (Nutzervorgabe): mit Nutzer
-- abgestimmter Umbau statt paralleler Felder --
-- `priority` (3 Stufen) ersetzt `is_essential` (2 Stufen), `needs_check`
-- macht das bisher nur in reasoning-Text eingebettete Bild-Check-artige
-- "Bitte prüfen"-Flag erstmals filterbar, `is_last_minute` löst
-- "kurz_vor_abfahrt" als eigenständiges Cross-Kategorie-Konzept ab (bisher
-- eine Kategorie unter vielen). Bestehende Oman-Testdaten werden migriert,
-- nicht nur neuer Code angelegt.

ALTER TABLE packing_items
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'empfohlen'
    CHECK (priority IN ('unverzichtbar', 'empfohlen', 'optional')),
  ADD COLUMN needs_check TEXT
    CHECK (needs_check IN ('baggage_allowance', 'hotel_amenity', 'airline_rule')),
  ADD COLUMN is_last_minute BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN weight_grams INTEGER;

UPDATE packing_items SET priority = 'unverzichtbar' WHERE is_essential = true;
UPDATE packing_items SET category = 'technik' WHERE category = 'elektronik';
UPDATE packing_items SET category = 'medikamente_und_gesundheit' WHERE category = 'gesundheit';
UPDATE packing_items SET is_last_minute = true, category = 'sonstiges' WHERE category = 'kurz_vor_abfahrt';

ALTER TABLE packing_items DROP COLUMN is_essential;

-- §"Benannte, verwaltbare Gepäckstücke mit Gewichtsschätzung" (Nutzervorgabe):
-- rein additiv zur bestehenden groben `luggage_assignment`-Spalte (bleibt
-- unverändert bestehen) -- keine Reise muss Gepäckstücke anlegen, um die
-- Packliste weiter normal zu nutzen.
CREATE TABLE packing_luggage (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  person_id             UUID        REFERENCES persons(id) ON DELETE SET NULL,
  label                 TEXT        NOT NULL,
  allowed_weight_grams  INTEGER,
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE packing_items
  ADD COLUMN luggage_id UUID REFERENCES packing_luggage(id) ON DELETE SET NULL;

CREATE INDEX packing_items_luggage_id_idx ON packing_items(luggage_id);
CREATE INDEX packing_luggage_trip_id_idx ON packing_luggage(trip_id);

-- §Security-Foundation-Scoping (frühere Sitzungsentscheidung): neue Tabellen
-- bekommen bewusst blanket authenticated_only wie die übrigen ~32 Tabellen
-- dieser Stufe -- familien-gescopte RLS ist ein eigener, gemeinsamer
-- späterer Sprint, nie pro Tabelle einzeln vorgezogen.
ALTER TABLE packing_luggage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_only" ON packing_luggage FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_luggage TO authenticated, service_role;

CREATE TRIGGER packing_luggage_updated_at BEFORE UPDATE ON packing_luggage FOR EACH ROW EXECUTE FUNCTION set_updated_at();
