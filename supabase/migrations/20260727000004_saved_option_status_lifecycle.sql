-- §"Phase B: Gemerkt/Ausgewählt/Gebucht" (Nutzervorgabe, wörtlich zu den
-- Statuswerten: "Status klar trennen: saved, selected, booked"). Erweitert
-- die bestehenden Merklisten-Tabellen minimal statt eine zweite, parallele
-- Tabelle zu bauen. trip_id bleibt nullable -- gemerkte Treffer bestehen
-- laut Vorgabe zunächst auch ohne Reisebezug. booking_id verknüpft einen
-- übernommenen Eintrag mit der tatsächlich angelegten Buchung (einziger
-- Übergang zu status='booked', ausgelöst von createBooking, nie von einem
-- reinen Klick -- siehe lib/actions/bookings.ts).
--
-- Defensiv mit IF NOT EXISTS: diese Session ist bereits einmal an einer
-- Migration gescheitert, die eine nicht angewendete Basismigration
-- voraussetzte (saved_flight_options_search_key). ALTER-Reihenfolge hier
-- unkritisch, da beide Basistabellen (20260721000001, 20260727000003)
-- bereits bestätigt live sind.

ALTER TABLE saved_flight_options
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'selected', 'booked')),
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS saved_flight_options_trip_id_idx ON saved_flight_options(trip_id);

ALTER TABLE saved_hotel_options
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'selected', 'booked')),
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS saved_hotel_options_trip_id_idx ON saved_hotel_options(trip_id);

-- Keine RLS-Änderung nötig -- Zugriff bleibt vollständig über family_id
-- gesteuert (bestehende Policy "family_members_only" auf beiden Tabellen).
