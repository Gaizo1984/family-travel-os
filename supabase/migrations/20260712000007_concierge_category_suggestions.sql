-- Concierge-Kategorie-Vorschläge (Aktivitäten/Restaurants/Strände/...): pro
-- Familie+Reise+Kategorie EIN gecachter Vorschlag, der bestehen bleibt, bis
-- die Familie ausdrücklich "Aktualisieren" klickt -- anders als
-- concierge_messages (tagesgebunden) muss das über mehrere Tage gültig
-- bleiben ("zuletzt aktualisiert vor 3 Tagen"). category ist bewusst TEXT
-- statt ENUM, damit neue Kategorien (lib/today-categories.ts) ohne weitere
-- Migration ergänzt werden können.

CREATE TABLE concierge_category_suggestions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL,
  question_text TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  event_title   TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, trip_id, category)
);

ALTER TABLE concierge_category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_only" ON concierge_category_suggestions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON concierge_category_suggestions TO authenticated;
