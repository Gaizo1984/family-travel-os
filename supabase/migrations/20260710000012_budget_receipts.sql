-- Optionaler Original-Beleg (Foto/PDF) je Kostenposition — nutzt denselben
-- privaten "documents"-Bucket wie alle anderen Uploads, neuer Pfad-Präfix
-- "receipts/{trip_id}/...". Zusätzliche, vom Beleg erkannte Metadaten
-- (Händler, Belegnummer, KI-Herkunft) liegen in `details`, analog zu
-- documents.details — kein bestehendes Feld wird umgewidmet.
ALTER TABLE budget_items ADD COLUMN storage_bucket TEXT;
ALTER TABLE budget_items ADD COLUMN storage_path TEXT;
ALTER TABLE budget_items ADD COLUMN details JSONB;
