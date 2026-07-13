-- LUMI Intelligence v1: optionale strukturierte Zusatzdaten für aus LUMI
-- übernommene Journey-Einträge (Place-ID, Koordinaten, Dauer, Fahrzeit,
-- Quelle). Ein JSONB-Feld statt mehrerer neuer Spalten -- folgt demselben
-- Muster wie today_recommendations.recommendation/concierge_messages.actions,
-- minimal-invasiv, bricht keine bestehenden Lesungen von journey_events.
ALTER TABLE journey_events ADD COLUMN metadata JSONB;
