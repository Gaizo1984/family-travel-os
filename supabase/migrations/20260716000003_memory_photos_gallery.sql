-- §"Travel Memory in die Reise integrieren": memory_photos wird die
-- alleinige Datengrundlage der neuen Reise-Galerie -- additive Spalten,
-- keine neue Tabelle, keine Datenbewegung (bestehende Zeilen/Storage-Pfade
-- bleiben unangetastet).
ALTER TABLE memory_photos
  ADD COLUMN stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER memory_photos_updated_at
  BEFORE UPDATE ON memory_photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- §"Zugriff ausschließlich für Mitglieder der jeweiligen family_id, keine
-- reine authenticated-only-Policy": gezielte Verschärfung nur für
-- memory_photos (App-weiter Standard bleibt an anderer Stelle unverändert,
-- siehe 20260712000004_auth_lockdown.sql) -- gleiches Muster wie
-- day_plan_cache/category_places_cache.
DROP POLICY IF EXISTS "authenticated_only" ON memory_photos;
CREATE POLICY "family_members_only" ON memory_photos
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
