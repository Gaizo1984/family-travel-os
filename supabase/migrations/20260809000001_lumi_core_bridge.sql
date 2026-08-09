-- Phase 3A (Lumi Family OS Masterprompt): additive Identitäts-Brücke zu
-- "Lumi Core" (separates Supabase-Projekt). Es werden ausschließlich zwei
-- nullable Spalten ergänzt -- keine bestehende Tabelle/Policy/Migration wird
-- verändert, keine Fachdaten (trips/bookings/documents/...) sind betroffen.
--
-- Kein Foreign Key: die referenzierten IDs (profiles.id / households.id)
-- leben in einem ANDEREN Supabase-Projekt (Lumi Core) und können von
-- Postgres hier nicht per FK-Constraint geprüft werden. Die Konsistenz wird
-- stattdessen ausschließlich durch die Server Action hergestellt, die diese
-- Spalten schreibt (siehe lib/actions/lumi-core.ts) -- kein Bulk-/Blind-Import.

ALTER TABLE persons ADD COLUMN lumi_core_profile_id UUID;
CREATE UNIQUE INDEX persons_lumi_core_profile_id_idx
  ON persons(lumi_core_profile_id) WHERE lumi_core_profile_id IS NOT NULL;

ALTER TABLE families ADD COLUMN lumi_core_household_id UUID;
CREATE UNIQUE INDEX families_lumi_core_household_id_idx
  ON families(lumi_core_household_id) WHERE lumi_core_household_id IS NOT NULL;
