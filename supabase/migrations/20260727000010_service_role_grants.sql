-- ============================================================
-- Content Studio 3.0, Sprint 2 -- unabhaengiger Befund beim Smoke-Test,
-- NICHT spezifisch fuer diesen Sprint: der service_role-Datenbankrolle
-- fehlen auf JEDER public-Schema-Tabelle (auch bereits lange bestehenden
-- wie content_projects, persons) die noetigen SQL-GRANTs. RLS wird von
-- service_role zwar grundsaetzlich umgangen (BYPASSRLS-Attribut), das
-- ersetzt aber KEIN fehlendes GRANT -- beides sind in Postgres getrennte
-- Mechanismen. 20260712000004_auth_lockdown.sql hat GRANT/ALTER DEFAULT
-- PRIVILEGES bisher ausschliesslich fuer "authenticated" gesetzt, nie fuer
-- "service_role". Ohne diese Migration kann kein serverseitiger
-- Hintergrundprozess ohne Nutzer-Session (z. B. der fuer spaetere Sprints
-- geplante Render-Abschluss-Schritt, lib/supabase/admin.ts) auf die
-- Datenbank zugreifen -- reine Rechte-Vergabe, keine Datenaenderung.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
