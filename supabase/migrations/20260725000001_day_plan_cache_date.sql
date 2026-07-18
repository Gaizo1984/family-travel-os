-- §"Tagesplaner 2.0, Cache-/Datenmodellgrundlage": day_plan_cache wechselt
-- vom bisherigen Cache-Schlüssel (family_id, trip_id, mode) zu
-- (family_id, trip_id, date) -- Voraussetzung dafür, dass ein beliebiger
-- freier Reisetag aus der Journey direkt an den Tagesplaner übergeben werden
-- kann (v1 kannte nur "heute"/"morgen" relativ zum Aufrufzeitpunkt, kein
-- konkretes Datum). `mode` bleibt als informative Spalte bestehen (z. B.
-- weiterhin "individueller Wunsch" vs. Standardtag), ist aber nicht mehr
-- Teil des Unique-Keys.
--
-- §"Bestehende v1-Cacheeinträge erhalten, date zunächst nullable, alten
-- Constraint nur löschen wenn vorhanden, neuen nur nach Kollisionsprüfung
-- anlegen" (Nutzervorgabe, wörtlich): kein DROP TABLE/TRUNCATE, keine
-- hartcodierte Annahme über den exakten bisherigen Constraint-Namen -- er
-- wird zur Laufzeit aus pg_constraint ermittelt, nicht aus dem
-- ursprünglichen CREATE-TABLE-Statement geraten (Migration
-- 20260714000001_day_plan_cache.sql legte den Namen implizit per Postgres-
-- Konvention an, das kann sich in der Praxis unterscheiden). Bestehende
-- Zeilen bekommen `date = NULL` -- Postgres behandelt mehrere NULL-Werte in
-- einem UNIQUE-Constraint nie als Kollision, d. h. alte Zeilen bleiben ohne
-- Backfill unverändert bestehen und laufen regulär über ihre 7-Tage-TTL
-- (lib/cache-cleanup.ts) aus.

ALTER TABLE day_plan_cache ADD COLUMN IF NOT EXISTS date DATE;

DO $$
DECLARE
  old_constraint_name TEXT;
  duplicate_count INTEGER;
BEGIN
  -- Bisherigen UNIQUE-Constraint auf genau (family_id, trip_id, mode) über
  -- den Systemkatalog finden (spaltenmengen-basiert, nicht namensbasiert).
  SELECT con.conname INTO old_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'day_plan_cache'
    AND con.contype = 'u'
    AND (
      SELECT array_agg(attr.attname ORDER BY attr.attname)
      FROM unnest(con.conkey) AS k(attnum)
      JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = k.attnum
    ) = ARRAY['family_id', 'mode', 'trip_id']::name[]
  LIMIT 1;

  IF old_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE day_plan_cache DROP CONSTRAINT %I', old_constraint_name);
    RAISE NOTICE 'day_plan_cache: alten Unique-Constraint % entfernt', old_constraint_name;
  ELSE
    RAISE NOTICE 'day_plan_cache: kein bestehender (family_id, trip_id, mode)-Unique-Constraint gefunden -- nichts zu entfernen';
  END IF;

  -- §"Neuen Unique Constraint nur nach Kollisionsprüfung anlegen": direkt
  -- nach ADD COLUMN haben alle Bestandszeilen date=NULL, was nie kollidiert
  -- -- die Prüfung bleibt trotzdem explizit (Nutzervorgabe), u. a. falls
  -- diese Migration später erneut über teilweise befüllte date-Werte läuft.
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT family_id, trip_id, date
    FROM day_plan_cache
    WHERE date IS NOT NULL
    GROUP BY family_id, trip_id, date
    HAVING COUNT(*) > 1
  ) dups;

  IF duplicate_count = 0 THEN
    ALTER TABLE day_plan_cache ADD CONSTRAINT day_plan_cache_family_id_trip_id_date_key UNIQUE (family_id, trip_id, date);
    RAISE NOTICE 'day_plan_cache: neuen Unique-Constraint (family_id, trip_id, date) angelegt';
  ELSE
    -- §Rückfallstrategie: die Migration bricht NICHT ab (kein RAISE
    -- EXCEPTION) -- ein fehlender Constraint bedeutet im schlimmsten Fall
    -- doppelte Cache-Zeilen statt eines gescheiterten Deploys. Die
    -- Schreiblogik nutzt ohnehin upsert(..., { onConflict:
    -- 'family_id,trip_id,date' }) -- ohne Constraint führt das zu einem
    -- klar sichtbaren Supabase-Fehler beim Schreiben (nicht zu
    -- stillschweigend falschen Daten), der sofort auffällt und manuell
    -- behebbar ist (Duplikate bereinigen, Migration erneut anwenden).
    RAISE WARNING 'day_plan_cache: % Kollision(en) auf (family_id, trip_id, date) gefunden -- Unique-Constraint NICHT angelegt, manuelle Bereinigung noetig', duplicate_count;
  END IF;
END $$;
