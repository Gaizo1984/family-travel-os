-- §"Kontrolliertes LUMI Memory" (Nutzervorgabe): LUMI soll langfristig
-- bestätigte Vorlieben/Erfahrungen kennen, ohne beliebige Chat-Aussagen
-- automatisch als Wahrheit zu speichern. Bewusst KEIN Cache -- niemals in
-- einem Cleanup-Cron, dauerhaft wie persons/past_trips. Bewusst eine eigene
-- Tabelle statt Erweiterung von family_preference_categories: dort ist das
-- Schema ein FESTES 6-Kategorien-Gewichtungssystem, hier braucht es ein
-- offenes Set einzeln bestätigter/abgelehnter Einträge mit Typ, Quelle,
-- optionalem Mitglieds-/Reisebezug und Bestätigungsstatus -- strukturell
-- etwas anderes.
CREATE TABLE IF NOT EXISTS family_memories (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  -- §"zusätzlich family_member_id und trip_id nur innerhalb derselben Familie
  -- zulassen" (Nutzervorgabe): auf DB-Ebene über ON DELETE SET NULL abgesichert;
  -- die eigentliche Familienzugehörigkeits-Prüfung übernehmen die Server
  -- Actions (lib/actions/family-memories.ts), die person_id/trip_id nur
  -- akzeptieren, wenn eine Query mit .eq('family_id', familyId) sie findet.
  person_id         UUID        REFERENCES persons(id) ON DELETE SET NULL,
  trip_id           UUID        REFERENCES trips(id) ON DELETE SET NULL,
  memory_type       TEXT        NOT NULL CHECK (memory_type IN
                        ('confirmed_preference','observed_pattern','trip_specific_preference','family_member_preference','experience')),
  category          TEXT        NOT NULL,
  structured_value  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  summary           TEXT        NOT NULL,
  source            TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined')),
  priority          SMALLINT,
  valid_until       DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_memories_family_status_idx ON family_memories (family_id, status);
CREATE INDEX IF NOT EXISTS family_memories_family_category_idx ON family_memories (family_id, category);

ALTER TABLE family_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON family_memories;
CREATE POLICY "family_members_only" ON family_memories
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON family_memories TO authenticated;
