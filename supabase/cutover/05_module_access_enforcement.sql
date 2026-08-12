-- =====================================================================
-- Lumi Core -- has_module_access(..., 'travel') in allen travel_*-Policies
-- durchsetzen (Masterprompt "Lumi – Zentraler Login-Umbau", Abschnitt 4).
-- Manuell im Supabase-SQL-Editor des LUMI-CORE-Projekts auszuführen
-- (gleiche Vorgehensweise wie 01-04 in diesem Ordner).
--
-- BEFUND (Phase-A-Analyse): has_module_access() existiert seit der
-- initialen Lumi-Core-Migration, wurde aber in KEINER travel_*-Policy
-- aufgerufen -- bisher prüfte jede Policy ausschließlich
-- is_household_member(household_id). Ein Mitglied mit travel='none' hätte
-- damit weiterhin vollen Datenbankzugriff -- UI-Hiding allein ist keine
-- Security.
--
-- REIHENFOLGE ZWINGEND: MUSS NACH
-- lumi-assistance/supabase/migrations/20260812000001_module_access_seed.sql
-- laufen. has_module_access() hat für 'travel' KEINEN Default-Allow (nur
-- 'assistance' hat einen, siehe initial_schema.sql) -- ohne vorherigen Seed
-- würde diese Migration ALLE travel_*-Zugriffe für ALLE Mitglieder sofort
-- sperren, inklusive Marcel/Sarah.
--
-- Additiv: verändert nur USING/WITH CHECK bestehender Policies, keine
-- Tabelle/Spalte/Zeile wird gelöscht oder umgebaut. Idempotent (DROP POLICY
-- IF EXISTS + CREATE POLICY).
-- =====================================================================

BEGIN;

-- ── A) Tabellen mit direkter household_id-Spalte -----------------------
-- Dynamisch ermittelt statt hartkodiert: JEDE Tabelle im public-Schema,
-- die mit "travel_" beginnt, eine household_id-Spalte besitzt UND aktuell
-- eine Policy namens "household_members_only" hat (etabliertes Muster aus
-- 01-04 in diesem Ordner). Bleibt dadurch auch dann vollständig, wenn
-- künftig weitere travel_*-Tabellen nach demselben Muster entstehen, ohne
-- diese Datei jedes Mal anzupassen -- direkte Antwort auf die Vorgabe
-- "Alle relevanten travel_*-Tabellen prüfen und umstellen, nicht nur
-- einzelne Tabellen".
DO $$
DECLARE
  t TEXT;
  n INT := 0;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_policies p ON p.tablename = c.table_name AND p.schemaname = 'public'
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE 'travel\_%' ESCAPE '\'
      AND c.column_name = 'household_id'
      AND p.policyname = 'household_members_only'
    GROUP BY c.table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "household_members_only" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "household_members_only" ON %I FOR ALL USING (is_household_member(household_id) AND has_module_access(household_id, ''travel'')) WITH CHECK (is_household_member(household_id) AND has_module_access(household_id, ''travel''))',
      t
    );
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'travel_*-Tabellen mit direkter household_id umgestellt: %', n;
END $$;

-- ── B) Tabellen ohne direkte household_id-Spalte (Join-Auflösung) ------
-- Diese vier Tabellen (siehe 03_content_studio_rls_fix.sql) lösen ihre
-- Haushaltszugehörigkeit über eine Referenz auf travel_content_projects/
-- travel_content_ideas/travel_content_drafts auf -- kein generisches
-- Muster automatisierbar, deshalb explizit statt dynamisch.

ALTER TABLE travel_content_project_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_project_photos;
CREATE POLICY "household_members_only" ON travel_content_project_photos
  FOR ALL
  USING (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel')
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel')
  ));

ALTER TABLE travel_content_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_drafts;
CREATE POLICY "household_members_only" ON travel_content_drafts
  FOR ALL
  USING (
    project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
    OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
  )
  WITH CHECK (
    project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
    OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
  );

ALTER TABLE travel_content_reel_media_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_reel_media_items;
CREATE POLICY "household_members_only" ON travel_content_reel_media_items
  FOR ALL
  USING (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel')
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel')
  ));

ALTER TABLE travel_content_reel_renders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_members_only" ON travel_content_reel_renders;
CREATE POLICY "household_members_only" ON travel_content_reel_renders
  FOR ALL
  USING (draft_id IN (
    SELECT id FROM travel_content_drafts WHERE
      project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
      OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
  ))
  WITH CHECK (draft_id IN (
    SELECT id FROM travel_content_drafts WHERE
      project_id IN (SELECT id FROM travel_content_projects WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
      OR idea_id IN (SELECT id FROM travel_content_ideas WHERE is_household_member(household_id) AND has_module_access(household_id, 'travel'))
  ));

-- ── C) Storage: travel-documents-Bucket -- Ebene 3 gilt auch für Dateien. --
-- Pfadkonvention identisch zum Assistance-Bucket: erstes Pfadsegment = household_id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'travel-documents') THEN
    DROP POLICY IF EXISTS "travel_documents_bucket_household_access" ON storage.objects;
    EXECUTE $POLICY$
      CREATE POLICY "travel_documents_bucket_household_access" ON storage.objects
        FOR ALL USING (
          bucket_id = 'travel-documents'
          AND is_household_member((storage.foldername(name))[1]::uuid)
          AND has_module_access((storage.foldername(name))[1]::uuid, 'travel')
        ) WITH CHECK (
          bucket_id = 'travel-documents'
          AND is_household_member((storage.foldername(name))[1]::uuid)
          AND has_module_access((storage.foldername(name))[1]::uuid, 'travel')
        )
    $POLICY$;
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Verifikation (read-only, kein Effekt) -- nach dem Anwenden prüfen.
-- =====================================================================

-- 1) Jede travel_*-Tabelle mit household_id hat jetzt eine Policy, deren
--    Definition has_module_access enthält.
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'travel\_%' ESCAPE '\'
ORDER BY tablename;

-- 2) Stichprobe: Marcel/Sarah müssen weiterhin Zugriff haben (erwartet:
--    access_level 'admin' für beide, module 'travel'). Leeres Ergebnis
--    bedeutet FEHLENDEN Seed -- dann diese Migration NICHT angewendet
--    lassen, sondern zuerst den Seed nachholen.
SELECT hm.name, hmaa.access_level
FROM household_member_app_access hmaa
JOIN household_members hm ON hm.id = hmaa.household_member_id
WHERE hmaa.module = 'travel' AND hm.name IN ('Marcel', 'Sarah');
