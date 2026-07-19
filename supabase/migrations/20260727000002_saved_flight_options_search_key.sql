-- §"Aus der Merkliste direkt zum Treffer" (Nutzervorgabe, kombinierter
-- Fix-Sprint): saved_flight_options speicherte bisher nur route_key (Ziel-
-- unabhängig von Datum/Reisenden) -- zu grob, um bei noch warmem Cache
-- direkt zum ursprünglichen Suchergebnis zurückzuspringen. Ergänzt den
-- exakten `search_key` (identisch zu flight_search_cache.search_key) für
-- den direkten Cache-Lookup ("Treffer öffnen"), plus die Reisenden-Zahlen
-- für den Fall, dass eine spätere Funktion die Originalsuche gezielt neu
-- auslösen soll. Alle vier Spalten nullable -- bestehende Zeilen ohne
-- diese Angaben bleiben gültig, zeigen aber keinen "Treffer öffnen"-Link.
ALTER TABLE saved_flight_options
  ADD COLUMN IF NOT EXISTS search_key TEXT,
  ADD COLUMN IF NOT EXISTS adults SMALLINT,
  ADD COLUMN IF NOT EXISTS children SMALLINT,
  ADD COLUMN IF NOT EXISTS infants SMALLINT;
