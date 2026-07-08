-- DEV-ONLY: Offene RLS-Policies für alle Tabellen
-- Phase 7 ersetzt diese durch Auth-gebundene Policies (auth.uid()).

CREATE POLICY "dev_select" ON families        FOR SELECT USING (true);
CREATE POLICY "dev_select" ON persons         FOR SELECT USING (true);
CREATE POLICY "dev_select" ON trips           FOR SELECT USING (true);
CREATE POLICY "dev_select" ON trip_members    FOR SELECT USING (true);
CREATE POLICY "dev_select" ON stages          FOR SELECT USING (true);
CREATE POLICY "dev_select" ON trip_days       FOR SELECT USING (true);
CREATE POLICY "dev_select" ON bookings        FOR SELECT USING (true);
CREATE POLICY "dev_select" ON budget_items    FOR SELECT USING (true);
CREATE POLICY "dev_select" ON documents       FOR SELECT USING (true);
CREATE POLICY "dev_select" ON packing_items   FOR SELECT USING (true);
CREATE POLICY "dev_select" ON tasks           FOR SELECT USING (true);
CREATE POLICY "dev_select" ON journal_entries FOR SELECT USING (true);

CREATE POLICY "dev_write"  ON trips           FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON stages          FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON trip_members    FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON trip_days       FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON bookings        FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON budget_items    FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON packing_items   FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON tasks           FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "dev_write"  ON journal_entries FOR ALL    USING (true) WITH CHECK (true);
