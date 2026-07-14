-- §"Unsere Welt": reine Flughafen-/Zwischenstopp-Etappen dürfen nicht als
-- besuchtes Land in Statistik/Weltkarte zählen -- unabhängig davon, ob ihr
-- country_code korrekt gesetzt ist. Statt fragilem Text-Keyword-Raten in
-- `notes` ("Zwischenstopp") eine klare, strukturelle Spalte: Etappen, die
-- über den bestätigungspflichtigen Zwischenstopp-Flow
-- (app/(app)/trips/[id]/stages/confirm-stopover) entstehen, werden
-- automatisch is_transit=true angelegt; für Altbestände/Sonderfälle bleibt
-- die Spalte im Etappen-Formular manuell editierbar.
ALTER TABLE stages ADD COLUMN is_transit BOOLEAN NOT NULL DEFAULT false;
