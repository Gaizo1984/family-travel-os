-- Migration: Gmail-OAuth-Verbindung für das Reise-Postfach.
-- Manuell im Supabase-SQL-Editor des LUMI-CORE-Projekts auszuführen
-- (gleiche Vorgehensweise wie 01-06 in diesem Ordner).
--
-- Bewusst KEINE RLS-Policy für household-Mitglieder -- exakt dasselbe
-- Muster wie lumi-assistance/supabase/migrations/20260817000002_
-- google_calendar_sync.sql::google_calendar_connections: refresh_token ist
-- ein Secret mit vollem Postfachzugriff, wird ausschließlich über den
-- Lumi-Core-Service-Role-Client (lib/supabase/lumi-core-service.ts, aus
-- Server Actions/Callback-Route/Cron/Webhook) gelesen/geschrieben. RLS
-- ENABLE ohne jede Policy blockiert anon/authenticated vollständig,
-- Service-Role umgeht RLS ohnehin.
--
-- household_id UNIQUE: dieselbe Semantik wie google_calendar_connections --
-- ein Haushalt hat höchstens eine aktive Gmail-Verbindung für das
-- Reise-Postfach.
--
-- Additiv, keine bestehende Tabelle/Policy wird verändert.

BEGIN;

CREATE TABLE IF NOT EXISTS travel_gmail_connections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL UNIQUE REFERENCES households(id) ON DELETE CASCADE,
  gmail_account_email   TEXT        NOT NULL,
  refresh_token         TEXT        NOT NULL,
  connected_by          UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE travel_gmail_connections ENABLE ROW LEVEL SECURITY;
-- Bewusst keine Policy -- siehe Kommentar oben (Service-Role-only).

COMMIT;
