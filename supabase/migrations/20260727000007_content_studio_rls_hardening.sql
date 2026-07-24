-- ============================================================
-- Sprint 0a (Content Studio 3.0 Vorbereitung): RLS-Härtung für die
-- bestehenden Content-Studio-Tabellen. Diese liefen seit
-- 20260712000004_auth_lockdown.sql unter der pauschalen Policy
-- "authenticated_only" (USING (auth.uid() IS NOT NULL)) -- jede
-- eingeloggte Person, unabhängig von der eigenen family_id, konnte lesen
-- UND schreiben. Ersetzt das exakte, bereits einmal bewährte Muster von
-- 20260716000003_memory_photos_gallery.sql ("family_members_only" über
-- persons.auth_user_id) -- kein neues Muster, nur konsequent auf die
-- verbliebenen Content-Studio-Tabellen angewendet.
--
-- Reine RLS-Änderung: keine Tabelle, Spalte oder Zeile wird verändert,
-- gelöscht oder verschoben. Rückwärtskompatibel im Sinne von "kein
-- Datenverlust" -- siehe Audit-Bericht (separat mitgeliefert) für die
-- beiden geprüften Risiken (family_id-NULL, content_drafts ohne
-- project_id/idea_id).
-- ============================================================

BEGIN;

-- ── A) Tabellen mit direkter, NOT NULL family_id-Spalte ──
-- content_projects.family_id, content_ideas.family_id,
-- content_photo_analyses.family_id, content_strategies.family_id sind alle
-- `NOT NULL REFERENCES families(id)` seit ihrer jeweiligen Ursprungsmigration
-- (20260711000013 / 20260711000016 / 20260712000001) -- kein NULL-Fall
-- möglich, einfache direkte Policy ausreichend.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_projects', 'content_ideas', 'content_photo_analyses', 'content_strategies'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_only" ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "family_members_only" ON %I FOR ALL '
      || 'USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())) '
      || 'WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));',
      t
    );
  END LOOP;
END $$;

-- ── B) content_project_photos: kein eigenes family_id, aber project_id ist
-- NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE seit
-- 20260711000019 -- Familie zuverlässig über content_projects auflösbar.
DROP POLICY IF EXISTS "authenticated_only" ON content_project_photos;
CREATE POLICY "family_members_only" ON content_project_photos
  FOR ALL
  USING (project_id IN (
    SELECT id FROM content_projects
    WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM content_projects
    WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
  ));

-- ── C) content_drafts: kein eigenes family_id; project_id UND idea_id sind
-- BEIDE nullable (ON DELETE SET NULL) -- Familie wird über project_id ODER
-- ersatzweise idea_id→content_ideas.family_id aufgelöst. Ein Entwurf, bei
-- dem BEIDE Referenzen bereits vor dieser Migration auf NULL gefallen sind
-- (z. B. weil das zugehörige Projekt zwischenzeitlich gelöscht wurde), war
-- schon vorher über keine App-Seite erreichbar (jede content_drafts-Abfrage
-- im Code filtert nach project_id oder lädt per bekannter draftId von einer
-- solchen Seite aus) -- wird durch diese Policy nicht neu unzugänglich
-- gemacht, sondern war bereits verwaist. Siehe Audit-Bericht für die
-- Zählung solcher Zeilen vor dem Anwenden.
DROP POLICY IF EXISTS "authenticated_only" ON content_drafts;
CREATE POLICY "family_members_only" ON content_drafts
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM content_projects
      WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
    OR idea_id IN (
      SELECT id FROM content_ideas
      WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM content_projects
      WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
    OR idea_id IN (
      SELECT id FROM content_ideas
      WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
  );

COMMIT;

-- ============================================================
-- Verifikation (read-only, kein Effekt) -- nach dem Anwenden manuell
-- ausführen und gegen die erwarteten Ergebnisse unten prüfen.
-- ============================================================

-- 1) Keine der 6 Tabellen hat noch "authenticated_only" -- erwartet: 0 Zeilen.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'content_projects', 'content_ideas', 'content_drafts',
    'content_project_photos', 'content_photo_analyses', 'content_strategies'
  )
  AND policyname = 'authenticated_only';

-- 2) Jede der 6 Tabellen hat genau eine Policy "family_members_only" --
--    erwartet: 6 Zeilen, policy_count = 1 je Tabelle.
SELECT tablename, count(*) AS policy_count, array_agg(policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'content_projects', 'content_ideas', 'content_drafts',
    'content_project_photos', 'content_photo_analyses', 'content_strategies'
  )
GROUP BY tablename
ORDER BY tablename;

-- 3) Zeilenzahlen je Tabelle VOR und NACH dem Anwenden vergleichen (als
--    eingeloggter Nutzer ausführen) -- erwartet: identische Zahlen, da alle
--    Zeilen zur einzigen Familie dieser Installation gehören.
SELECT 'content_projects' AS tabelle, count(*) FROM content_projects
UNION ALL SELECT 'content_ideas', count(*) FROM content_ideas
UNION ALL SELECT 'content_drafts', count(*) FROM content_drafts
UNION ALL SELECT 'content_project_photos', count(*) FROM content_project_photos
UNION ALL SELECT 'content_photo_analyses', count(*) FROM content_photo_analyses
UNION ALL SELECT 'content_strategies', count(*) FROM content_strategies;
