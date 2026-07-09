-- document_trips: Viele-zu-viele-Zuordnung Dokument ↔ Reise (ersetzt die
-- Einzel-Spalte documents.trip_id für neue Zuordnungen; die Spalte selbst
-- bleibt unangetastet).
CREATE TABLE document_trips (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  trip_id     UUID NOT NULL REFERENCES trips(id)     ON DELETE CASCADE,
  PRIMARY KEY (document_id, trip_id)
);

-- insurance_policies: zentrale, wiederverwendbare Bestandsversicherung
-- (z. B. Amex-Reiseversicherung), einmal angelegt und mehreren Reisen
-- zuordenbar.
CREATE TABLE insurance_policies (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  label             TEXT        NOT NULL,
  provider          TEXT,
  policy_type       TEXT,
  reference_number  TEXT,
  valid_from        DATE,
  valid_to          DATE,
  emergency_contact TEXT,
  notes             TEXT,
  storage_bucket    TEXT,
  storage_path      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER insurance_policies_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE insurance_policy_persons (
  policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id)            ON DELETE CASCADE,
  PRIMARY KEY (policy_id, person_id)
);

CREATE TABLE insurance_policy_trips (
  policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  trip_id   UUID NOT NULL REFERENCES trips(id)               ON DELETE CASCADE,
  PRIMARY KEY (policy_id, trip_id)
);

-- RLS + Grants nach demselben DEV-ONLY-Muster wie alle bestehenden Tabellen.
-- Wichtig: GRANTs aus früheren Migrationen ("ON ALL TABLES") gelten nicht
-- rückwirkend für neue Tabellen, deshalb hier explizit wiederholt.
ALTER TABLE document_trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policy_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policy_trips   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_select" ON document_trips           FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON document_trips           FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON insurance_policies        FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON insurance_policies        FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON insurance_policy_persons  FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON insurance_policy_persons  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_select" ON insurance_policy_trips    FOR SELECT USING (true);
CREATE POLICY "dev_write"  ON insurance_policy_trips    FOR ALL    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON document_trips, insurance_policies, insurance_policy_persons, insurance_policy_trips
  TO anon, authenticated;
