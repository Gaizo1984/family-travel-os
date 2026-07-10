-- ============================================================
-- Phase 7: Person-Profil-Erweiterung, Familien-Reisekompass +
-- außergewöhnliche-Hotels-Kriterien, Reisegeschichte (past trips),
-- Content Studio (Projekte/Ideen/Drafts), Trip-Idee-Flow.
-- Rein additiv — keine bestehende Spalte/Tabelle wird verändert.
-- ============================================================

-- ── A) persons: Profil-Erweiterung ──────────────────────────
ALTER TABLE persons ADD COLUMN photo_storage_path TEXT;
ALTER TABLE persons ADD COLUMN description        TEXT;
ALTER TABLE persons ADD COLUMN role_label         TEXT;
ALTER TABLE persons ADD COLUMN interest_tags      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE persons ADD COLUMN travel_needs       TEXT[] NOT NULL DEFAULT '{}';
-- travel_needs: App-Level-Vokabular (kurze Transfers, Pausen, Abenteuer,
-- Essen, Natur, Sport) in lib/family-dna.ts, KEIN DB-Enum — analog zu
-- documents.doc_type / budget_items.category (frei, aber app-seitig validiert).

-- ── B) families: Reisestil + Hotel-Kriterien ────────────────
ALTER TABLE families ADD COLUMN content_style_preference JSONB;
-- Form: { tone: string[], voice_description: string,
--         hashtag_style: 'minimal'|'discovery'|'niche',
--         default_visibility: 'private'|'family'|'public', avoid: string[] }
ALTER TABLE families ADD COLUMN exceptional_hotel_criteria TEXT[] NOT NULL DEFAULT '{}';
-- Fester Katalog (App-Level-Konstante): lage, architektur_design, service,
-- privatsphaere, naturintegration, pool_strand, grosszuegige_zimmer, charakter_statt_kette

-- ── C) stages: strukturiertes Länderkürzel fürs World-Map-Feature ──
ALTER TABLE stages ADD COLUMN country_code TEXT;
-- ISO 3166-1 alpha-2, deterministischer Vorschlag via lib/geo-suggestions.ts
-- (Erweiterung von lib/currency-suggestions.ts), immer nutzereditierbar.

-- ── D) Reisekompass: gewichtete Präferenzkategorien pro Familie ──
CREATE TABLE family_preference_categories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  category_key TEXT        NOT NULL,
  weight       SMALLINT    NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, category_key)
);

-- ── E) Reisegeschichte: manuell erfasste Trips vor der App ──
CREATE TABLE past_trips (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id          UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  country_or_region  TEXT        NOT NULL,
  country_code       TEXT,
  year               SMALLINT    NOT NULL,
  places             TEXT,
  duration_days      INT,
  photo_storage_path TEXT,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE past_trip_travelers (
  past_trip_id UUID NOT NULL REFERENCES past_trips(id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES persons(id)    ON DELETE CASCADE,
  PRIMARY KEY (past_trip_id, person_id)
);

-- ── F) Content Studio: Projekte / Ideen / Drafts ────────────
CREATE TABLE content_projects (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id    UUID        REFERENCES trips(id) ON DELETE SET NULL,
  title      TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_ideas (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                 UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  project_id                UUID        REFERENCES content_projects(id) ON DELETE SET NULL,
  trip_id                   UUID        REFERENCES trips(id) ON DELETE SET NULL,
  source_input_text         TEXT,
  source_media_storage_path TEXT,
  content_goal              TEXT,
  suggestions               JSONB       NOT NULL,
  chosen_index              SMALLINT,
  status                    TEXT        NOT NULL DEFAULT 'suggested',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_drafts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id      UUID        REFERENCES content_ideas(id) ON DELETE SET NULL,
  project_id   UUID        REFERENCES content_projects(id) ON DELETE CASCADE,
  draft_type   TEXT        NOT NULL,
  structure    JSONB       NOT NULL,
  visibility   TEXT        NOT NULL DEFAULT 'private',
  scheduled_at TIMESTAMPTZ,
  posted_at    TIMESTAMPTZ,
  storage_path TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── G) Trip-Ideen: Freitext-Sessions + kuratierte Vorschläge ──
CREATE TABLE trip_idea_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id          UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  input_text         TEXT        NOT NULL,
  clarifying_answers JSONB,
  status             TEXT        NOT NULL DEFAULT 'suggested',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trip_ideas (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        REFERENCES trip_idea_sessions(id) ON DELETE CASCADE,
  family_id         UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  origin            TEXT        NOT NULL DEFAULT 'plan_ai',
  destination       TEXT        NOT NULL,
  route_summary     TEXT,
  best_season       TEXT,
  duration_days_min INT,
  duration_days_max INT,
  reasoning         TEXT,
  budget_range_min  NUMERIC,
  budget_range_max  NUMERIC,
  budget_currency   TEXT        NOT NULL DEFAULT 'EUR',
  includes_flights  BOOLEAN,
  is_chosen         BOOLEAN     NOT NULL DEFAULT FALSE,
  converted_trip_id UUID        REFERENCES trips(id) ON DELETE SET NULL,
  development_notes TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at-Trigger (eine gemeinsame Funktion für alle neuen Tabellen) ──
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER family_preference_categories_updated_at BEFORE UPDATE ON family_preference_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER past_trips_updated_at                   BEFORE UPDATE ON past_trips                   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER content_projects_updated_at             BEFORE UPDATE ON content_projects             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER content_ideas_updated_at                BEFORE UPDATE ON content_ideas                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER content_drafts_updated_at               BEFORE UPDATE ON content_drafts                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trip_idea_sessions_updated_at           BEFORE UPDATE ON trip_idea_sessions           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trip_ideas_updated_at                   BEFORE UPDATE ON trip_ideas                   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS + Grants: gleiches DEV-ONLY-Muster wie alle bestehenden Tabellen ──
ALTER TABLE family_preference_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE past_trips                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE past_trip_travelers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_drafts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_idea_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_ideas                   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_select" ON family_preference_categories FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON family_preference_categories FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON past_trips                   FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON past_trips                   FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON past_trip_travelers          FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON past_trip_travelers          FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON content_projects             FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON content_projects             FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON content_ideas                FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON content_ideas                FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON content_drafts               FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON content_drafts               FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON trip_idea_sessions           FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON trip_idea_sessions           FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON trip_ideas                   FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON trip_ideas                   FOR ALL    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  family_preference_categories, past_trips, past_trip_travelers,
  content_projects, content_ideas, content_drafts,
  trip_idea_sessions, trip_ideas
  TO anon, authenticated;
