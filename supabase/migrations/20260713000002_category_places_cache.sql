-- LUMI Intelligence v1: Cache für echte Places-/Route-Matrix-Treffer je
-- Kategorie (Aktivitäten/Restaurants/Strände/Natur) -- getrennt von
-- concierge_category_suggestions (dort steht nur der KI-Fließtext).
--
-- §Unique-Key bewusst um origin_key erweitert (nicht nur family_id/trip_id/
-- category): eine Reise kann mehrere Ausgangspunkte nacheinander haben
-- (z. B. Zwischenstopp-Hotel, dann Hauptziel, dann Rück-Zwischenstopp --
-- siehe Costa-Rica-2026-Beispiel mit Atlanta + Guanacaste). Ohne
-- ortsspezifischen Key würde ein Wechsel des aktuellen Aufenthaltsorts
-- fälschlich noch die Treffer des vorherigen Orts zeigen. origin_key ist
-- die Places-ID des Hotels (stabil, bevorzugt) oder ersatzweise die auf
-- ca. 100 m gerundete Koordinate des Urlaubsorts (kein Hotel gefunden).
-- origin_label bleibt die für Menschen lesbare Anzeige.
--
-- §RLS bewusst NICHT das app-weite Blankett "authenticated_only" (wie bei
-- allen 32 Bestandstabellen aus Security Foundation 1A), sondern echt
-- familienbezogen über persons.auth_user_id -- diese Tabelle ist neu, die
-- schärfere Policy kostet hier nichts extra. Die Bestandstabellen bleiben
-- bewusst unverändert (eigene, größere Entscheidung, nicht Teil dieser
-- Migration).
CREATE TABLE category_places_cache (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  trip_id       UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category      TEXT        NOT NULL,
  origin_key    TEXT        NOT NULL,
  origin_label  TEXT        NOT NULL,
  results       JSONB       NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, trip_id, category, origin_key)
);

ALTER TABLE category_places_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_only" ON category_places_cache
  FOR ALL
  USING (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT family_id FROM persons WHERE auth_user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON category_places_cache TO authenticated;
