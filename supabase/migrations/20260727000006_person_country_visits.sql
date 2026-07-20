-- §"Besuchte Länder personenbezogen umsetzen" (Nutzervorgabe): neues,
-- minimales Datenmodell für die Länder-Checkliste. Ergänzt die bestehende
-- travel-world-Logik (lib/travel-world.ts, unverändert), statt sie zu
-- ersetzen -- source='trip' wird ausschließlich per Sync aus bereits
-- vorhandenen Daten (stages.country_code + trip_members, past_trips +
-- past_trip_travelers) befüllt, source='manual' ausschließlich durch die
-- neue Checkliste selbst.
CREATE TABLE person_country_visits (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        UUID        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  country_code     TEXT        NOT NULL, -- ISO 3166-1 alpha-2, identisch zu den Pfad-IDs in public/world-map.svg
  source           TEXT        NOT NULL CHECK (source IN ('trip', 'manual')),
  -- Nur bei einer aktuellen Reise (trips) gesetzt -- bei Herkunft aus
  -- past_trips bleibt trip_id NULL, source ist trotzdem 'trip' (echte,
  -- dokumentierte Reise, nur kein Datensatz in der trips-Tabelle).
  trip_id          UUID        REFERENCES trips(id) ON DELETE SET NULL,
  -- Nur gesetzt, wenn ein exaktes Datum bekannt ist (z. B. Etappen-Start) --
  -- nie geschätzt/erfunden (past_trips kennt nur ein Jahr, kein Tagesdatum).
  first_visited_at DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- §"keine doppelten Länder pro Person" (Nutzervorgabe, wörtlich) -- auf DB-Ebene erzwungen.
  UNIQUE (person_id, country_code)
);

CREATE INDEX person_country_visits_person_id_idx ON person_country_visits(person_id);

ALTER TABLE person_country_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON person_country_visits
  FOR ALL
  USING (person_id IN (SELECT id FROM persons WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())))
  WITH CHECK (person_id IN (SELECT id FROM persons WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON person_country_visits TO authenticated;
