/**
 * §8 Offline-Verfügbarkeit für Boardingpässe/Gepäckbelege, §9 ESTA/ETA (verschärft).
 *
 * Bewusste Architektur-Entscheidung: Die gesamte Offline-Logik lebt NUR auf dem
 * Gerät (IndexedDB im Browser) — es gibt keine neue DB-Tabelle/Spalte dafür.
 * "Offline verfügbar bis ..." und "länger behalten" sind reine Geräte-Zustände,
 * die nicht zwischen Geräten synchronisiert werden müssen; Cloud (Supabase
 * Storage) bleibt in jedem Fall die Quelle der Wahrheit — die lokale Kopie ist
 * ausschließlich ein Cache, der jederzeit erneut vom Server geladen werden kann.
 *
 * Sicherheitsgrenze (bewusst dokumentiert, nicht gelöst): IndexedDB ist
 * same-origin-sandboxed (andere Websites kommen nicht heran), aber NICHT
 * verschlüsselt — wer physischen/Browser-Zugriff auf das entsperrte Gerät hat,
 * kann die zwischengespeicherten Dateien grundsätzlich auslesen. Eine echte
 * Verschlüsselung würde eine Passphrase-/Schlüssel-UX erfordern, die außerhalb
 * des Rahmens dieser Phase liegt.
 *
 * §"Zwei Sicherheitsstufen" (Nutzervorgabe, Frag-LUMI-Offline-Sprint): dieselbe
 * IndexedDB-Architektur bedient jetzt zwei Policies statt einer, KEINE zweite
 * Speicherlösung:
 * - `'standard'` (Boardingpass, Gepäckbeleg): unverändertes bisheriges
 *   Verhalten -- Opt-in-Cache erst beim ersten Ansehen, 7 Tage ab Referenz-
 *   datum (z. B. Flugtag), "länger behalten" verfügbar. Für ein Familien-
 *   eigenes Gerät vertretbares Restrisiko.
 * - `'sensitive'` (ausschließlich ESTA/ETA -- Reisepass/Personalausweis
 *   bekommen bewusst GAR KEINE Offline-Funktion, siehe Aufrufstellen): kein
 *   Auto-Cache, nur nach expliziter Zustimmung (siehe OfflineDocumentViewer),
 *   feste 24h-TTL ab Speicherzeitpunkt (nie ab einem Referenzdatum, nie
 *   verlängerbar), kein "länger behalten". Wird zusätzlich aktiv geleert bei
 *   Logout und beim endgültigen Löschen der zugehörigen Reise (siehe
 *   purgeSensitiveOfflineDocuments, aufgerufen aus components/LogoutButton.tsx
 *   und app/(app)/trips/[id]/delete/page.tsx).
 *
 * Weder Reisepass- noch ESTA/ETA-Daten dürfen künftig in eine etwaige
 * Reise-Snapshot-/Export-Funktion einfließen, falls eine solche einmal gebaut
 * wird -- diese Datei bleibt die einzige Stelle, die Passagier-/Einreise-
 * dokumente geräte-lokal vorhält.
 */

const DB_NAME = 'family-travel-os-offline-cache'
const STORE_NAME = 'documents'
/**
 * §"Offline-Bereich" (Nutzervorgabe, kombinierter Fix-Sprint): zweiter Store
 * in DERSELBEN Datenbank für ganze Reise-Snapshots (Übersicht/Journey/
 * Flüge & Hotels) -- bewusst keine zweite IndexedDB-Datenbank, keine zweite
 * Offline-Speicherlösung. DB_VERSION 1->2, bestehender `documents`-Store
 * bleibt beim Upgrade unangetastet (siehe onupgradeneeded unten).
 */
const TRIP_SNAPSHOT_STORE_NAME = 'trip-snapshots'
const DB_VERSION = 2
const CACHE_DURATION_DAYS = 7
const SENSITIVE_CACHE_DURATION_HOURS = 24

export type OfflineCachePolicy = 'standard' | 'sensitive'

export type CachedDocumentMeta = {
  documentId: string
  fileName: string
  mimeType: string
  cachedAt: string
  expiresAt: string
  keepLonger: boolean
  policy: OfflineCachePolicy
  tripId: string | null
  /** §"gruppiert nach Boardingpässe/Gepäckbelege/ESTA/ETA" (Nutzervorgabe): Dokumenttyp fürs Gruppieren im Offline-Dokumente-Tab, ohne dafür jedes Mal eine zusätzliche Supabase-Abfrage zu brauchen. */
  docType: 'boarding_pass' | 'baggage_tag' | 'esta' | 'eta'
  /** Anzeige-Titel (z. B. Personenname oder "Koffer 1") -- gleiche Werte wie bereits im jeweiligen Viewer verwendet. */
  label: string
}

type CachedDocumentRecord = CachedDocumentMeta & { blob: Blob }

