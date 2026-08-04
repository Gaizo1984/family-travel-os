-- §"Urlaubsbeitrag aus dem Bild-Check" (Nutzervorgabe): "Vormerken" ist der
-- erste Schritt, der ein Bild-Check-Ergebnis überhaupt dauerhaft speichert
-- (bisher rein Client-State, siehe lib/actions/image-check.ts). Bewusst
-- KEINE neue Tabelle -- eine content_project_photos-Zeile IST bereits die
-- Foto-Referenz UND (nach dieser Migration) die Analyse; trip_id kommt
-- weiterhin über project_id -> content_projects.trip_id.
--
-- Eigene Spalten statt Wiederverwendung der bestehenden quality_score/
-- reasoning/recommendation/categories-Spalten: die gehören zur älteren,
-- unabhängigen "photo_analysis_feature" (content_photo_analyses) und werden
-- von Bild-Check nicht befüllt -- Vermischung zweier Features vermeiden.
--
-- Löschung braucht keine neue Cleanup-Logik: expires_at wird beim Vormerken
-- von der ursprünglichen 24h-Upload-TTL auf Reiseende+7 Tage überschrieben,
-- der bestehende cleanupExpiredContentSessionPhotos-Cron (WHERE temporary
-- AND NOT retained_as_memory AND expires_at < now()) übernimmt den Rest
-- automatisch.

ALTER TABLE content_project_photos
  ADD COLUMN vacation_post_marked_at TIMESTAMPTZ,
  ADD COLUMN vacation_post_score     SMALLINT,
  ADD COLUMN vacation_post_reasoning TEXT,
  ADD COLUMN vacation_post_rank      SMALLINT,
  ADD COLUMN vacation_post_pinned    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX content_project_photos_vacation_post_idx
  ON content_project_photos (vacation_post_marked_at)
  WHERE vacation_post_marked_at IS NOT NULL;
