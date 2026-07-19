'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2, RefreshCw, ChevronRight } from 'lucide-react'
import {
  listTripSnapshots, removeTripSnapshot, purgeSensitiveOfflineDocuments, purgeStandardOfflineDocuments,
  getOfflineStorageSize, saveTripSnapshot, cacheDocument, getCachedDocument,
  type OfflineTripSnapshot,
} from '@/lib/offline-document-cache'
import { fetchOfflineTripSnapshotData, fetchTripDocumentsForOfflineCache } from '@/lib/actions/offline-trip-snapshot'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Row = { snapshot: OfflineTripSnapshot; size: number }

/** §"nur echte, ausdrücklich gespeicherte Reisen" (Nutzervorgabe): einzige Datenquelle ist IndexedDB (listTripSnapshots) -- keine Supabase-Abfrage, damit hier niemals eine Demo-/Seed-/Fallback-Reise auftauchen kann. */
export function OfflineTripsList() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busyTripId, setBusyTripId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const snapshots = await listTripSnapshots()
    const withSize = await Promise.all(snapshots.map(async (s) => ({ snapshot: s, size: await getOfflineStorageSize(s.tripId) })))
    setRows(withSize)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRemove = useCallback(async (tripId: string) => {
    setBusyTripId(tripId)
    await Promise.all([
      removeTripSnapshot(tripId),
      purgeSensitiveOfflineDocuments(tripId),
      purgeStandardOfflineDocuments(tripId),
    ])
    await load()
    setBusyTripId(null)
  }, [load])

  const handleRefresh = useCallback(async (tripId: string) => {
    setBusyTripId(tripId)
    try {
      const snapshot = await fetchOfflineTripSnapshotData(tripId)
      if (snapshot) {
        await saveTripSnapshot(snapshot)
        const documents = await fetchTripDocumentsForOfflineCache(tripId)
        await Promise.all(documents.map(async (doc) => {
          if (!doc.url) return
          const already = await getCachedDocument(doc.documentId).catch(() => null)
          if (already) return
          try {
            const res = await fetch(doc.url)
            const blob = await res.blob()
            await cacheDocument(doc.documentId, blob, doc.fileName, doc.mimeType, {
              policy: 'standard', referenceDateIso: doc.referenceDateIso, tripId, docType: doc.docType, label: doc.label,
            })
          } catch { /* einzelnes Dokument nicht erreichbar, weiter mit den anderen */ }
        }))
      }
    } catch { /* offline oder Fehler -- gespeicherter Stand bleibt unverändert erhalten */ }
    await load()
    setBusyTripId(null)
  }, [load])

  if (rows === null) {
    return <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Lädt …</p>
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="mb-2" style={{ color: 'var(--foreground)', fontSize: '0.88rem' }}>
          Keine Reise offline gespeichert
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
          Öffne eine Reise online und speichere die benötigten Inhalte für die Offline-Nutzung.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map(({ snapshot, size }) => (
        <div key={snapshot.tripId} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div style={{ color: 'var(--foreground)', fontSize: '0.92rem', marginBottom: '3px' }}>{snapshot.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                Aktualisiert {formatTimestamp(snapshot.cachedAt)} · {formatSize(size)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/mehr/offline-reisen/${snapshot.tripId}`}
              className="flex items-center gap-1"
              style={{
                background: 'var(--foreground)', color: 'var(--surface)', border: 'none', borderRadius: '20px',
                padding: '7px 14px', fontSize: '0.66rem', textDecoration: 'none',
              }}
            >
              Reise öffnen <ChevronRight size={12} strokeWidth={1.8} />
            </Link>
            <button
              type="button"
              onClick={() => handleRefresh(snapshot.tripId)}
              disabled={busyTripId === snapshot.tripId}
              className="flex items-center gap-1.5"
              style={{
                background: 'transparent', color: 'var(--accent)', border: '1px solid rgba(184,154,94,0.4)',
                borderRadius: '20px', padding: '7px 14px', fontSize: '0.66rem', cursor: 'pointer',
                opacity: busyTripId === snapshot.tripId ? 0.6 : 1,
              }}
            >
              <RefreshCw size={12} strokeWidth={1.6} /> Aktualisieren
            </button>
            <button
              type="button"
              onClick={() => handleRemove(snapshot.tripId)}
              disabled={busyTripId === snapshot.tripId}
              className="flex items-center gap-1.5"
              style={{
                background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
                borderRadius: '20px', padding: '7px 14px', fontSize: '0.66rem', cursor: 'pointer',
                opacity: busyTripId === snapshot.tripId ? 0.6 : 1,
              }}
            >
              <Trash2 size={12} strokeWidth={1.6} /> Entfernen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
