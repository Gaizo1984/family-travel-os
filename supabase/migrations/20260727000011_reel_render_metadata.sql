-- ============================================================
-- Content Studio 3.0, Sprint 5 -- Vorschau-/Finalrender ueber Remotion
-- Lambda. Rein additive Spalten auf der bereits in Sprint 1 angelegten
-- Job-Queue-Tabelle content_reel_renders (siehe
-- 20260727000009_content_studio_reel_data_model.sql) -- KEINE neue Tabelle,
-- KEIN paralleles Datenmodell (Nutzervorgabe, wörtlich):
--   * cost_estimate_usd/output_size_bytes/render_duration_seconds:
--     "nach erfolgreichem Render Kostenindikation, Renderdauer und
--     Dateigröße speichern" (Nutzervorgabe, wörtlich).
--   * aws_bucket_name/aws_function_name: technische Zuordnung fuer das
--     Fortschritts-Polling (getRenderProgress/downloadMedia/deleteRender
--     brauchen bucketName+functionName) -- ohne diese zwei Spalten müsste
--     jeder Poll-Tick erneut deployFunction/getOrCreateBucket aufrufen
--     (unnötige AWS-Roundtrips bei jedem Tick statt einmal beim Start).
-- Keine Datenbewegung, keine bestehende Spalte veraendert, kein
-- RLS-Update noetig (Policy ist bereits "FOR ALL", deckt neue Spalten
-- automatisch mit ab).
-- ============================================================

ALTER TABLE content_reel_renders
  ADD COLUMN cost_estimate_usd NUMERIC,
  ADD COLUMN output_size_bytes BIGINT,
  ADD COLUMN render_duration_seconds NUMERIC,
  ADD COLUMN aws_bucket_name TEXT,
  ADD COLUMN aws_function_name TEXT;
