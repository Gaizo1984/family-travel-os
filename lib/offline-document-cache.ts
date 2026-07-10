/**
 * §8 Offline-Verfügbarkeit für Boardingpässe/Gepäckbelege.
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
 * des Rahmens dieser Phase liegt. Für ein Familien-eigenes Gerät ist das
 * Restrisiko vertretbar, für ein häufig geteiltes Gerät nicht — deshalb bewusst
 * als Opt-in-Cache (erst beim ersten Ansehen) und mit klarer Lösch-Möglichkeit
 * umgesetzt, nicht als automatischer Hintergrund-Download aller Dokumente.
 */

const DB_NAME = 'family-travel-os-offline-cache'
const STORE_NAME = 'documents'
const DB_VERSION = 1
const CACHE_DURATION_DAYS = 7

export type CachedDocumentMeta = {
  documentId: string
  fileName: string
  mimeType: string
  cachedAt: string
  expiresAt: string
  keepLonger: boolean
}

type CachedDocumentRecord = CachedDocumentMeta & { blob: Blob }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'documentId' })
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

/** Speichert die Datei lokal — Ablaufdatum: 7 Tage ab jetzt (Referenzpunkt Flugtag wird beim Aufruf übergeben, falls bekannt). */
export async function cacheDocument(
  documentId: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
  referenceDateIso?: string,
): Promise<CachedDocumentMeta> {
  const db = await openDb()
  const now = new Date().toISOString()
  const expiresAt = addDaysIso(referenceDateIso ?? now, CACHE_DURATION_DAYS)
  const record: CachedDocumentRecord = { documentId, blob, fileName, mimeType, cachedAt: now, expiresAt, keepLonger: false }

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

/** "Offline länger behalten": überschreibt das automatische Löschdatum, indem die Auto-Bereinigung für dieses Dokument ausgesetzt wird. */
export async function keepCachedDocumentLonger(documentId: string): Promise<void> {
  const existing = await getCachedDocument(documentId)
  if (!existing) return
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
