-- §"Journal-Terminen eigenen Dokumenten-Upload geben, analog zu Buchungen"
-- (Nutzervorgabe, wörtlich): gleiches Muster wie documents.booking_id
-- (20260708000001_initial_schema.sql) -- kein FK-Constraint auf ein
-- gelöschtes journey_events-Element, das Dokument bleibt (trip-gebunden)
-- erhalten statt kaskadiert gelöscht zu werden.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS journey_event_id UUID REFERENCES journey_events(id) ON DELETE SET NULL;
