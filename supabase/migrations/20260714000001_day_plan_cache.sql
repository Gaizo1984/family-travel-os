-- §Bugfix "Tagestrips löschen sich bei Menüpunktwechsel": der Tagesplan
-- wurde bisher nur transient per Redirect-Query-Param (?plan=...) an die
-- Seite übergeben -- ohne den Parameter (z. B. nach Navigation zu einem
-- anderen Menüpunkt und zurück) war er unwiederbringlich weg. Analog zu
-- category_places_cache (20260713000002) wird der zuletzt erzeugte Plan
-- jetzt persistiert und bleibt bestehen, bis eine neue Ermittlung
-- (generateDayPlan) ihn überschreibt.
--
-- UNIQUE über (family_id, trip_id, mode): pro Reise und Planungsmodus
-- (Heute/Morgen/Schlechtwetter/...) genau ein zwischengespeicherter Plan.
CREATE TABLE day_plan_cache (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  mode       TEXT        NOT NULL,
  plan       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, trip_id, mode)
);

ALTER TABLE day_plan_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON day_plan_cache
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON day_plan_cache TO authenticated;
