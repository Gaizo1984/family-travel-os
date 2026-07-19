'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  cacheDocument, getCachedDocument, removeCachedDocument, keepCachedDocumentLonger, pruneExpiredDocuments,
  type OfflineCachePolicy, type CachedDocumentMeta,
} from '@/lib/offline-document-cache'
import { formatDateDE } from '@/lib/demo-data'

type Props = {
  documentId: string
  sourceUrl: string | null
  fileName: string
  mimeType: string
  isPdf: boolean
  referenceDateIso: string
  altText: string
  /** §"Zwei Sicherheitsstufen" (Nutzervorgabe): Default 'standard' -- unverändertes Verhalten für Boardingpass/Gepäckbeleg. 'sensitive' (nur ESTA/ETA) verlangt explizite Zustimmung vor dem ersten Speichern, siehe unten. */
  policy?: OfflineCachePolicy
  /** §"Offline-Bereich, Dokumente-Tab" (Nutzervorgabe): jetzt bei jeder Policy gesetzt, damit das Dokument einer Reise zugeordnet werden kann -- nicht mehr nur für 'sensitive'. */
  tripId?: string | null
  docType: CachedDocumentMeta['docType']
  /** Anzeige-Titel im Offline-Dokumente-Tab (z. B. Personenname oder "Koffer 1"). */
  label: string
}

/**
 * Einzige bewusste Client-Komponente für die Offline-Verfügbarkeit von
 * Boardingpässen/Gepäckbelegen/ESTA/ETA (§8/§9) — IndexedDB ist eine reine
 * Browser-API, dafür ist Client-JS unumgänglich (siehe
 * lib/offline-document-cache.ts für die Architektur- und
 * Sicherheitsbegründung).
 */
export function OfflineDocumentViewer({
  documentId, sourceUrl, fileName, mimeType, isPdf, referenceDateIso, altText,
  policy = 'standard', tripId = null, docType, label,
}: Props) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [keepLonger, setKeepLonger] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [consenting, setConsenting] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      await pruneExpiredDocuments().catch(() => {});
      const cached = await getCachedDocument(documentId).catch(() => null);
      if (cached) {
        objectUrl = URL.createObjectURL(cached.blob);
        if (!cancelled) {
          setDisplayUrl(objectUrl);
          setExpiresAt(cached.expiresAt);
          setKeepLonger(cached.keepLonger);
          setIsCached(true);
        }
        return;
      }
      if (!sourceUrl) {
        if (!cancelled) setLoadFailed(true);
        return;
      }
      try {
        const res = await fetch(sourceUrl);
        const blob = await res.blob();
        // §"explizite Zustimmung vor dem ersten Offline-Speichern" (Nutzervorgabe,
        // nur ESTA/ETA): das Dokument wird trotzdem sofort angezeigt (Online-
        // Objekt-URL direkt aus dem Blob, ohne IndexedDB) -- nur das Zwischen-
        // speichern selbst wartet auf den expliziten Klick unten.
        if (policy === 'sensitive') {
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setDisplayUrl(objectUrl);
            setPendingBlob(blob);
          }
          return;
        }
        const meta = await cacheDocument(documentId, blob, fileName, mimeType, { policy: 'standard', referenceDateIso, tripId, docType, label });
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setDisplayUrl(objectUrl);
          setExpiresAt(meta.expiresAt);
          setKeepLonger(meta.keepLonger);
          setIsCached(true);
        }
      } catch {
        // Offline und noch nicht zwischengespeichert — es bleibt nur die Fehleranzeige.
        if (!cancelled) setLoadFailed(true);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, sourceUrl, fileName, mimeType, referenceDateIso, policy, tripId, docType, label]);

  const handleRemove = useCallback(async () => {
    await removeCachedDocument(documentId);
    setIsCached(false);
    setExpiresAt(null);
    setKeepLonger(false);
    setDisplayUrl(sourceUrl ?? null);
  }, [documentId, sourceUrl]);

  const handleKeepLonger = useCallback(async () => {
    await keepCachedDocumentLonger(documentId);
    setKeepLonger(true);
  }, [documentId]);

  const handleConsentAndCache = useCallback(async () => {
    if (!pendingBlob) return;
    setConsenting(true);
    const meta = await cacheDocument(documentId, pendingBlob, fileName, mimeType, { policy: 'sensitive', tripId, docType, label });
    setExpiresAt(meta.expiresAt);
    setKeepLonger(false);
    setIsCached(true);
    setPendingBlob(null);
    setConsenting(false);
  }, [documentId, pendingBlob, fileName, mimeType, tripId, docType, label]);

  return (
    <div className="flex flex-col items-center">
      {displayUrl ? (
        isPdf ? (
          <iframe
            src={displayUrl}
            title={altText}
            style={{ width: "100%", maxWidth: "560px", height: "70vh", border: "none", borderRadius: "12px", background: "#fff" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={altText}
            style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          />
        )
      ) : loadFailed ? (
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>
          Keine Verbindung und noch nicht lokal gespeichert — bitte einmal online öffnen.
        </p>
      ) : (
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.82rem" }}>Lädt …</p>
      )}

      {/* §"kein Auto-Cache, klare Warnung vor dem Speichern" (Nutzervorgabe, nur ESTA/ETA): erst nach Klick wird tatsächlich lokal gespeichert. */}
      {policy === 'sensitive' && pendingBlob && !isCached && (
        <div className="flex flex-col items-center gap-2 mt-4" style={{ maxWidth: "420px", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", lineHeight: 1.6 }}>
            Dieses Dokument wird bei Bestätigung unverschlüsselt und ausschließlich auf diesem Gerät gespeichert,
            für 24 Stunden ohne automatische Verlängerung. Nutzt auch jemand außerhalb eurer Familie dieses Gerät,
            speichert lieber nicht offline.
          </p>
          <button
            onClick={handleConsentAndCache}
            disabled={consenting}
            style={{
              background: "rgba(255,255,255,0.14)", border: "none", borderRadius: "20px", padding: "7px 16px",
              color: "#fff", fontSize: "0.65rem", cursor: consenting ? "default" : "pointer", opacity: consenting ? 0.6 : 1,
            }}
          >
            {consenting ? "Speichert…" : "Für 24 Stunden offline speichern"}
          </button>
        </div>
      )}

      {isCached && expiresAt && (
        <div className="flex items-center gap-3 flex-wrap justify-center mt-4">
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.68rem", letterSpacing: "0.03em" }}>
            {policy === 'sensitive'
              ? `Offline verfügbar bis ${new Date(expiresAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr`
              : keepLonger ? "Offline dauerhaft verfügbar" : `Offline verfügbar bis ${formatDateDE(expiresAt)}`}
          </span>
          {policy === 'standard' && !keepLonger && (
            <button
              onClick={handleKeepLonger}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "20px", padding: "5px 12px", color: "#fff", fontSize: "0.65rem", cursor: "pointer" }}
            >
              Offline länger behalten
            </button>
          )}
          <button
            onClick={handleRemove}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "20px", padding: "5px 12px", color: "#fff", fontSize: "0.65rem", cursor: "pointer" }}
          >
            Jetzt vom Gerät entfernen
          </button>
        </div>
      )}
    </div>
  );
}
