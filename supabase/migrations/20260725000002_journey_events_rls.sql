-- §"RLS absichern" (Abschlusssprint, Tagesplaner 2.0): journey_events trug
-- seit der ursprünglichen Migration (20260710000010) noch die
-- Dev-Platzhalter-Policy "USING (true)" -- jeder authentifizierte Supabase-
-- Nutzer (nicht nur die eigene Familie) konnte damit theoretisch JEDE
-- Familie journey_events lesen/schreiben, sofern er einen gültigen Supabase-
-- Auth-Token besitzt (die App-UI verhindert das, ein direkter REST-Aufruf an
-- Supabase nicht). journey_events schreibt jetzt zusätzlich der Tagesplaner
-- 2.0 -- daher wird die Policy jetzt auf dasselbe familien-gescopte Muster
-- wie category_places_cache/day_plan_cache/signed_url_cache umgestellt.
-- journey_events hat kein eigenes family_id-Feld -- der Bezug läuft über
-- trip_id -> trips.family_id.
DROP POLICY IF EXISTS "dev_select" ON journey_events;
DROP POLICY IF EXISTS "dev_write" ON journey_events;

CREATE POLICY "family_members_only" ON journey_events
  FOR ALL
  USING (
    trip_id IN (
      SELECT t.id FROM trips t
      WHERE t.family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT t.id FROM trips t
      WHERE t.family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
  );

-- Kein anon-Zugriff mehr -- konsistent mit allen neueren familien-gescopten
-- Tabellen (category_places_cache, day_plan_cache, signed_url_cache), die
-- von Anfang an nur "authenticated" berechtigen. Ungeachtet der Policy
-- ohnehin nur zusätzliche Verteidigungslinie: auth.uid() ist für einen
-- echten anon-Request NULL, die Policy wäre also auch ohne dieses REVOKE
-- bereits restriktiv.
REVOKE ALL ON journey_events FROM anon;
