-- DEV-ONLY: Temporäre SELECT-Rechte für anon und authenticated
-- Phase 7 ersetzt diese Grants durch RLS-Policies und REVOKE anon.

GRANT SELECT ON families       TO anon, authenticated;
GRANT SELECT ON persons        TO anon, authenticated;
GRANT SELECT ON trips          TO anon, authenticated;
GRANT SELECT ON trip_members   TO anon, authenticated;
GRANT SELECT ON stages         TO anon, authenticated;
GRANT SELECT ON trip_days      TO anon, authenticated;
GRANT SELECT ON bookings       TO anon, authenticated;
GRANT SELECT ON budget_items   TO anon, authenticated;
GRANT SELECT ON documents      TO anon, authenticated;
GRANT SELECT ON packing_items  TO anon, authenticated;
GRANT SELECT ON tasks          TO anon, authenticated;
GRANT SELECT ON journal_entries TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
