ALTER TABLE memory_photos ADD COLUMN phash TEXT;
ALTER TABLE memory_photos ADD COLUMN quality_score SMALLINT;
ALTER TABLE memory_photos ADD COLUMN analyzed_at TIMESTAMPTZ;
ALTER TABLE memory_photos ADD COLUMN is_duplicate_of UUID REFERENCES memory_photos(id) ON DELETE SET NULL;
ALTER TABLE memory_photos ADD COLUMN is_selected BOOLEAN NOT NULL DEFAULT true;
