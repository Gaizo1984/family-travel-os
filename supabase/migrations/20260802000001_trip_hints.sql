-- §"Proaktiver Reiseassistent" (Nutzervorgabe): zeitkritische, verwerfbare,
-- priorisierte, neu bewertbare Hinweise -- strukturell etwas anderes als
-- family_memories (Status pending->confirmed/declined, "was stimmt über
-- uns") oder das ungenutzte tasks (keine echte RLS, kein family_id, keine
-- Priorität/Kategorie). Eigene Tabelle statt eine der beiden zu überladen.
CREATE TABLE IF NOT EXISTS trip_hints (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id           UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  booking_id        UUID        REFERENCES bookings(id) ON DELETE CASCADE,
  document_id       UUID        REFERENCES documents(id) ON DELETE CASCADE,
  journey_event_id  UUID        REFERENCES journey_events(id) ON DELETE SET NULL,
  hint_type         TEXT        NOT NULL,
  priority          TEXT        NOT NULL CHECK (priority IN ('critical','upcoming','recommendation')),
  title             TEXT        NOT NULL,
  reasoning         TEXT        NOT NULL,
  relevant_at       TIMESTAMPTZ,
  action_label      TEXT        NOT NULL,
  action_href       TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','completed')),
  -- §Hash über exakt die inhaltlich relevanten Eingabefelder je hint_type
  -- (z. B. bei Check-in: booking_id + start_datetime), NIE über die ganze
  -- Buchungszeile -- sonst würde jede unabhängige Bearbeitung (z. B. eine
  -- Notiz) fälschlich bereits ausgeblendete Hinweise reaktivieren.
  content_hash      TEXT        NOT NULL,
  -- §Stabile Identität über Regenerationen hinweg (z. B. 'checkin:{booking_id}',
  -- 'overlap:{booking_id_a}:{booking_id_b}') -- der Generierungs-Cron
  -- upsertet darauf, das ist der Mechanismus für "nicht erneut anzeigen,
  -- solange sich die zugrunde liegenden Daten nicht relevant geändert haben".
  dedupe_key        TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at      TIMESTAMPTZ,
  UNIQUE (trip_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS trip_hints_family_status_priority_idx ON trip_hints (family_id, status, priority);
CREATE INDEX IF NOT EXISTS trip_hints_trip_idx ON trip_hints (trip_id);

ALTER TABLE trip_hints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON trip_hints;
CREATE POLICY "family_members_only" ON trip_hints
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_hints TO authenticated;

-- §Cron läuft mit Service-Role (app/api/cron/generate-trip-hints), braucht
-- keine eigene Policy -- service_role umgeht RLS grundsätzlich, siehe
-- 20260727000010_service_role_grants.sql für das etablierte Muster.
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_hints TO service_role;
