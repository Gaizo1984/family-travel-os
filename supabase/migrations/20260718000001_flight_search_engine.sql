-- §"LUMI Live-Flugvergleich": departure_city war bisher nur unbenutzter
-- Freitext in clarifying_answers -- wird jetzt echte Spalte, da die
-- Flug-Engine sie aktiv lesen muss (gleiches Vorgehen wie zuvor bei
-- traveler_ids).
ALTER TABLE trip_idea_sessions ADD COLUMN departure_city TEXT;

-- Zeigt nur, welche flight_search_cache-Zeile "aktuell" zu dieser Idee
-- gehört -- die Cache-Zeile selbst bleibt ideen-unabhängig abfragbar
-- (siehe unten), damit spätere Konsumenten (Varianten/Budget/Tagesplanung/
-- Buchungsportal) dieselbe Suche über search_key wiederfinden können.
ALTER TABLE trip_ideas
  ADD COLUMN flight_search_key TEXT,
  ADD COLUMN flight_options_updated_at TIMESTAMPTZ;

-- §"Zentrale, providerneutrale Flug-Engine, keine doppelte Logik": eigene
-- Cache-Tabelle statt einer trip_ideas-JSONB-Spalte (wie hotel_shortlist),
-- damit Suchergebnisse über denselben search_key von mehreren Modulen
-- wiederverwendet werden können, ohne an eine bestimmte Idee gebunden zu
-- sein. origin_codes bewusst als Array (auch wenn diese Phase immer genau
-- ein Element befüllt) -- verhindert eine spätere Spalten-Umbenennung,
-- sobald alternative Abflughäfen unterstützt werden.
CREATE TABLE flight_search_cache (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  search_key        TEXT        NOT NULL,
  origin_codes      TEXT[]      NOT NULL,
  destination_code  TEXT        NOT NULL,
  departure_date    DATE        NOT NULL,
  return_date       DATE,
  adults            INT         NOT NULL,
  children          INT         NOT NULL DEFAULT 0,
  infants           INT         NOT NULL DEFAULT 0,
  is_sandbox_data   BOOLEAN     NOT NULL DEFAULT true,
  results           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- §"Mehrfachklicks/parallele Suchen verhindern": pragmatischer Claim-
  -- Zeitstempel (kein hartes Distributed Lock, siehe lib/actions/flight-search.ts).
  search_started_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, search_key)
);

ALTER TABLE flight_search_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON flight_search_cache
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON flight_search_cache TO authenticated;

-- §"Kostenkontrolle": zählt ausschließlich ECHTE Provider-Aufrufe (Cache-
-- Treffer erhöhen den Zähler nie), monatlich pro Familie über den
-- month_key-Wechsel "zurückgesetzt" (kein Cronjob nötig).
CREATE TABLE flight_search_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_key     TEXT        NOT NULL,
  search_count  INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, month_key)
);

ALTER TABLE flight_search_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON flight_search_usage
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON flight_search_usage TO authenticated;
