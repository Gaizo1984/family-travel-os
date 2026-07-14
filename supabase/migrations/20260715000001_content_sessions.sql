-- LUMI Content Studio 2.0, Phase 1: temporärer Bild-Upload nur zur
-- Content-Erstellung, klar getrennt von dauerhaften Reiseerinnerungen
-- (memory_photos). Erweitert bestehende Tabellen additiv statt eine
-- Parallel-Struktur anzulegen -- `content_projects` bekommt einen neuen
-- `project_type='session'`, der die bestehenden Werte ('ideas'/
-- 'photo_analysis') nicht berührt; `content_project_photos` bekommt die
-- temporär/dauerhaft-Unterscheidung.
--
-- §"Reine Flughafen-Transits/temporäre Bilder dürfen nicht versehentlich als
-- besuchtes Land/dauerhafte Erinnerung zählen": `temporary`/`expires_at`
-- steuern ausschließlich den Cleanup-Job (app/api/cron/cleanup-content-
-- sessions), niemals memory_photos direkt -- `retained_as_memory`/
-- `memory_photo_id` sind nur eine Rückverfolgung, keine zweite Quelle der
-- Wahrheit (die eigentliche dauerhafte Kopie lebt unabhängig in
-- memory_photos).

ALTER TABLE content_projects
  ADD COLUMN content_date DATE,
  ADD COLUMN stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  ADD COLUMN language TEXT,
  ADD COLUMN tonality TEXT;

ALTER TABLE content_project_photos
  ADD COLUMN temporary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN retained_as_memory BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN memory_photo_id UUID REFERENCES memory_photos(id) ON DELETE SET NULL;

-- Beschleunigt den Cleanup-Job (WHERE temporary = true AND expires_at < now()).
CREATE INDEX content_project_photos_cleanup_idx ON content_project_photos (temporary, expires_at) WHERE temporary = true;
