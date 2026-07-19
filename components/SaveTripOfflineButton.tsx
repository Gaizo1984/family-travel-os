'use client'

import { useState } from 'react'
import { CloudDownload, Check } from 'lucide-react'
import { fetchOfflineTripSnapshotData, fetchTripDocumentsForOfflineCache } from '@/lib/actions/offline-trip-snapshot'
import { saveTripSnapshot, cacheDocument, getCachedDocument } from '@/lib/offline-document-cache'

/**
 * §"Für Offline speichern" (Nutzervorgabe, kombinierter Fix-Sprint): einziger
 * Auslöser für einen Reise-Snapshot. Holt Übersicht/Journey/Flüge & Hotels
 * server-seitig (fetchOfflineTripSnapshotData), schreibt sie client-seitig in
 * IndexedDB (saveTripSnapshot), und cached zusätzlich alle vorhandenen
 * Boardingpässe/Gepäckbelege dieser Reise in einem Rutsch (policy:
 * 'standard', kein Zustimmungsschritt -- exakt das bestehende Verhalten aus
 * OfflineDocumentViewer, nur gebündelt statt einzeln beim Ansehen). ESTA/ETA
 * bleiben bewusst außen vor (weiterhin nur einzeln, mit Zustimmung).
 * Einzelne fehlgeschlagene Dokument-Downloads brechen das Gesamt-Speichern
 * nicht ab -- best effort, die Reise bleibt trotzdem nutzbar offline.
 */
export function SaveTripOfflineButton({ tripId }: { tripId: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function handleSave() {
    setState('saving')
    try {
      const snapshot = await fetchOfflineTripSnapshotData(tripId)
      if (!snapshot) {
        setState('error')
        return
      }
      await saveTripSnapshot(snapshot)

      const documents = await fetchTripDocumentsForOfflineCache(tripId)
      await Promise.all(
        documents.map(async (doc) => {
          if (!doc.url) return
          const already = await getCachedDocument(doc.documentId).catch(() => null)
          if (already) return
          try {
            const res = await fetch(doc.url)
            const blob = await res.blob()
            await cacheDocument(doc.documentId, blob, doc.fileName, doc.mimeType, {
              policy: 'standard', referenceDateIso: doc.referenceDateIso, tripId, docType: doc.docType, label: doc.label,
            })
          } catch {
            // Einzelnes Dokument nicht erreichbar -- Reise-Speichern trotzdem fortsetzen.
          }
        }),
      )

      // §"App-Shell für diese Offline-Route sofort verfügbar machen"
      // (Nutzervorgabe): primt den Service-Worker-Cache (public/sw.js) direkt
      // nach dem Speichern, statt darauf zu warten, dass die Familie beide
      // Seiten zufällig einmal online besucht -- rein informative Requests,
      // ihr Ergebnis wird hier nicht ausgewertet. Schlägt das Priming fehl
      // (z. B. weil der Service Worker noch nicht registriert ist), bleibt
      // "Für Offline speichern" trotzdem erfolgreich -- die Seite lädt dann
      // erst offline-fähig, sobald sie einmal online besucht wurde.
      fetch('/mehr/offline-reisen').catch(() => {})
      fetch(`/mehr/offline-reisen/${tripId}`).catch(() => {})

      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={state === 'saving'}
      className="flex items-center gap-2"
      style={{
        background: state === 'done' ? 'rgba(76,122,93,0.12)' : 'transparent',
        color: state === 'done' ? '#4C7A5D' : 'var(--accent)',
        border: `1px solid ${state === 'done' ? 'rgba(76,122,93,0.35)' : 'rgba(184,154,94,0.4)'}`,
        borderRadius: '20px', padding: '8px 16px', fontSize: '0.68rem', letterSpacing: '0.04em',
        cursor: state === 'saving' ? 'default' : 'pointer', opacity: state === 'saving' ? 0.7 : 1,
      }}
    >
      {state === 'done' ? <Check size={13} strokeWidth={1.8} /> : <CloudDownload size={13} strokeWidth={1.6} />}
      {state === 'saving' ? 'Speichert…' : state === 'done' ? 'Für Offline gespeichert' : state === 'error' ? 'Fehlgeschlagen – erneut versuchen' : 'Für Offline speichern'}
    </button>
  )
}
