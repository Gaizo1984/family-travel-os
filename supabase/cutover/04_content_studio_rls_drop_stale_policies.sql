-- =====================================================================
-- Lumi Core -- Nachbesserung zu 03_content_studio_rls_fix.sql.
-- Manuell im Supabase-SQL-Editor des LUMI-CORE-Projekts auszufuehren.
--
-- BEFUND nach Ausfuehrung von 03: jede der 9 Content-Studio-Tabellen hatte
-- ZWEI Policies -- die neue "household_members_only" (korrekt) UND eine
-- uebrig gebliebene Legacy-Policy "travel_content_<tabelle>_all" bzw.
-- "travel_memory_videos_all", die beim urspruenglichen 38-Tabellen-Copy
-- unter diesem Namen angelegt wurde (nicht "family_members_only", wie in
-- 03 angenommen -- daher griff das dortige DROP POLICY IF EXISTS nicht).
--
-- Postgres kombiniert mehrere permissive "FOR ALL"-Policies zwar mit OR,
-- aber wenn die ALTE Policy beim Auswerten einen SQL-Fehler wirft (sie
-- referenziert vermutlich weiterhin Travels eigene persons/family_id-
-- Struktur, die es in Lumi Core so nicht gibt), scheitert die GESAMTE
-- Abfrage -- unabhaengig davon, dass die neue Policy korrekt waere. Das
-- erklaert, warum der Fehler nach 03 identisch blieb.
--
-- Reine RLS-Korrektur: entfernt nur die ueberzaehlige Legacy-Policy, laesst
-- "household_members_only" unberuehrt. Keine Tabelle/Spalte/Zeile wird
-- veraendert. Idempotent (DROP POLICY IF EXISTS).
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "travel_content_projects_all"          ON travel_content_projects;
DROP POLICY IF EXISTS "travel_content_ideas_all"              ON travel_content_ideas;
DROP POLICY IF EXISTS "travel_content_photo_analyses_all"     ON travel_content_photo_analyses;
DROP POLICY IF EXISTS "travel_content_strategies_all"         ON travel_content_strategies;
DROP POLICY IF EXISTS "travel_memory_videos_all"              ON travel_memory_videos;
DROP POLICY IF EXISTS "travel_content_project_photos_all"     ON travel_content_project_photos;
DROP POLICY IF EXISTS "travel_content_drafts_all"             ON travel_content_drafts;
DROP POLICY IF EXISTS "travel_content_reel_media_items_all"   ON travel_content_reel_media_items;
DROP POLICY IF EXISTS "travel_content_reel_renders_all"       ON travel_content_reel_renders;

COMMIT;

-- =====================================================================
-- Verifikation (read-only) -- erwartet: 9 Zeilen, policy_count = 1,
-- policies = {household_members_only}.
-- =====================================================================
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
