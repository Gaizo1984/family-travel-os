-- §Bugfix "Fotos aus Travel Memory sind manuell erfassten Reisen (past_trips)
-- nicht zuordenbar" (Nutzer-Feedback): memory_photos.trip_id verweist per FK
-- ausschließlich auf trips(id) -- eine Zuordnung zu past_trips war strukturell
-- unmöglich, nicht nur ein UI-Fehler. past_trips behält sein bestehendes
-- einzelnes photo_storage_path (Titelbild, siehe past-trips.ts), past_trip_id
-- ist der neue, zusätzliche Weg für eine echte Mehrfoto-Galerie wie bei
-- "echten" Reisen. Ein Foto gehört höchstens einer Reiseform an.

ALTER TABLE memory_photos
  ADD COLUMN past_trip_id UUID REFERENCES past_trips(id) ON DELETE SET NULL;

ALTER TABLE memory_photos
  ADD CONSTRAINT memory_photos_single_trip_link CHECK (trip_id IS NULL OR past_trip_id IS NULL);

CREATE INDEX memory_photos_past_trip_id_idx ON memory_photos(past_trip_id);
