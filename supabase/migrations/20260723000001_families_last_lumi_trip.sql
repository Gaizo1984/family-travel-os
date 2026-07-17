-- Merkt die zuletzt in Frag LUMI ausgewählte Reise pro Familie (nicht pro
-- Browser/Cookie), damit die Auswahl geräteübergreifend für die richtige
-- Familie gilt. ON DELETE SET NULL: eine gelöschte Reise fällt einfach auf
-- die normale Standardauswahl (aktive/nächste bevorstehende Reise) zurück.
alter table families
  add column last_lumi_trip_id uuid references trips(id) on delete set null;
