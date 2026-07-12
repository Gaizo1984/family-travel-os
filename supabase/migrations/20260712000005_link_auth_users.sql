-- ============================================================
-- Security Foundation 1A: verknüpft die bereits im Supabase-Dashboard
-- angelegten Auth-Konten von Marcel und Sarah mit ihren bestehenden
-- persons-Zeilen. Rein additiv -- UPDATE auf die nullable auth_user_id-
-- Spalte aus 20260712000003, keine RLS-/Grant-Änderung, kein Risiko für
-- den laufenden Betrieb.
-- ============================================================

UPDATE persons SET auth_user_id = 'a697f225-6dfb-465d-8525-8e79a3f742e8'
  WHERE id = '10000000-0000-0000-0000-000000000001'; -- Marcel

UPDATE persons SET auth_user_id = '619425b8-c34b-47f5-a228-05747e5ecca4'
  WHERE id = '10000000-0000-0000-0000-000000000002'; -- Sarah
