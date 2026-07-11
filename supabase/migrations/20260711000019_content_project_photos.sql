CREATE TABLE content_project_photos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
  storage_path    TEXT        NOT NULL,
  phash           TEXT,
  quality_score   SMALLINT,
  is_duplicate_of UUID        REFERENCES content_project_photos(id) ON DELETE SET NULL,
  is_selected     BOOLEAN     NOT NULL DEFAULT true,
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_project_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_select" ON content_project_photos FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON content_project_photos FOR ALL    USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON content_project_photos TO anon, authenticated;

ALTER TABLE content_drafts ADD COLUMN instagram_ready BOOLEAN NOT NULL DEFAULT false;
