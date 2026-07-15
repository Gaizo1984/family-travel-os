-- §"Reiseideen 2.0, Phase 3 -- Favoriten & Vergleich": additive Erweiterung.
ALTER TABLE trip_ideas ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

-- §"Als Reise anlegen vorbereiten": is_chosen existiert bereits (Gewinner-
-- Flag, siehe chooseTripIdea) -- chosen_variant_type ergänzt die bevorzugte
-- Variante strukturiert, ohne die eigentliche Umwandlung (createTrip) jetzt
-- anzufassen. Kein Enum-Typ in der DB (nur die 5 TripVariantType-Strings aus
-- lib/trip-idea-advisor-ai.ts) -- wie überall in diesem Feature app-seitig
-- validiert statt per DB-Constraint, analog zu budget_currency etc.
ALTER TABLE trip_ideas ADD COLUMN chosen_variant_type TEXT;

-- §Cache-Table nach dem bewährten Muster von category_places_cache/
-- day_plan_cache: comparison_key = sortierte, verkettete idea_ids.
CREATE TABLE trip_idea_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  idea_ids UUID[] NOT NULL,
  comparison_key TEXT NOT NULL,
  scores JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, comparison_key)
);
ALTER TABLE trip_idea_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON trip_idea_comparisons FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
-- Grants für 'authenticated' kommen automatisch über die bestehenden
-- ALTER DEFAULT PRIVILEGES aus 20260712000004_auth_lockdown.sql.
