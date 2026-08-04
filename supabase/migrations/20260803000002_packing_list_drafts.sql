-- §"Vor der Übernahme eine kompakte Differenzansicht zeigen ... nichts wird
-- geschrieben, bevor der zweite Klick erfolgt" (Nutzervorgabe): der von der
-- KI generierte Vorschlag muss zwischen "Generieren" und "Übernehmen"
-- irgendwo liegen, ohne die eigentliche packing_items-Tabelle vorzeitig zu
-- verändern. Ein schlanker Zwischenspeicher (ein aktiver Entwurf je Reise,
-- neue Generierung überschreibt den alten) statt eines Umwegs über
-- Redirect-Query-Parameter (Längenlimit bei 50-80 Gegenständen) oder Cookies
-- (4-KB-Limit).
CREATE TABLE packing_list_drafts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  family_id  UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  items      JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id)
);

ALTER TABLE packing_list_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON packing_list_drafts
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_list_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_list_drafts TO service_role;
