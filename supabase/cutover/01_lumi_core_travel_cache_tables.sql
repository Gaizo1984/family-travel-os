-- =====================================================================
-- Lumi Core -- 12 Cache-/Usage-Tabellen fuer den Travel-Fachdaten-Cutover
-- Manuell im Supabase-SQL-Editor des LUMI-CORE-Projekts auszufuehren.
--
-- Diese Tabellen wurden NICHT migriert (siehe Klassifizierung/
-- CACHE_REGENERATION.md) -- sie werden hier LEER neu angelegt, damit die
-- umgestellten Server Actions nach dem Cutover einen Zielort haben, an
-- dem sie sich selbst regenerieren koennen. Keine Daten aus Travel werden
-- kopiert. Household-basierte RLS wie bei allen anderen travel_*-Tabellen.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS travel_flight_search_cache (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  search_key        TEXT        NOT NULL,
  origin_codes      TEXT[]      NOT NULL,
  destination_code  TEXT        NOT NULL,
  departure_date    DATE        NOT NULL,
  return_date       DATE,
  adults            INT         NOT NULL,
  children          INT         NOT NULL DEFAULT 0,
  infants           INT         NOT NULL DEFAULT 0,
  is_sandbox_data   BOOLEAN     NOT NULL DEFAULT true,
  results           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  search_started_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, search_key)
);

CREATE TABLE IF NOT EXISTS travel_flight_search_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month_key     TEXT        NOT NULL,
  search_count  INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, month_key)
);

CREATE TABLE IF NOT EXISTS travel_hotel_search_cache (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  search_key        TEXT        NOT NULL,
  destination       TEXT        NOT NULL,
  is_below_standard BOOLEAN     NOT NULL DEFAULT false,
  results           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, search_key)
);

-- Korrektur ggue. der ersten Fassung: die reale Travel-Tabelle wurde nach
-- ihrer urspruenglichen Anlage per Migration 20260725000001 um `date`
-- erweitert und der Unique-Key von (family_id,trip_id,mode) auf
-- (family_id,trip_id,date) umgestellt ("Tagesplaner 2.0", konkretes Datum
-- statt nur "heute"/"morgen") -- `mode` blieb als informative Spalte
-- bestehen. Erst beim Nachlesen des tatsaechlichen Konsumenten-Codes
-- (lib/actions/day-planner.ts) aufgefallen; unten korrigiert.
CREATE TABLE IF NOT EXISTS travel_day_plan_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  trip_id      UUID        NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  date         DATE,
  mode         TEXT        NOT NULL,
  plan         JSONB       NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, trip_id, date)
);

CREATE TABLE IF NOT EXISTS travel_category_places_cache (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  trip_id       UUID        NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL,
  origin_key    TEXT        NOT NULL,
  origin_label  TEXT        NOT NULL,
  results       JSONB       NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, trip_id, category, origin_key)
);

-- Korrektur ggue. der ersten Fassung: `alternative` (Migration
-- 20260711000018) fehlte -- erst beim Nachlesen des tatsaechlichen
-- Konsumenten-Codes (lib/today-recommendation.ts) aufgefallen.
CREATE TABLE IF NOT EXISTS travel_today_recommendations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  trip_id           UUID        REFERENCES travel_trips(id) ON DELETE CASCADE,
  for_date          DATE        NOT NULL,
  day_style         TEXT,
  highlight_title   TEXT,
  day_summary       TEXT        NOT NULL,
  recommendation    JSONB       NOT NULL,
  alternative       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, trip_id, for_date)
);

CREATE TABLE IF NOT EXISTS travel_trip_hints (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  trip_id           UUID        NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  booking_id        UUID        REFERENCES travel_bookings(id) ON DELETE CASCADE,
  document_id       UUID        REFERENCES travel_documents(id) ON DELETE CASCADE,
  journey_event_id  UUID        REFERENCES travel_journey_events(id) ON DELETE SET NULL,
  hint_type         TEXT        NOT NULL,
  priority          TEXT        NOT NULL CHECK (priority IN ('critical','upcoming','recommendation')),
  title             TEXT        NOT NULL,
  reasoning         TEXT        NOT NULL,
  relevant_at       TIMESTAMPTZ,
  action_label      TEXT        NOT NULL,
  action_href       TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','completed')),
  content_hash      TEXT        NOT NULL,
  dedupe_key        TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at      TIMESTAMPTZ,
  UNIQUE (trip_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS travel_concierge_category_suggestions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  trip_id       UUID        NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL,
  question_text TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  event_title   TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, trip_id, category)
);

CREATE TABLE IF NOT EXISTS travel_trip_idea_comparisons (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  idea_ids          UUID[]      NOT NULL,
  comparison_key    TEXT        NOT NULL,
  scores            JSONB       NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, comparison_key)
);

CREATE TABLE IF NOT EXISTS travel_lumi_brain_usage (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month_key      TEXT        NOT NULL,
  question_count INT         NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, month_key)
);

CREATE TABLE IF NOT EXISTS travel_reel_render_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month_key     TEXT        NOT NULL,
  render_count  INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, month_key)
);

CREATE TABLE IF NOT EXISTS travel_ai_generation_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind           TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message  TEXT,
  redirect_path  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS travel_ai_generation_jobs_household_id_idx ON travel_ai_generation_jobs(household_id);

-- signed_url_cache wird NICHT als eigene Tabelle neu angelegt -- ersetzt
-- durch lib/lumi-core-storage/signed-url.ts (direkte Signierung ohne
-- Cache-Tabelle, siehe dessen README). Kein Cutover-Blocker.

-- ── RLS: household-basiert, identisches Muster wie alle travel_*-Tabellen ──
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'travel_flight_search_cache','travel_flight_search_usage','travel_hotel_search_cache',
    'travel_day_plan_cache','travel_category_places_cache','travel_today_recommendations',
    'travel_trip_hints','travel_concierge_category_suggestions','travel_trip_idea_comparisons',
    'travel_lumi_brain_usage','travel_reel_render_usage','travel_ai_generation_jobs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "household_members_only" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "household_members_only" ON %I FOR ALL USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id))',
      t
    );
  END LOOP;
END $$;

COMMIT;
