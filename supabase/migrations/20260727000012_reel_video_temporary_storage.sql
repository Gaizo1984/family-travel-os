-- ============================================================
-- Content Studio 3.0 -- "Dateien aus dem Content Studio sollten nicht
-- dauerhaft gespeichert bleiben" (Nutzervorgabe, wörtlich): spiegelt exakt
-- das bestehende content_project_photos-Muster
-- (temporary/expires_at/retained_as_memory + Cleanup-Cron, siehe
-- 20260711000019_content_project_photos.sql). Default "temporary=false" ist
-- bewusst konservativ -- nur der eine bekannte Upload-Pfad
-- (lib/actions/content-reel-media.ts::uploadReelVideos) setzt es explizit
-- auf true + 48h-Frist; bereits bestehende Zeilen und jeder andere/zukünftige
-- Schreibzugriff bleiben ohne explizite Angabe dauerhaft. Ein Video, das noch
-- in einem Reel-Projekt ausgewählt ist, wird vom Cleanup NIEMALS automatisch
-- gelöscht (siehe lib/reel-video-cleanup.ts) -- "Reelprojekte bleiben bis zur
-- manuellen Löschung bestehen" (Nutzervorgabe).
-- ============================================================

ALTER TABLE memory_videos
  ADD COLUMN temporary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN retained_as_memory BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX memory_videos_cleanup_idx ON memory_videos (temporary, expires_at) WHERE temporary = true;
