# Cache-/Usage-Tabellen: Regenerationsplan (kein Code, keine Migration)

Diese 12 Tabellen werden bewusst **nicht** nach Lumi Core migriert (siehe
Klassifizierung im Cutover-Bericht) -- es gibt für sie keine `travel_*`-
Zieltabelle. Beim finalen Cutover entstehen sie in Lumi Core einfach neu,
sobald die jeweilige Funktion zum ersten Mal für einen household_id
aufgerufen wird. Kein Datenverlust, weil ihr Inhalt per Definition aus
den (dann bereits migrierten) Fachdaten oder aus externen APIs neu
ableitbar ist.

| Tabelle | Regenerationsstrategie |
|---|---|
| `flight_search_cache` | Neue Suche beim nächsten Aufruf, Schlüssel (`search_key`) unverändert ableitbar aus den migrierten `travel_trip_ideas`/`travel_bookings` |
| `hotel_search_cache` | Gleiches Prinzip wie Flugsuche |
| `day_plan_cache` | Wird beim nächsten Tagesaufruf aus migrierten `travel_trips`/`travel_journey_events` neu erzeugt |
| `category_places_cache` | Neue Google-Places-Abfrage beim nächsten Zugriff |
| `signed_url_cache` | Ersetzt durch die neue, noch zu bauende Cache-Schicht in `lib/lumi-core-storage/signed-url.ts` (siehe dessen README) -- bis dahin: keine, jeder Aufruf signiert direkt |
| `today_recommendations` | Regeneriert sich laut eigenem Design "einmal pro Kalendertag" ohnehin fortlaufend -- am Cutover-Tag einfach ein weiterer Regenerations-Trigger |
| `trip_hints` | Cron-generiert mit `dedupe_key`/`content_hash` -- nächster Cron-Lauf nach Cutover erzeugt sie aus den migrierten `travel_bookings`/`travel_documents`/`travel_journey_events` neu |
| `concierge_category_suggestions` | Regeneriert sich beim nächsten "Aktualisieren"-Klick |
| `trip_idea_comparisons` | Regeneriert sich bei der nächsten Vergleichsanfrage aus migrierten `travel_trip_ideas` |
| `lumi_brain_usage` | Monatszähler, startet in Lumi Core bei 0 für den aktuellen Monat -- kein Verlust an Aussagekraft |
| `flight_search_usage` | Gleiches Prinzip |
| `reel_render_usage` | Gleiches Prinzip |
| `ai_generation_jobs` | Ephemerer Job-Status -- nach Cutover ohnehin nur für zum Zeitpunkt des Umschaltens laufende Jobs relevant, die neu gestartet werden müssten |

**Wichtig für den finalen Cutover:** Vor dem eigentlichen Umschalten
prüfen, ob zum Zeitpunkt des Wechsels laufende `ai_generation_jobs`
(`status='pending'`) existieren -- diese sollten entweder abgewartet oder
bewusst verworfen und neu gestartet werden, nicht stillschweigend
ignoriert.

`dev_test_runs` ist kein Cache, sondern ein Dev-Artefakt ohne echte
Nutzerdaten -- wird nicht migriert und braucht keinen Regenerationsplan.
