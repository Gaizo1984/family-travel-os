-- ============================================================
-- Sprint 1.2: Neues Premium-Feature "Bilder analysieren" im
-- Content Studio. Rein additiv — keine bestehende Spalte/Tabelle
-- wird verändert.
-- ============================================================

ALTER TABLE content_projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'ideas';
-- 'ideas' (bestehend, Content-Ideen) | 'photo_analysis' (neu)

ALTER TABLE content_project_photos ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}';
-- z. B. best_family_photo, most_emotional, landscape, drone, luxury, cover_image, story, reel, album
ALTER TABLE content_project_photos ADD COLUMN reasoning TEXT;
ALTER TABLE content_project_photos ADD COLUMN recommendation TEXT;
-- 'post' | 'story' | 'reel' | 'fotobuch' | 'album'

CREATE TABLE content_photo_analyses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id          UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  project_id         UUID        REFERENCES content_projects(id) ON DELETE SET NULL,
  trip_id            UUID        REFERENCES trips(id) ON DELETE SET NULL,
  caption            TEXT,
  hashtags           TEXT[]      NOT NULL DEFAULT '{}',
  hook               TEXT,
  story_structure    JSONB,
  reel_order         JSONB,
  music_suggestions  TEXT[]      NOT NULL DEFAULT '{}',
  photobook_chapters JSONB,
  travel_diary       TEXT,
  status             TEXT        NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER content_photo_analyses_updated_at BEFORE UPDATE ON content_photo_analyses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE content_photo_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_select" ON content_photo_analyses FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON content_photo_analyses FOR ALL    USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON content_photo_analyses TO anon, authenticated;
