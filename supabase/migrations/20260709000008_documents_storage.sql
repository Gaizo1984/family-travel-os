-- documents: Felder für Reisepass & künftige Dokumenttypen (additiv, keine Datenänderung)
ALTER TABLE documents ADD COLUMN details JSONB;
ALTER TABLE documents ADD COLUMN notes TEXT;

-- Fehlende Schreib-Policy nachtragen (bisher nur SELECT möglich — sonst
-- schlägt jedes Anlegen/Bearbeiten/Löschen von Dokumenten am RLS fehl,
-- unabhängig von den bereits erteilten Tabellen-Grants).
CREATE POLICY "dev_write" ON documents FOR ALL USING (true) WITH CHECK (true);

-- Privater Storage-Bucket für Reisedokumente (kein öffentlicher Zugriff,
-- Anzeige nur über signierte URLs aus dem Server).
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
  ON CONFLICT (id) DO NOTHING;

-- DEV-ONLY: offene Storage-Policy für diesen Bucket, gleiches Muster wie die
-- bestehenden dev_write-Policies auf den Datentabellen (Phase 7 löst das durch
-- echtes Auth ab).
CREATE POLICY "dev_documents_all" ON storage.objects FOR ALL
  USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
