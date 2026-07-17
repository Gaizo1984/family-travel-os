-- §"LUMI Brain -- Token- und Kostenkontrolle" (Nutzervorgabe): bisher gab es
-- ausschließlich für Duffel-Flugsuchen ein monatliches Limit
-- (flight_search_usage). Frag LUMI ruft OpenAI potenziell in vielen
-- Dialog-Turns auf -- exakt dasselbe Muster, nur für echte OpenAI-Aufrufe
-- (Cache-Treffer zählen nie mit).
--
-- §"Idempotent/wiederholbar": CREATE TABLE IF NOT EXISTS, DROP POLICY IF
-- EXISTS + CREATE POLICY (identisches Muster wie flight_search_usage).
CREATE TABLE IF NOT EXISTS lumi_brain_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_key     TEXT        NOT NULL,
  question_count INT        NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, month_key)
);

ALTER TABLE lumi_brain_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON lumi_brain_usage;
CREATE POLICY "family_members_only" ON lumi_brain_usage
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON lumi_brain_usage TO authenticated;
