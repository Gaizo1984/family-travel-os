-- §"Gebucht statt Reserviert/Geplant, dauerhaft" (Nutzervorgabe, wörtlich):
-- bereitet die Datenbestände auf die verengten Status-Wertelisten vor, bevor
-- die Optionen aus den Dropdowns verschwinden -- sonst würden bestehende
-- Zeilen mit einem Status stehen bleiben, den die App nicht mehr kennt.
-- 'reserved' bei Buchungen -> 'pending' (näher an der ursprünglichen
-- Bedeutung "angefragt, noch nicht fest" als 'confirmed'/"Gebucht").
UPDATE bookings SET status = 'pending' WHERE status = 'reserved';

-- 'planned' bei Journal-Terminen -> 'reserved' (bekommt jetzt das Label
-- "Gebucht" -- der konkretere, verbleibende Zielwert für "weiter als Idee").
UPDATE journey_events SET status = 'reserved' WHERE status = 'planned';
