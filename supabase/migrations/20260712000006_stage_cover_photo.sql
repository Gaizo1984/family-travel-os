-- ============================================================
-- Feature: Etappen-Titelbild aus der Galerie auswählen. Gleiche Bauart wie
-- trips.cover_photo_id (20260712000002) -- rein additiv, nullable, hat
-- Vorrang vor der automatischen Länder-Bildauflösung (lib/stage-images.ts).
-- ============================================================

ALTER TABLE stages ADD COLUMN cover_photo_id UUID REFERENCES memory_photos(id) ON DELETE SET NULL;
