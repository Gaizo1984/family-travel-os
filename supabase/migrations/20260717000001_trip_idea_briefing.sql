-- §"Reisebriefing": strukturierte Eckdaten des /plan-Wizards, additiv auf
-- trip_idea_sessions (Input-/Briefing-Ebene, analog zu traveler_ids). Alle
-- Spalten nullable/mit Default -- bestehende Sessions bleiben unverändert
-- nutzbar, Downstream-Code (loadIdeaContext, generateIdeaComparison) fällt
-- kontrolliert auf "keine Angabe" zurück.
ALTER TABLE trip_idea_sessions
  ADD COLUMN travel_date_mode TEXT NOT NULL DEFAULT 'flexible'
    CHECK (travel_date_mode IN ('exact', 'month', 'school_holiday', 'flexible', 'open')),
  ADD COLUMN travel_start_date DATE,
  ADD COLUMN travel_end_date DATE,
  ADD COLUMN travel_period_text TEXT,
  ADD COLUMN nights_min INT,
  ADD COLUMN nights_max INT,
  ADD COLUMN climate_preference TEXT,
  ADD COLUMN trip_type_preference TEXT,
  ADD COLUMN rain_risk_tolerant BOOLEAN,
  ADD COLUMN max_stopovers INT,
  ADD COLUMN stopover_preference TEXT CHECK (stopover_preference IN ('erwuenscht', 'erlaubt', 'ausgeschlossen')),
  ADD COLUMN budget_min NUMERIC,
  ADD COLUMN budget_max NUMERIC,
  ADD COLUMN excluded_destinations TEXT[],
  ADD COLUMN avoid_past_destinations BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN excluded_trip_types TEXT[],
  ADD COLUMN excluded_climates TEXT[];
