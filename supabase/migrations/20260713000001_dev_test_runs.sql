-- Developer-Bereich (Mehr → Developer): EIN Datensatz pro Test-Modul
-- (letzter Lauf, upserted), damit "zuletzt erfolgreich am"/Systemstatus
-- über einen einzelnen Seitenaufruf hinaus bestehen bleibt. `result`
-- speichert nur eine kompakte, selbst zusammengestellte Zusammenfassung
-- der Testergebnisse -- niemals vollständige/rohe Google-API-Responses,
-- Keys oder Secrets.
CREATE TABLE dev_test_runs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key    TEXT        NOT NULL UNIQUE,
  success       BOOLEAN     NOT NULL,
  summary       TEXT,
  error_message TEXT,
  result        JSONB,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dev_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_only" ON dev_test_runs
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON dev_test_runs TO authenticated;
