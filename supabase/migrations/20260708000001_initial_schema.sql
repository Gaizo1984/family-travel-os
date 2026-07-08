-- Migration: Initial Schema — Familie Gaitantzis Travel OS
-- Tables: families, persons, trips, trip_members, stages, trip_days,
--         bookings, budget_items, documents, packing_items, tasks, journal_entries

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE booking_type   AS ENUM ('flight', 'accommodation', 'rental_car', 'transfer', 'activity');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- ─── Helper: auto-update updated_at ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. families ──────────────────────────────────────────────────────────────

CREATE TABLE families (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. persons ───────────────────────────────────────────────────────────────

CREATE TABLE persons (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  initials   TEXT        NOT NULL CHECK (char_length(initials) <= 3),
  color      TEXT        NOT NULL,
  birth_date DATE,
  is_minor   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX persons_family_id_idx ON persons(family_id);

-- ─── 3. trips ─────────────────────────────────────────────────────────────────

CREATE TABLE trips (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  family_id     UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  subtitle      TEXT,
  status        TEXT        NOT NULL DEFAULT 'planned'
                            CHECK (status IN ('planned', 'active', 'completed')),
  start_date    DATE,
  end_date      DATE,
  cover_emoji   TEXT,
  gradient_from TEXT,
  gradient_via  TEXT,
  gradient_to   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX trips_family_id_idx ON trips(family_id);
CREATE INDEX trips_status_idx    ON trips(status);

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 4. trip_members ──────────────────────────────────────────────────────────

CREATE TABLE trip_members (
  trip_id   UUID NOT NULL REFERENCES trips(id)   ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role      TEXT,
  PRIMARY KEY (trip_id, person_id)
);

-- ─── 5. stages ────────────────────────────────────────────────────────────────

CREATE TABLE stages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  location      TEXT,
  start_date    DATE,
  end_date      DATE,
  nights        INT,
  accommodation TEXT,
  notes         TEXT,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stages_trip_id_idx ON stages(trip_id);

-- ─── 6. trip_days ─────────────────────────────────────────────────────────────

CREATE TABLE trip_days (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id)   ON DELETE CASCADE,
  stage_id   UUID                 REFERENCES stages(id)  ON DELETE SET NULL,
  date       DATE        NOT NULL,
  title      TEXT,
  day_plan   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, date)
);

CREATE INDEX trip_days_trip_id_idx ON trip_days(trip_id);

-- ─── 7. bookings ──────────────────────────────────────────────────────────────

CREATE TABLE bookings (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           UUID           NOT NULL REFERENCES trips(id)  ON DELETE CASCADE,
  stage_id          UUID                    REFERENCES stages(id) ON DELETE SET NULL,
  type              booking_type   NOT NULL,
  title             TEXT           NOT NULL,
  provider          TEXT,
  booking_reference TEXT,
  status            booking_status NOT NULL DEFAULT 'pending',
  amount            NUMERIC(10, 2),
  currency          TEXT           NOT NULL DEFAULT 'EUR',
  start_datetime    TIMESTAMPTZ,
  end_datetime      TIMESTAMPTZ,
  details           JSONB,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX bookings_trip_id_idx  ON bookings(trip_id);
CREATE INDEX bookings_type_idx     ON bookings(type);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 8. budget_items ──────────────────────────────────────────────────────────

CREATE TABLE budget_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID        NOT NULL REFERENCES trips(id)    ON DELETE CASCADE,
  stage_id       UUID                 REFERENCES stages(id)   ON DELETE SET NULL,
  booking_id     UUID                 REFERENCES bookings(id) ON DELETE SET NULL,
  category       TEXT        NOT NULL,
  label          TEXT        NOT NULL,
  amount_planned NUMERIC(10, 2),
  amount_actual  NUMERIC(10, 2),
  currency       TEXT        NOT NULL DEFAULT 'EUR',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX budget_items_trip_id_idx ON budget_items(trip_id);

-- ─── 9. documents ─────────────────────────────────────────────────────────────

CREATE TABLE documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID                 REFERENCES trips(id)    ON DELETE CASCADE,
  person_id        UUID                 REFERENCES persons(id)  ON DELETE SET NULL,
  booking_id       UUID                 REFERENCES bookings(id) ON DELETE SET NULL,
  doc_type         TEXT        NOT NULL,
  label            TEXT,
  expires_at       DATE,
  storage_provider TEXT        NOT NULL DEFAULT 'supabase_storage'
                               CHECK (storage_provider IN ('supabase_storage', 'azure_blob', 'onedrive_sharepoint')),
  storage_bucket   TEXT        NOT NULL,
  storage_path     TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX documents_person_id_idx ON documents(person_id);
CREATE INDEX documents_trip_id_idx   ON documents(trip_id);

-- ─── 10. packing_items ────────────────────────────────────────────────────────

CREATE TABLE packing_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID        NOT NULL REFERENCES trips(id)   ON DELETE CASCADE,
  person_id    UUID                 REFERENCES persons(id) ON DELETE SET NULL,
  label        TEXT        NOT NULL,
  category     TEXT,
  is_packed    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_essential BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX packing_items_trip_id_idx ON packing_items(trip_id);

-- ─── 11. tasks ────────────────────────────────────────────────────────────────

CREATE TABLE tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id)   ON DELETE CASCADE,
  stage_id    UUID                 REFERENCES stages(id)  ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  hint        TEXT,
  context     TEXT,
  status      TEXT        NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'done', 'snoozed')),
  due_date    DATE,
  assigned_to UUID                 REFERENCES persons(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tasks_trip_id_idx ON tasks(trip_id);
CREATE INDEX tasks_status_idx  ON tasks(status);

-- ─── 12. journal_entries ──────────────────────────────────────────────────────

CREATE TABLE journal_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id)      ON DELETE CASCADE,
  trip_day_id UUID                 REFERENCES trip_days(id)  ON DELETE SET NULL,
  author_id   UUID                 REFERENCES persons(id)    ON DELETE SET NULL,
  date        DATE,
  title       TEXT        NOT NULL,
  content     TEXT,
  location    TEXT,
  visibility  TEXT        NOT NULL DEFAULT 'family'
              CHECK (visibility IN ('family', 'private')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX journal_entries_trip_id_idx ON journal_entries(trip_id);
