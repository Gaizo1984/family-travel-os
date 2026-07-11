CREATE TABLE memory_photos (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id               UUID        REFERENCES trips(id) ON DELETE SET NULL,
  uploaded_by_person_id UUID        REFERENCES persons(id) ON DELETE SET NULL,
  storage_path          TEXT        NOT NULL,
  taken_at              DATE,
  caption               TEXT,
  is_highlight          BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE memory_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_select" ON memory_photos FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON memory_photos FOR ALL    USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON memory_photos TO anon, authenticated;
