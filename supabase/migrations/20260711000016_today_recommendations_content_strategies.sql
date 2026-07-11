-- Phase 11.1: KI-Tagesplanung nur einmal pro Kalendertag (statt bei jedem
-- Seitenaufruf neu generiert) + neue "Today's Content Strategy" im Content
-- Studio (Content Director statt Ideengenerator). Beide additiv, je Familie
-- + Reise + Kalendertag höchstens eine Zeile (UNIQUE), damit "einmal pro Tag,
-- bis Mitternacht wiederverwenden" ohne zusätzliche Anwendungslogik greift.

CREATE TABLE today_recommendations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id             UUID        REFERENCES trips(id) ON DELETE CASCADE,
  for_date            DATE        NOT NULL,
  day_style           TEXT,
  highlight_title     TEXT,
  day_summary         TEXT        NOT NULL,
  recommendation      JSONB       NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, trip_id, for_date)
);

CREATE TABLE content_strategies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id        UUID        REFERENCES trips(id) ON DELETE CASCADE,
  for_date       DATE        NOT NULL,
  content_type   TEXT        NOT NULL,
  reasoning      TEXT        NOT NULL,
  storyline      TEXT        NOT NULL,
  shotlist       JSONB       NOT NULL,
  best_time      TEXT,
  effort         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, trip_id, for_date)
);

ALTER TABLE today_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_strategies    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_select" ON today_recommendations FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON today_recommendations FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON content_strategies    FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON content_strategies    FOR ALL    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON today_recommendations, content_strategies TO anon, authenticated;
