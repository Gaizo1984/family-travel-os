-- journey_events: leichte, nicht-buchungsartige Termine/Reservierungen innerhalb
-- eines Aufenthalts (Restaurant, Spa, Pool-Tag, persönlicher Plan, freie Notiz).
-- Keine Buchung, zählt nicht in Buchungsstatistiken/Kosten.
CREATE TABLE journey_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id)  ON DELETE CASCADE,
  stage_id   UUID        REFERENCES stages(id)          ON DELETE SET NULL,
  date       DATE        NOT NULL,
  time       TIME,
  category   TEXT        NOT NULL,  -- restaurant | spa | golf_sport | kids_club | activity | personal | note
  title      TEXT        NOT NULL,
  location   TEXT,
  notes      TEXT,
  status     TEXT        NOT NULL DEFAULT 'idea',  -- idea | planned | reserved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER journey_events_updated_at
  BEFORE UPDATE ON journey_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE journey_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_select" ON journey_events FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON journey_events FOR ALL    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON journey_events TO anon, authenticated;
