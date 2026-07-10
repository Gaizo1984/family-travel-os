-- Optionales Gesamtbudget je Reise + Anzeigewährung (Standard EUR).
ALTER TABLE trips ADD COLUMN budget_amount NUMERIC;
ALTER TABLE trips ADD COLUMN budget_currency TEXT NOT NULL DEFAULT 'EUR';

-- Wechselkurse je Reise und Fremdwährung -> Reisewährung. Nachvollziehbar durch
-- source ('manual' | 'eodhd') + updated_at. Ohne Zeile für eine Währung wird
-- nichts erfunden — die UI zeigt den Betrag unumgerechnet mit Hinweis "Kurs fehlt".
CREATE TABLE trip_exchange_rates (
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  currency   TEXT        NOT NULL,
  rate       NUMERIC     NOT NULL,
  source     TEXT        NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, currency)
);
ALTER TABLE trip_exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_select" ON trip_exchange_rates FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON trip_exchange_rates FOR ALL    USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_exchange_rates TO anon, authenticated;