export type OfflineTripSnapshot = {
  tripId: string
  slug: string
  title: string
  subtitle: string | null
  dateRangeLabel: string
  statusLabel: string
  journeyDays: Array<{
    date: string
    dateLabel: string
    stageLabel: string | null
    items: Array<{ time: string | null; title: string; subtitle: string | null; category: string }>
  }>
  flightsAndHotels: Array<{
    id: string
    type: 'flight' | 'accommodation'
    title: string
    provider: string | null
    startLabel: string | null
    endLabel: string | null
    reference: string | null
  }>
  cachedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'documentId' })
      }
      if (!db.objectStoreNames.contains(TRIP_SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(TRIP_SNAPSHOT_STORE_NAME, { keyPath: 'tripId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function addHoursIso(fromIso: string, hours: number): string {
  const d = new Date(fromIso)
  d.setHours(d.getHours() + hours)
  return d.toISOString()
}

export type CacheDocumentOptions = {
  policy: OfflineCachePolicy
  /** Nur für `policy: 'standard'` relevant (z. B. Flug-/Buchungsdatum) -- bei `'sensitive'` immer ignoriert, TTL zählt dort ausschließlich ab Speicherzeitpunkt. */
  referenceDateIso?: string
  /** §"Offline-Bereich, Dokumente-Tab" (Nutzervorgabe): jetzt für ALLE Policies gesetzt (vorher nur `'sensitive'`), damit boardingpass/gepäckbeleg-Dokumente ebenfalls einer Reise zugeordnet werden können -- siehe listCachedDocumentsForTrip. */
  tripId?: string | null
  docType: CachedDocumentMeta['docType']
  label: string
}

/**
 * Speichert die Datei lokal. `'standard'`: Ablaufdatum 7 Tage ab `referenceDateIso`
 * (Flugtag), falls angegeben, sonst ab jetzt. `'sensitive'`: immer fix 24h ab
 * jetzt, `referenceDateIso` wird bewusst nicht berücksichtigt.
 */
export async function cacheDocument(
  documentId: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
  options: CacheDocumentOptions,
): Promise<CachedDocumentMeta> {
  const db = await openDb()
  const now = new Date().toISOString()
  const expiresAt = options.policy === 'sensitive'
    ? addHoursIso(now, SENSITIVE_CACHE_DURATION_HOURS)
    : addDaysIso(options.referenceDateIso ?? now, CACHE_DURATION_DAYS)
  const record: CachedDocumentRecord = {
    documentId, blob, fileName, mimeType, cachedAt: now, expiresAt,
    keepLonger: false, policy: options.policy, tripId: options.tripId ?? null,
    docType: options.docType, label: options.label,
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  const { blob: _blob, ...meta } = record
  return meta
}

export async function getCachedDocument(documentId: string): Promise<CachedDocumentRecord | null> {
  const db = await openDb()
  const result = await new Promise<CachedDocumentRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(documentId)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function removeCachedDocument(documentId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(documentId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * "Offline länger behalten": überschreibt das automatische Löschdatum, indem die
 * Auto-Bereinigung für dieses Dokument ausgesetzt wird. Nur für `'standard'`-
 * Dokumente (Boardingpass/Gepäckbeleg) -- für `'sensitive'` (ESTA/ETA) bewusst
 * ausgeschlossen (Nutzervorgabe: keine Verlängerung), zusätzlich zur UI (die den
 * Button dort gar nicht erst zeigt) auch hier auf Datenebene abgesichert.
 */
export async function keepCachedDocumentLonger(documentId: string): Promise<void> {
  const existing = await getCachedDocument(documentId)
  if (!existing) return
  if (existing.policy === 'sensitive') {
    console.warn('[offline-document-cache] "länger behalten" ist für sensitive Dokumente (ESTA/ETA) nicht erlaubt.')
    return
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ ...existing, keepLonger: true })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * Räumt abgelaufene, nicht "länger behalten"-markierte Einträge auf. Es gibt
 * keinen Hintergrund-Timer (kein Service Worker in dieser Phase) — die
 * Bereinigung läuft best-effort beim nächsten Öffnen einer Seite, die diese
 * Funktion aufruft (z. B. der Boardingpass-Viewer).
 */
export async function pruneExpiredDocuments(): Promise<void> {
  const db = await openDb()
  const now = new Date().toISOString()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const record = cursor.value as CachedDocumentRecord
      if (!record.keepLonger && record.expiresAt < now) cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * §"Löschung bei Logout und bei Reise-Löschung" (Nutzervorgabe, ESTA/ETA-
 * Sonderregeln): entfernt alle `'sensitive'`-Einträge (ESTA/ETA) -- ohne
 * `tripId` global (Logout, siehe components/LogoutButton.tsx), mit `tripId`
 * nur die dieser einen Reise (endgültiges Löschen einer Reise, siehe
 * app/(app)/trips/[id]/delete/page.tsx). Boardingpässe/Gepäckbelege
 * (`'standard'`) bleiben davon unberührt -- deren TTL/"länger behalten"
 * funktioniert unverändert weiter.
 */
export async function purgeSensitiveOfflineDocuments(tripId?: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const record = cursor.value as CachedDocumentRecord
      if (record.policy === 'sensitive' && (!tripId || record.tripId === tripId)) cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * §"Entfernen" im Offline-Bereich (Nutzervorgabe): löscht ALLE `'standard'`-
 * Dokumente (Boardingpass/Gepäckbeleg) einer Reise -- Gegenstück zu
 * `purgeSensitiveOfflineDocuments`, das bewusst nur `'sensitive'` (ESTA/ETA)
 * abdeckt. Wird zusammen mit `purgeSensitiveOfflineDocuments(tripId)` und
 * `removeTripSnapshot(tripId)` aufgerufen, wenn eine Reise komplett aus dem
 * Offline-Bereich entfernt wird.
 */
export async function purgeStandardOfflineDocuments(tripId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const record = cursor.value as CachedDocumentRecord
      if (record.policy === 'standard' && record.tripId === tripId) cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * §"Sichtbarer Dokumentenbereich" (Nutzervorgabe): listet alle gecachten
 * Dokumente (beide Policies) einer Reise -- Meta only, keine Blobs (die
 * werden erst beim tatsächlichen Öffnen über `getCachedDocument` geladen,
 * wie schon bisher in `OfflineDocumentViewer`).
 */
export async function listCachedDocumentsForTrip(tripId: string): Promise<CachedDocumentMeta[]> {
  const db = await openDb()
  const results: CachedDocumentMeta[] = []
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const record = cursor.value as CachedDocumentRecord
      if (record.tripId === tripId) {
        const { blob: _blob, ...meta } = record
        results.push(meta)
      }
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return results
}

/** Speichert/aktualisiert den Reise-Snapshot (Übersicht/Journey/Flüge & Hotels) -- überschreibt einen ggf. bereits vorhandenen Snapshot derselben Reise vollständig ("Aktualisieren"). */
export async function saveTripSnapshot(snapshot: OfflineTripSnapshot): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRIP_SNAPSHOT_STORE_NAME, 'readwrite')
    tx.objectStore(TRIP_SNAPSHOT_STORE_NAME).put(snapshot)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getTripSnapshot(tripId: string): Promise<OfflineTripSnapshot | null> {
  const db = await openDb()
  const result = await new Promise<OfflineTripSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(TRIP_SNAPSHOT_STORE_NAME, 'readonly')
    const req = tx.objectStore(TRIP_SNAPSHOT_STORE_NAME).get(tripId)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

/** §"Nur echte, ausdrücklich gespeicherte Reisen anzeigen" (Nutzervorgabe): einzige Datenquelle für den Offline-Bereich -- rein lesend aus IndexedDB, keine Supabase-Abfrage, keine Demo-/Seed-/Fallback-Reisen können hier je auftauchen, weil ausschließlich das erscheint, was zuvor bewusst per `saveTripSnapshot` gespeichert wurde. */
export async function listTripSnapshots(): Promise<OfflineTripSnapshot[]> {
  const db = await openDb()
  const results = await new Promise<OfflineTripSnapshot[]>((resolve, reject) => {
    const tx = db.transaction(TRIP_SNAPSHOT_STORE_NAME, 'readonly')
    const req = tx.objectStore(TRIP_SNAPSHOT_STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return results.sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))
}

export async function removeTripSnapshot(tripId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRIP_SNAPSHOT_STORE_NAME, 'readwrite')
    tx.objectStore(TRIP_SNAPSHOT_STORE_NAME).delete(tripId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** §"gespeicherte Größe" (Nutzervorgabe): Snapshot-JSON-Größe + Summe der Blob-Größen aller gecachten Dokumente dieser Reise, für eine menschenlesbare Anzeige (z. B. "2,4 MB") in der Offline-Reisen-Liste. */
export async function getOfflineStorageSize(tripId: string): Promise<number> {
  const [snapshot, docs] = await Promise.all([getTripSnapshot(tripId), listCachedDocumentsForTrip(tripId)])
  const snapshotSize = snapshot ? new Blob([JSON.stringify(snapshot)]).size : 0
  const db = await openDb()
  const docSizes = await Promise.all(
    docs.map((d) => new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(d.documentId)
      req.onsuccess = () => resolve((req.result as CachedDocumentRecord | undefined)?.blob.size ?? 0)
      req.onerror = () => reject(req.error)
    })),
  )
  db.close()
  return snapshotSize + docSizes.reduce((sum, s) => sum + s, 0)
}
