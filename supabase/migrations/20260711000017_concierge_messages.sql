-- Phase 12: KI Concierge -- Antworten speichern und bis zum nächsten Kalendertag
-- (oder einer neuen Frage) wiederverwenden, statt bei jedem Seitenaufruf neu zu
-- rechnen. question_key ist entweder ein fester Schnellaktions-Schlüssel
-- (z. B. 'adjust_weather', 'find_alternative') oder die normalisierte
-- Freitext-Frage. UNIQUE zusammen mit for_date sorgt automatisch dafür, dass
-- ein neuer Kalendertag (oder eine wirklich neue Frage) einen neuen Eintrag
-- erzeugt, statt den alten stillschweigend zu überschreiben.

CREATE TABLE concierge_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id             UUID        REFERENCES trips(id) ON DELETE CASCADE,
  for_date            DATE        NOT NULL,
  question_key        TEXT        NOT NULL,
  question_text       TEXT        NOT NULL,
  answer_title        TEXT        NOT NULL,
  answer_body         TEXT        NOT NULL,
  actions             JSONB       NOT NULL DEFAULT '[]',
  context_fingerprint TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, trip_id, for_date, question_key)
);

ALTER TABLE concierge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_select" ON concierge_messages FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON concierge_messages FOR ALL    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON concierge_messages TO anon, authenticated;
