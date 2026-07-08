-- Migration: erlaubt 'archived' als Reise-Status (Phase 3: Archivieren mit Sicherheitsschleife)
-- Rein additiv: keine neue Spalte, keine Datenänderung, bestehende Zeilen bleiben unverändert.

ALTER TABLE trips DROP CONSTRAINT trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('planned', 'active', 'completed', 'archived'));
