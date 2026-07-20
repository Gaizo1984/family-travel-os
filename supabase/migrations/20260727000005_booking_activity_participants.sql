-- §"Teilnehmerauswahl nur bei Aktivitätsbuchungen, participant_person_ids
-- als echte UUID-Array-Spalte, keine JSONB-Zweckentfremdung" (Nutzervorgabe,
-- wörtlich). Gleiche Array-Konvention wie persons.interest_tags TEXT[].
-- Kein FK-Constraint auf einzelne Array-Elemente möglich (Postgres) -- die
-- App filtert deshalb überall defensiv gegen inzwischen gelöschte Personen
-- (siehe lib/actions/bookings.ts, BookingForm-Vorbefüllung).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS participant_person_ids UUID[];
