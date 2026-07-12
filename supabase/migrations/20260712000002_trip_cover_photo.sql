-- ============================================================
-- Feature: Titelbild der Reise selbst auswählen/bestimmen. Separat vom
-- bestehenden "Highlight"-Stern (mehrere möglich, eigene Galerie-Sektion) --
-- ein Foto ist explizit DAS Titelbild einer Reise, hat Vorrang vor der
-- automatischen Bildauflösung (Highlight -> kuratiertes Bild -> Destination
-- -> Farbverlauf).
-- ============================================================

ALTER TABLE trips ADD COLUMN cover_photo_id UUID REFERENCES memory_photos(id) ON DELETE SET NULL;
