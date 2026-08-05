-- §"KI-Aufrufe hintergrundfest machen" (Nutzervorgabe): EINE geteilte
-- Tabelle statt 16 verschiedener Ad-hoc-Lösungen -- jede umgestellte
-- Server Action legt hier vor dem eigentlichen KI-Aufruf einen Job an,
-- redirected sofort, und erledigt die eigentliche Arbeit danach über
-- Next.js `after()` (Vercel `waitUntil`) -- exakt das bereits in
-- lib/actions/memories.ts etablierte Prinzip, nur verallgemeinert.

CREATE TABLE ai_generation_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind           TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message  TEXT,
  redirect_path  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_generation_jobs_family_id_idx ON ai_generation_jobs(family_id);

-- §Security-Foundation-Scoping (frühere Sitzungsentscheidung): blanket
-- authenticated_only wie die übrigen ~32 Tabellen dieser Stufe, keine
-- Einzel-Familien-Scopung vorziehen.
ALTER TABLE ai_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_only" ON ai_generation_jobs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_generation_jobs TO authenticated, service_role;

CREATE TRIGGER ai_generation_jobs_updated_at BEFORE UPDATE ON ai_generation_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
