-- §"Frag-LUMI-Verlauf löschen" (Nutzervorgabe, Frag-LUMI-Fix Punkt 2):
-- concierge_messages bekommt mit dieser Änderung erstmals user-seitig
-- ausgelöste DELETE-Aktionen (einzelne Frage + gesamter Verlauf, siehe
-- lib/actions/concierge-actions.ts::deleteConciergeMessage/
-- deleteAllConciergeMessages). Die Tabelle lief seit ihrer Einführung
-- (20260711000017_concierge_messages.sql) noch mit den permissiven
-- "dev_select"/"dev_write"-Policies (USING (true)) -- jede eingeloggte
-- Person hätte damit die Fragen/Antworten JEDER Familie löschen können, nicht
-- nur der eigenen. Jetzt auf dasselbe echte, familien-gescopte Muster wie
-- family_memories/category_places_cache/etc. umgestellt.
DROP POLICY IF EXISTS "dev_select" ON concierge_messages;
DROP POLICY IF EXISTS "dev_write" ON concierge_messages;

CREATE POLICY "family_members_only" ON concierge_messages
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));

REVOKE ALL ON concierge_messages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON concierge_messages TO authenticated;
