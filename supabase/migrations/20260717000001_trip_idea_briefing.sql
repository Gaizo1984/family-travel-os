-- §"Reisebriefing": strukturierte Eckdaten des /plan-Wizards, additiv auf
-- trip_idea_sessions (Input-/Briefing-Ebene, analog zu traveler_ids). Alle
-- Spalten nullable/mit Default -- bestehende Sessions bleiben unverändert
-- nutzbar, Downstream-Code (loadIdeaContext, generateIdeaComparison) fällt
-- kontrolliert auf "keine Angabe" zurück.
--
-- §"Idempotent/wiederholbar": IF NOT EXISTS je Spalte, damit ein erneutes
-- Ausführen (z. B. nach einem bereits erfolgreichen ersten Lauf) nicht mit
-- "column already exists" abbricht -- bestehende Spalten werden dabei nie
-- verändert oder neu definiert, nur fehlende ergänzt.
ALTER TABLE trip_idea_sessions
  ADD COLUMN IF NOT EXISTS travel_date_mode TEXT NOT NULL DEFAULT 'flexible'
    CHECK (travel_date_mode IN ('exact', 'month', 'school_holiday', 'flexible', 'open')),
  ADD COLUMN IF NOT EXISTS travel_start_date DATE,
  ADD COLUMN IF NOT EXISTS travel_end_date DATE,
  ADD COLUMN IF NOT EXISTS travel_period_text TEXT,
  ADD COLUMN IF NOT EXISTS nights_min INT,
  ADD COLUMN IF NOT EXISTS nights_max INT,
  ADD COLUMN IF NOT EXISTS climate_preference TEXT,
  ADD COLUMN IF NOT EXISTS trip_type_preference TEXT,
  ADD COLUMN IF NOT EXISTS rain_risk_tolerant BOOLEAN,
  ADD COLUMN IF NOT EXISTS max_stopovers INT,
  ADD COLUMN IF NOT EXISTS stopover_preference TEXT CHECK (stopover_preference IN ('erwuenscht', 'erlaubt', 'ausgeschlossen')),
  ADD COLUMN IF NOT EXISTS budget_min NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_max NUMERIC,
  ADD COLUMN IF NOT EXISTS excluded_destinations TEXT[],
  ADD COLUMN IF NOT EXISTS avoid_past_destinations BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS excluded_trip_types TEXT[],
  ADD COLUMN IF NOT EXISTS excluded_climates TEXT[];
