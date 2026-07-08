-- Migration: DEV-ONLY — Schreibrechte auch für die 'anon'-Rolle.
--
-- Warum nötig: Die App hat noch kein Auth-System. Alle Supabase-Anfragen aus
-- lib/supabase/server.ts laufen daher unauthentifiziert als Postgres-Rolle
-- 'anon', nicht als 'authenticated'. Migration 20260708000002 hat
-- INSERT/UPDATE/DELETE aber nur an 'authenticated' vergeben — dadurch
-- scheiterte jedes Schreiben (Reise anlegen, bearbeiten, archivieren, Etappen
-- verwalten) am Postgres-GRANT, unabhängig von den bereits offenen
-- RLS-Policies aus 20260708000003. Bestätigt durch einen echten Testlauf:
-- "permission denied for table trips" beim Anlegen einer Reise über /plan.
--
-- Auswirkung: rein additiv, keine Datenänderung, gleiche DEV-ONLY-Einordnung
-- wie die bestehenden Grants — Phase 7 ersetzt dies durch echte
-- Auth-gebundene Rechte und entzieht 'anon' wieder die Schreibrechte.

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
