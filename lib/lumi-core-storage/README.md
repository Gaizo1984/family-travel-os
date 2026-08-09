# Lumi-Core-Storage-Layer (vorbereitet, NICHT aktiv)

Dieser Ordner enthält einen vollständigen, funktionsfähigen Storage-Layer
für die beiden neuen Lumi-Core-Buckets (`travel-documents`,
`profile-photos`) -- als Vorbereitung für den finalen Cutover, aber
**noch nirgends in der App verdrahtet**. Kein bestehender Call-Site
(`lib/actions/*.ts`, `lib/signed-storage-url.ts`, `lib/photo-thumbnails.ts`,
Komponenten) importiert etwas aus diesem Ordner. Travel-Storage
(`documents`-Bucket im alten Travel-Projekt) bleibt bis zum finalen,
gemeinsamen Cutover (Auth + Fachdaten + Storage zusammen) die aktive
Quelle.

## Warum noch nicht aktiv?

Die neuen Buckets haben household-basierte RLS
(`is_household_member(household_id)`), die eine aktive Lumi-Core-Auth-
Session (`lc-*`-Cookie) voraussetzt. Solange der primäre Login noch bei
Travel liegt (Phase 1/2-Entscheidung), ist diese Session nicht
zuverlässig vorhanden -- ausdrücklich KEIN Service-Role-Workaround und
KEIN dauerhaftes Dual-Session-Konstrukt für normale App-Zugriffe
(Nutzervorgabe). Dieser Layer nutzt daher bewusst denselben
cookie-basierten `createLumiCoreClient()` wie die bestehende Phase-3A-
Funktionalität -- er WIRD erst zuverlässig funktionieren, sobald Lumi
Core zum primären Login wird (finaler Cutover), und ist bis dahin
absichtlich unbenutzt.

## Dateien

- `paths.ts` -- household_id-Auflösung (aus Travels `families`-Bridge-
  Spalte, unverändert read-only) und die beiden Pfadkonventionen:
  - `travel-documents`: `{household_id}/{original_path}` (einfacher Präfix)
  - `profile-photos`: `{household_id}/{household_member_id}/{filename}`
    (Personen-Segment wird über `travel_person_migration_map` aufgelöst,
    nicht einfach präfigiert -- andere Konvention als beim Bulk-Copy)
- `client.ts` -- Bucket-Konstanten + Upload/Download/Remove-Wrapper,
  gleiche Optionsform wie die bestehenden Travel-Call-Sites
  (`contentType`, `cacheControl`, `upsert`).
- `signed-url.ts` -- Signed-URL-Erzeugung gegen Lumi Core. Bewusst OHNE
  eigene Cache-Tabelle (die bestehende `signed_url_cache` ist eine
  Travel-Fachtabelle, noch nicht migriert) -- Caching kommt mit der
  Fachdaten-Migration, hier direkte Signierung pro Aufruf.
- `photo-thumbnails.ts` -- identische Thumbnail-Logik wie
  `lib/photo-thumbnails.ts` (deterministischer `__thumb{400,800}.webp`-
  Pfad, `sharp`-Resize, `upsert:true`, Fallback auf Original bei jedem
  Fehler), nur gegen den Lumi-Core-Client/-Bucket statt Travel.

## Was beim finalen Cutover zu tun ist (nicht Teil dieser Vorbereitung)

1. Primären Login auf Lumi Core umstellen (macht `lc-*`-Session
   zuverlässig, via proxy.ts-Session-Refresh).
2. Die ~80 bestehenden Call-Sites (siehe Cutover-Inventar) von
   `lib/signed-storage-url.ts`/`lib/photo-thumbnails.ts`/direkten
   `supabase.storage.from('documents')`-Aufrufen auf die Äquivalente in
   diesem Ordner umstellen.
3. `storage_path`-Werte in den (dann migrierten) `travel_*`-Fachtabellen
   verwenden bereits die neuen, präfigierten Pfade (siehe
   `05_storage_db_reference_update.js`) -- keine Pfad-Transformation zur
   Laufzeit mehr nötig, `paths.ts` wird dann nur noch für NEUE Uploads
   gebraucht.
4. Eigene Signed-URL-Cache-Tabelle in Lumi Core ergänzen, sobald die
   Fachdaten dort liegen.
