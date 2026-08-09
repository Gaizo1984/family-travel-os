-- =====================================================================
-- Lumi Core -- Schliessung der verbliebenen echten Schema-Luecken aus dem
-- Travel-Cutover. Manuell im Supabase-SQL-Editor des LUMI-CORE-Projekts
-- auszufuehren (gleiche Vorgehensweise wie bei allen bisherigen
-- Migrationen dieses Cutovers).
--
-- Enthaelt AUSSCHLIESSLICH additive Aenderungen (neue Tabelle, neue
-- Spalten) -- keine bestehende Lumi-Core-Tabelle/-Spalte wird veraendert
-- oder geloescht, kein Travel-Supabase wird angefasst.
--
-- "Bestehendes Core-Konzept bevorzugen" (Nutzervorgabe): Die Familien-
-- Content-Stil-Praeferenz und die Hotelkriterien brauchen KEINE neue
-- Tabelle/Spalte -- beide nutzen den bereits existierenden, App-uebergreifenden
-- Einstellungs-Container `app_preferences.settings` (JSONB, ein Eintrag pro
-- Household, siehe initial_schema.sql). Dafuer ist in diesem Skript nichts
-- zu tun.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =====================================================================

BEGIN;

-- ── 1. Persons-Profilfelder ohne Lumi-Core-Aequivalent ─────────────────
-- role_label/description/interest_tags/travel_needs sind Travel-spezifische
-- Konzepte (kein anderer App nutzt sie) -- bewusst als eigene, schlanke
-- Travel-Zusatztabelle statt Aufblaehung der App-uebergreifenden
-- household_members-Tabelle (gleiche Trennung wie bei allen anderen
-- travel_*-Tabellen).
CREATE TABLE IF NOT EXISTS travel_household_member_profiles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  household_member_id   UUID        NOT NULL UNIQUE REFERENCES household_members(id) ON DELETE CASCADE,
  role_label            TEXT,
  description           TEXT,
  interest_tags         TEXT[]      NOT NULL DEFAULT '{}',
  travel_needs          TEXT[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE travel_household_member_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_members_only" ON travel_household_member_profiles;
CREATE POLICY "household_members_only" ON travel_household_member_profiles
  FOR ALL USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));

-- ── 2. "Zuletzt verwendete Reise" (Frag-LUMI-Standardauswahl) ──────────
-- Bisher families.last_lumi_trip_id (Travel), zeigte auf Travels eigene
-- trips.id. Jetzt echte, native FK auf travel_trips(id) -- beide Tabellen
-- leben ab jetzt im selben Projekt, keine Cross-Projekt-Krücke mehr noetig.
ALTER TABLE households ADD COLUMN IF NOT EXISTS last_lumi_trip_id UUID REFERENCES travel_trips(id) ON DELETE SET NULL;

-- ── 3. content_reel_renders: fehlende Remotion-Lambda-Spalten ──────────
-- Bereits vorhandene Tabelle travel_content_reel_renders (Teil des
-- urspruenglichen 38-Tabellen-Copies) -- diese 5 Spalten fehlten dort seit
-- Beginn, da sie erst nach Fertigstellung des Remotion-Lambda-Renderpfads
-- in Travels eigenem Schema ergaenzt wurden.
ALTER TABLE travel_content_reel_renders ADD COLUMN IF NOT EXISTS aws_bucket_name TEXT;
ALTER TABLE travel_content_reel_renders ADD COLUMN IF NOT EXISTS aws_function_name TEXT;
ALTER TABLE travel_content_reel_renders ADD COLUMN IF NOT EXISTS cost_estimate_usd NUMERIC;
ALTER TABLE travel_content_reel_renders ADD COLUMN IF NOT EXISTS output_size_bytes BIGINT;
ALTER TABLE travel_content_reel_renders ADD COLUMN IF NOT EXISTS render_duration_seconds NUMERIC;

-- ── 4. memory_videos: fehlende Temporaer-Speicher-Spalten ──────────────
-- Bereits vorhandene Tabelle travel_memory_videos -- diese 3 Spalten wurden
-- in Travels eigenem Schema erst per Migration 20260727000012 ergaenzt,
-- NACH dem urspruenglichen 38-Tabellen-Copy-Lauf.
ALTER TABLE travel_memory_videos ADD COLUMN IF NOT EXISTS temporary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE travel_memory_videos ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE travel_memory_videos ADD COLUMN IF NOT EXISTS retained_as_memory BOOLEAN NOT NULL DEFAULT false;

-- ── 5. Storage: travel-documents-Bucket fuer Reel-Render-Ausgaben nutzen ──
-- "Bestehendes Core-Konzept bevorzugen": statt eines neuen dritten Buckets
-- wird der bereits existierende travel-documents-Bucket (household-basierte
-- RLS bereits vorhanden) auch fuer die MP4-Render-Ausgaben genutzt (eigener
-- Pfad-Präfix "reels/" im Anwendungscode, siehe lib/actions/reel-render.ts).
-- Finalrender-MP4s koennen einige hundert MB gross sein -- Limit wird HIER
-- nur ANGEHOBEN, nie abgesenkt (NULL = kein Limit; falls der Bucket aktuell
-- ohnehin schon groesser/kein Limit hat, aendert dieser Befehl nichts).
UPDATE storage.buckets
SET file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 524288000) -- 500 MB
WHERE id = 'travel-documents';

COMMIT;
