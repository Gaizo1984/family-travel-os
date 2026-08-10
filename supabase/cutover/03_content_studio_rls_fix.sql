-- =====================================================================
-- Lumi Core -- RLS-Fix fuer die Content-Studio-Tabellenfamilie
-- (Bild-Check / Story / Beitrag / Reel). Manuell im Supabase-SQL-Editor
-- des LUMI-CORE-Projekts auszufuehren (gleiche Vorgehensweise wie bei
-- allen bisherigen Migrationen dieses Cutovers).
--
-- ROOT CAUSE: travel_content_projects, travel_content_ideas,
-- travel_content_photo_analyses, travel_content_strategies,
-- travel_content_project_photos, travel_content_drafts,
-- travel_content_reel_media_items und travel_content_reel_renders waren
-- Teil des urspruenglichen 38-Tabellen-Copies aus dem alten Travel-Supabase
-- (siehe 02_lumi_core_schema_gap_closure.sql, Abschnitte 3+4: "Bereits
-- vorhandene Tabelle ... Teil des urspruenglichen 38-Tabellen-Copies").
-- Beim Copy wurden Spalten (family_id -> household_id) und Daten
-- uebernommen, die RLS-Policies dieser Tabellen jedoch NICHT neu geschrieben
-- -- sie verweisen dadurch noch auf Travels EIGENE, in Lumi Core nicht
-- existierende Auth-Struktur (persons.auth_user_id), z. B.:
--   USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
-- (siehe Travel-Migrationen 20260727000007_content_studio_rls_hardening.sql
-- und 20260727000009_content_studio_reel_data_model.sql). Jeder INSERT/
-- SELECT gegen diese Tabellen scheitert dadurch in Lumi Core an der
-- RLS-Pruefung (Tabelle/Spalte "persons"/"family_id" existiert dort so
-- nicht) -- das ist die Ursache fuer "Keines der Fotos konnte gespeichert
-- werden" in Bild-Check/Story/Beitrag/Reel. Der normale Travel-Fotoupload
-- (travel_memory_photos) ist eine ANDERE Tabelle mit bereits korrekter
-- household_id/is_household_member()-Policy und daher nicht betroffen.
--
-- Reine RLS-Korrektur: keine Tabelle/Spalte/Zeile wird veraendert, geloescht
-- oder verschoben. Ersetzt nur die Policy durch das etablierte
-- is_household_member(household_id)-Muster, das alle anderen travel_*-
-- Tabellen in Lumi Core bereits nutzen.
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE POLICY).
-- =====================================================================

BEGIN;

-- ── A) Tabellen mit direkter household_id-Spalte ──
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'travel_content_projects', 'travel_content_ideas',
    'travel_content_photo_analyses', 'travel_content_strategies',
    'travel_memory_videos'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "family_members_only" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_only" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "dev_select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "dev_write" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "household_members_only" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "household_members_only" ON %I FOR ALL USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id))',
      t
    );
  END LOOP;
END $$;

-- ── B) travel_content_project_photos: kein eigenes household_id, aber
-- project_id ist NOT NULL REFERENCES travel_content_projects(id) --
-- Household darueber zuverlaessig auflösbar (identisches Muster wie die
-- urspruengliche Travel-Policy, nur mit is_household_member()).
ALTER TABLE travel_content_project_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON travel_content_project_photos;
DROP POLICY IF EXISTS "authenticated_only" ON travel_content_project_photos;
DROP POLICY IF EXISTS "dev_select" ON travel_content_project_photos;
DROP POLICY IF EXISTS "dev_write" ON travel_content_project_photos;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_project_photos;
CREATE POLICY "household_members_only" ON travel_content_project_photos
  FOR ALL
  USING (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id)
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id)
  ));

-- ── C) travel_content_drafts: kein eigenes household_id; project_id UND
-- idea_id sind BEIDE nullable -- Household ueber project_id ODER idea_id
-- aufloesbar (gleiches Muster wie die urspruengliche Travel-Policy).
ALTER TABLE travel_content_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON travel_content_drafts;
DROP POLICY IF EXISTS "authenticated_only" ON travel_content_drafts;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_drafts;
CREATE POLICY "household_members_only" ON travel_content_drafts
  FOR ALL
  USING (
    project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id))
    OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id))
  )
  WITH CHECK (
    project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id))
    OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id))
  );

-- ── D) travel_content_reel_media_items: kein eigenes household_id, aber
-- project_id ist NOT NULL REFERENCES travel_content_projects(id).
ALTER TABLE travel_content_reel_media_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON travel_content_reel_media_items;
DROP POLICY IF EXISTS "authenticated_only" ON travel_content_reel_media_items;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_reel_media_items;
CREATE POLICY "household_members_only" ON travel_content_reel_media_items
  FOR ALL
  USING (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id)
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id)
  ));

-- ── E) travel_content_reel_renders: kein eigenes household_id, aber
-- draft_id ist NOT NULL REFERENCES travel_content_drafts(id) ->
-- travel_content_drafts.project_id -> travel_content_projects.household_id.
ALTER TABLE travel_content_reel_renders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "family_members_only" ON travel_content_reel_renders;
DROP POLICY IF EXISTS "authenticated_only" ON travel_content_reel_renders;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_reel_renders;
CREATE POLICY "household_members_only" ON travel_content_reel_renders
  FOR ALL
  USING (draft_id IN (
    SELECT id FROM travel_content_drafts WHERE
      project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id))
      OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id))
  ))
  WITH CHECK (draft_id IN (
    SELECT id FROM travel_content_drafts WHERE
      project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id))
      OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id))
  ));

COMMIT;

-- =====================================================================
-- Verifikation (read-only, kein Effekt) -- nach dem Anwenden pruefen.
-- =====================================================================

-- 1) Jede der 8 Tabellen hat jetzt genau eine Policy "household_members_only".
SELECT tablename, count(*) AS policy_count, array_agg(policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'travel_content_projects', 'travel_content_ideas', 'travel_content_photo_analyses',
    'travel_content_strategies', 'travel_memory_videos', 'travel_content_project_photos',
    'travel_content_drafts', 'travel_content_reel_media_items', 'travel_content_reel_renders'
  )
GROUP BY tablename
ORDER BY tablename;

-- 2) Keine der 9 Tabellen hat noch eine Travel-Legacy-Policy uebrig --
--    erwartet: 0 Zeilen.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'travel_content_projects', 'travel_content_ideas', 'travel_content_photo_analyses',
    'travel_content_strategies', 'travel_memory_videos', 'travel_content_project_photos',
    'travel_content_drafts', 'travel_content_reel_media_items', 'travel_content_reel_renders'
  )
  AND policyname IN ('family_members_only', 'authenticated_only', 'dev_select', 'dev_write');
