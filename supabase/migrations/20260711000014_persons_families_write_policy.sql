-- persons und families hatten seit dem Ur-Schema nur "dev_select" (FOR SELECT),
-- nie "dev_write" — niemand musste diese Tabellen bisher direkt beschreiben.
-- Phase 7 führt Profil-Bearbeitung (persons) und Reisekompass/Hotelkriterien
-- (families) ein und benötigt daher Schreibzugriff, im selben DEV-ONLY-Muster
-- wie alle bestehenden dev_write-Policies (z. B. trips, stages, documents).
CREATE POLICY "dev_write" ON persons  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_write" ON families FOR ALL USING (true) WITH CHECK (true);
