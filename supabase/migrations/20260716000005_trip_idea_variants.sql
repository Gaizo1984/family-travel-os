-- §"Reiseideen 2.0, Phase 2 -- Reisevarianten": additive Erweiterung, keine
-- bestehende Spalte wird angefasst. RLS bereits durch die bestehende
-- "family_members_only"-Policy auf trip_ideas abgedeckt (20260716000004).
ALTER TABLE trip_ideas
  ADD COLUMN variants JSONB,
  ADD COLUMN variants_generated_at TIMESTAMPTZ;
