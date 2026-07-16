-- §"Egress-Analyse 2026-07-16": Signed URLs für Supabase-Storage-Fotos
-- wurden bisher bei JEDEM Render neu erzeugt -- da der Token in der URL
-- steckt, ändert sich die Bild-URL dadurch bei jedem Seitenaufruf, wodurch
-- der Browser dasselbe Foto nie aus dem Cache laden konnte (Haupt-Ursache
-- für einen Egress-Speicher-Multiplikator von ~53x). Diese Tabelle cached
-- bereits ausgestellte Signed URLs serverseitig, damit dieselbe Bild-URL
-- über ihre Gültigkeitsdauer hinweg stabil bleibt und der Browser sie
-- normal cachen kann.
--
-- §"Idempotent/wiederholbar": CREATE TABLE IF NOT EXISTS, DROP POLICY IF
-- EXISTS + CREATE POLICY (identisches Muster wie bisherige Migrationen).
CREATE TABLE IF NOT EXISTS signed_url_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  bucket       TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  signed_url   TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, bucket, storage_path)
);

ALTER TABLE signed_url_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON signed_url_cache;
CREATE POLICY "family_members_only" ON signed_url_cache
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON signed_url_cache TO authenticated;
