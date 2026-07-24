-- ============================================================
-- Content Studio 3.0, Sprint 1: Datenmodell fuer den Reel-Generator.
-- Rein additiv -- keine bestehende Spalte/Zeile wird veraendert. Reihenfolge
-- bewusst so gewaehlt, dass jede Tabelle nur auf bereits existierende
-- Tabellen verweist.
-- ============================================================

-- ── A) content_projects: neuer project_type-Wert 'reel' (keine
-- Schemaaenderung noetig, project_type ist eine reine TEXT-Spalte ohne
-- CHECK-Constraint) + additive Spalten fuer Stil/Dauer.
ALTER TABLE content_projects
  ADD COLUMN reel_style TEXT,
  ADD COLUMN reel_duration_seconds SMALLINT;

-- ── B) memory_videos: spiegelt memory_photos bewusst 1:1, damit beide als
-- gleichwertige, dauerhafte Quelle fuer content_reel_media_items dienen
-- koennen (siehe Content-Studio-3.0-Plan, "keine zweite Medienablage").
CREATE TABLE memory_videos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id              UUID        REFERENCES trips(id) ON DELETE SET NULL,
  uploaded_by_person_id UUID       REFERENCES persons(id) ON DELETE SET NULL,
  storage_path         TEXT        NOT NULL,
  thumbnail_storage_path TEXT,
  duration_seconds     NUMERIC,
  taken_at             TIMESTAMPTZ,
  caption              TEXT,
  is_highlight         BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE memory_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON memory_videos
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON memory_videos TO authenticated;

-- ── C) content_reel_media_items: welche vorhandenen Medien (Foto ODER
-- Video) fuer ein Reel-Projekt ausgewaehlt wurden, inkl. Reihenfolge.
-- Polymorphe Referenz (source_type + source_id) -- kein DB-FK moeglich,
-- Integritaet app-seitig geprueft (analog zu bestehenden Mustern wie
-- documents.booking_id).
CREATE TABLE content_reel_media_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
  source_type TEXT       NOT NULL CHECK (source_type IN ('photo', 'video')),
  source_id  UUID        NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_reel_media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON content_reel_media_items
  FOR ALL
  USING (project_id IN (
    SELECT id FROM content_projects
    WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM content_projects
    WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON content_reel_media_items TO authenticated;

-- ── D) content_reel_renders: der eigentliche Render-Auftrag als
-- Job-Queue-Zeile -- technischer State, der nicht ins content_drafts.structure-
-- JSON gehoert. Noch ungenutzt in Sprint 1 (kein Storyboard/Rendering),
-- aber bereits vorbereitet, damit spaetere Sprints keine weitere Migration
-- fuer die Grundstruktur brauchen. content_drafts hat kein eigenes
-- family_id -- Familie wird ueber project_id (content_drafts.project_id ->
-- content_projects.family_id) aufgeloest, gleiches Muster wie die in
-- 20260727000007 gehaertete content_drafts-Policy.
CREATE TABLE content_reel_renders (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id                 UUID        NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  quality                  TEXT        NOT NULL CHECK (quality IN ('preview_lowres', 'final')),
  status                   TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'rendering', 'completed', 'failed')),
  provider                 TEXT,
  provider_job_id          TEXT,
  progress_percent         SMALLINT,
  attempt_count            SMALLINT    NOT NULL DEFAULT 0,
  max_attempts             SMALLINT    NOT NULL DEFAULT 2,
  output_storage_path      TEXT,
  output_duration_seconds  NUMERIC,
  error_message            TEXT,
  requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ
);

ALTER TABLE content_reel_renders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON content_reel_renders
  FOR ALL
  USING (draft_id IN (
    SELECT id FROM content_drafts WHERE project_id IN (
      SELECT id FROM content_projects
      WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
  ))
  WITH CHECK (draft_id IN (
    SELECT id FROM content_drafts WHERE project_id IN (
      SELECT id FROM content_projects
      WHERE family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid())
    )
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON content_reel_renders TO authenticated;

-- ── E) reel_render_usage: Monats-Kostenzaehler, exakt das lumi_brain_usage-
-- Schema gespiegelt (siehe 20260722000001_lumi_brain_usage.sql).
CREATE TABLE reel_render_usage (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  month_key    TEXT        NOT NULL,
  render_count INT         NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, month_key)
);

ALTER TABLE reel_render_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON reel_render_usage
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON reel_render_usage TO authenticated;

-- ── F) Produktiver, privater Storage-Bucket fuer Render-Ausgaben --
-- getrennt vom Spike-Bucket "content-reels-spike" (20260727000008). Keine
-- Quellmedien hier (die bleiben in memory_photos/memory_videos/documents-
-- Bucket), nur fertige Reel-Ausgaben. Gleiches Familien-Pfad-Policy-Muster
-- wie der Spike-Bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-reels', 'content-reels', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "content_reels_family_members_only" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'content-reels'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM persons WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'content-reels'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM persons WHERE auth_user_id = auth.uid()
    )
  );
