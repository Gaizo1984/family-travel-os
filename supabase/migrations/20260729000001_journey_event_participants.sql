-- §"Teilnehmer (Lia, Marcel, Sarah etc.) auch bei Journey-Terminen auswählbar"
-- (Nutzervorgabe, wörtlich). Gleiche Konvention wie bookings.participant_person_ids
-- (siehe 20260727000005_booking_activity_participants.sql): echte UUID-Array-
-- Spalte, keine JSONB-Zweckentfremdung. Kein FK-Constraint auf einzelne
-- Array-Elemente möglich (Postgres) -- die App filtert deshalb defensiv gegen
-- inzwischen gelöschte Personen (siehe lib/actions/journey-events.ts).
ALTER TABLE journey_events
  ADD COLUMN IF NOT EXISTS participant_person_ids UUID[];
