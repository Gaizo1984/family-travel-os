-- ============================================================
-- Security Foundation 1A, Schritt 2/2: Auth-Lockdown.
-- Ersetzt alle offenen DEV-Policies (USING (true)) durch
-- auth.uid()-gebundene Policies und entzieht der 'anon'-Rolle jeden
-- Zugriff (bestehend UND zukünftig). ERST anwenden, nachdem der Login in
-- Produktion bestätigt funktioniert (siehe Rollout-Plan) -- ab hier ist
-- ohne gültige Supabase-Session kein Datenzugriff mehr möglich.
-- ============================================================

BEGIN;

-- Tabellen-Policies: pro Tabelle die bestehenden dev_select/dev_write
-- Policies entfernen und durch eine einzige, auth.uid()-geprüfte Policy
-- ersetzen (Liste aus grep "CREATE POLICY" über alle Migrationen ermittelt).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'families', 'persons', 'trips', 'trip_members', 'stages', 'trip_days',
    'bookings', 'budget_items', 'documents', 'packing_items', 'tasks',
    'journal_entries', 'document_trips', 'insurance_policies',
    'insurance_policy_persons', 'insurance_policy_trips', 'journey_events',
    'trip_exchange_rates', 'family_preference_categories', 'past_trips',
    'past_trip_travelers', 'content_projects', 'content_ideas',
    'content_drafts', 'trip_idea_sessions', 'trip_ideas',
    'today_recommendations', 'content_strategies', 'concierge_messages',
    'content_project_photos', 'memory_photos', 'content_photo_analyses'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "dev_select" ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "dev_write" ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "authenticated_only" ON %I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);',
      t
    );
  END LOOP;
END $$;

-- Grants: anon verliert jeden Zugriff auf bestehende Tabellen, authenticated
-- behält vollen Zugriff (inkl. aller Tabellen, die nach der initialen
-- Migration einzeln ergänzt wurden).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Zukünftige Tabellen: authenticated bekommt automatisch Zugriff (schließt
-- die bisherige Lücke, dass jede neue Migration das Grant manuell nachtragen
-- musste), anon ausdrücklich keinen -- entspricht zwar ohnehin Postgres'
-- Standardverhalten für neu angelegte Tabellen, macht die Absicht aber
-- explizit statt sich auf ein stillschweigendes Default zu verlassen.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Storage: gleiche Umstellung für den 'documents'-Bucket.
DROP POLICY IF EXISTS "dev_documents_all" ON storage.objects;
CREATE POLICY "authenticated_documents" ON storage.objects FOR ALL
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

COMMIT;

-- ============================================================
-- Verifikation (read-only, kein Effekt) -- nach dem Anwenden manuell gegen
-- die erwarteten Ergebnisse unten prüfen.
-- ============================================================

-- 1) anon darf auf keiner Tabelle mehr irgendetwas -- erwartet: 0 Zeilen.
SELECT table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon' AND table_schema = 'public';

-- 2) Keine alten dev_select-/dev_write-Policies mehr vorhanden -- erwartet: 0 Zeilen.
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND policyname IN ('dev_select', 'dev_write');

-- 3) Jede der 32 App-Tabellen hat genau eine Policy ("authenticated_only")
--    -- erwartet: 32 Zeilen, policy_count = 1 je Tabelle.
SELECT tablename, count(*) AS policy_count, array_agg(policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'families', 'persons', 'trips', 'trip_members', 'stages', 'trip_days',
    'bookings', 'budget_items', 'documents', 'packing_items', 'tasks',
    'journal_entries', 'document_trips', 'insurance_policies',
    'insurance_policy_persons', 'insurance_policy_trips', 'journey_events',
    'trip_exchange_rates', 'family_preference_categories', 'past_trips',
    'past_trip_travelers', 'content_projects', 'content_ideas',
    'content_drafts', 'trip_idea_sessions', 'trip_ideas',
    'today_recommendations', 'content_strategies', 'concierge_messages',
    'content_project_photos', 'memory_photos', 'content_photo_analyses'
  )
GROUP BY tablename
ORDER BY tablename;

-- 4) Storage-Bucket 'documents' hat nur noch die neue Policy -- erwartet:
--    genau 1 Zeile, "authenticated_documents".
SELECT policyname
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
