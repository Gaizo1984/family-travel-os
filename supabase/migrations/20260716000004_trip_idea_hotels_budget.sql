-- §"Reiseideen 2.0 (kleinster Einstieg)": Hotel-Shortlist (echte Google-
-- Places-Kandidaten, KI wählt/bewertet nur) und Budget-Schätzung als
-- additive Erweiterung bestehender Reiseideen -- keine bestehende Spalte
-- wird angefasst, alle neuen Spalten sind nullable.
ALTER TABLE trip_idea_sessions ADD COLUMN traveler_ids UUID[];

ALTER TABLE trip_ideas
  ADD COLUMN hotel_shortlist JSONB,
  ADD COLUMN hotel_shortlist_updated_at TIMESTAMPTZ,
  ADD COLUMN budget_breakdown JSONB,
  ADD COLUMN budget_breakdown_updated_at TIMESTAMPTZ;

-- §"Migration familienbezogen per RLS absichern": trip_ideas/trip_idea_sessions
-- haben seit dem Auth-Lockdown (20260712000004_auth_lockdown.sql) nur die
-- generische "authenticated_only"-Policy (jede eingeloggte Person sieht/
-- schreibt JEDE Familie) -- gleiche Nachschärfung wie zuvor bei memory_photos
-- (20260716000003_memory_photos_gallery.sql).
DROP POLICY IF EXISTS "authenticated_only" ON trip_idea_sessions;
CREATE POLICY "family_members_only" ON trip_idea_sessions FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "authenticated_only" ON trip_ideas;
CREATE POLICY "family_members_only" ON trip_ideas FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
