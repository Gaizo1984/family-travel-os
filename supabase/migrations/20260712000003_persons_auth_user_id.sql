-- ============================================================
-- Security Foundation 1A, Schritt 1/2: Verknüpfung Supabase-Auth-Nutzer <-> Person.
-- Rein additiv (nullable Spalte) -- keine RLS-/Grant-Änderung in dieser
-- Migration, damit sie gefahrlos vor dem eigentlichen Auth-Lockdown
-- angewendet werden kann (siehe Security-Foundation-Rollout-Plan).
--
-- ON DELETE SET NULL: die persons-Zeile ist das dauerhafte Familienprofil
-- und darf beim Löschen/Neuanlegen eines Auth-Kontos nicht mitgelöscht
-- werden -- nur die Verknüpfung selbst fällt dann weg.
-- ============================================================

ALTER TABLE persons
  ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
