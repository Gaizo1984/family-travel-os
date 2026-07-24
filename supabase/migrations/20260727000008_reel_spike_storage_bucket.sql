-- ============================================================
-- Content Studio 3.0, Sprint 0b: privater Storage-Bucket ausschließlich für
-- den isolierten Remotion + Vercel Sandbox Infrastruktur-Spike (Dev-Test-
-- Route "/mehr/developer"). Bewusst NICHT der bestehende "documents"-Bucket
-- -- getrennt von echten Nutzdaten, leicht später wieder zu entfernen.
-- Kein öffentlicher Zugriff, nur signierte URLs (gleiches Prinzip wie
-- "documents"), zusätzlich von Anfang an mit echter Familien-Isolation über
-- den Pfad ({family_id}/{dateiname}.mp4), nicht nur "authenticated" wie die
-- ältere documents-Policy -- siehe 20260727000007 (RLS-Härtung).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-reels-spike', 'content-reels-spike', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "content_reels_spike_family_members_only" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'content-reels-spike'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM persons WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'content-reels-spike'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM persons WHERE auth_user_id = auth.uid()
    )
  );
