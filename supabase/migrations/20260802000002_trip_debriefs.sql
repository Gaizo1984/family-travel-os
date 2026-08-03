-- §"Nachreise-Dialog" (Nutzervorgabe): 1-3 Tage nach Reiseende einmaliger,
-- schrittweiser Rückblick -- muss geräte-/sitzungsübergreifend fortsetzbar
-- sein, deshalb serverseitig persistierter Fortschritt statt reinem
-- Client-State (wie TripBriefingWizard.tsx es für den Vorab-Wizard nutzt).
CREATE TABLE IF NOT EXISTS trip_debriefs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','skipped','closed')),
  current_step  TEXT,
  answers       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §"Pro Reise nur ein aktiver Nachreise-Dialog" (Nutzervorgabe, wörtlich):
-- partieller Unique-Index statt Anwendungslogik allein -- erzwingt die
-- Regel auch gegen den Cron-Trigger (ON CONFLICT DO NOTHING beim Anlegen),
-- ohne abgeschlossene/übersprungene/geschlossene Altdialoge zu blockieren.
CREATE UNIQUE INDEX IF NOT EXISTS trip_debriefs_one_active_per_trip
  ON trip_debriefs (trip_id) WHERE status = 'active';

ALTER TABLE trip_debriefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON trip_debriefs;
CREATE POLICY "family_members_only" ON trip_debriefs
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_debriefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_debriefs TO service_role;
