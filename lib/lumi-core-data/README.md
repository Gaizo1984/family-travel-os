# Lumi-Core-Fachdaten-Layer (vorbereitet, NICHT aktiv)

Analog zu `lib/lumi-core-storage/` (Phase 2): ein vollständiger,
funktionsfähiger Datenzugriffs-Layer für die erste Fachtabellen-Gruppe
(**Trips, Stages, Trip-Members, Bookings**) gegen die bereits real
migrierten `travel_trips`/`travel_stages`/`travel_trip_members`/
`travel_bookings`-Tabellen in Lumi Core -- **nirgends in der App
verdrahtet**. Travel-Fachdaten (`trips`, `stages`, `trip_members`,
`bookings` im alten Travel-Projekt) bleiben bis zum finalen, gemeinsamen
Cutover (Auth + Fachdaten + Storage zusammen) die aktive, produktive
Quelle.

## Warum nur diese 4 Tabellen, nicht alle 38?

Nutzervorgabe: "Zuerst Trips/Stages/Trip-Members/Bookings als erste
Gruppe vorbereiten." Die übrigen 34 migrierten Tabellen (siehe
Klassifizierungs-Tabelle im Cutover-Bericht) folgen in weiteren Gruppen.

## Warum noch nicht aktiv?

Gleicher Grund wie beim Storage-Layer: household-basierte RLS auf den
`travel_*`-Tabellen braucht eine aktive Lumi-Core-Auth-Session, die erst
zuverlässig existiert, sobald Lumi Core primärer Login ist (finaler
Cutover). Bis dahin ausdrücklich kein Service-Role-Einsatz für normale
App-Zugriffe und kein dauerhaftes Dual-Session-Konstrukt (Nutzervorgabe).

## Umfang

Kern-CRUD je Tabelle, nicht 1:1-Nachbau jeder der 29/10/5/13 bestehenden
Call-Site-Varianten (das passiert beim eigentlichen Umverdrahten am
finalen Cutover, aufbauend auf diesen Primitiven):

- `trips.ts` -- `listTrips`, `getTripById`, `getTripBySlug`, `createTrip`
  (inkl. automatischer Slug-Eindeutigkeit, gleiche Logik wie
  `lib/actions/trips.ts::slugify`+Schleife), `updateTrip`, `deleteTrip`.
- `stages.ts` -- `listStagesForTrip`, `createStage`, `updateStage`,
  `deleteStage`.
- `trip-members.ts` -- `listTripMembers`, `setTripMembers` (ersetzt die
  komplette Mitgliederliste einer Reise), `addTripMember`,
  `removeTripMember`. Nimmt bewusst `household_member_id` entgegen (die
  neue, native Form) -- `resolveHouseholdMemberId()` aus
  `lib/lumi-core-storage/paths.ts` übernimmt die Übersetzung von einer
  noch travel_person_id-basierten Aufrufstelle während der
  Übergangszeit.
- `bookings.ts` -- `listBookingsForTrip`, `getBookingById`,
  `createBooking`, `updateBooking`, `deleteBooking`.

## Was beim finalen Cutover zu tun ist (nicht Teil dieser Vorbereitung)

1. Primären Login auf Lumi Core umstellen.
2. Die bestehenden Call-Sites (29 für trips, 10 für stages, 5 für
   trip_members, 13 für bookings) auf diese Primitiven umstellen, inkl.
   aller bestehenden Sonderfälle (Titelbild-Upload bei Trip-Erstellung,
   automatische erste Etappe, etc. -- siehe `lib/actions/trips.ts`).
3. Restliche 34 migrierte Tabellen in weiteren Gruppen nach demselben
   Muster vorbereiten.
