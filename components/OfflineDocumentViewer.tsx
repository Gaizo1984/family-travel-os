'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  cacheDocument, getCachedDocument, removeCachedDocument, keepCachedDocumentLonger, pruneExpiredDocuments,
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
}

/**
 * Einzige bewusste Client-Komponente für die Offline-Verfügbarkeit von
 * Boardingpässen/Gepäckbelegen (§8) — IndexedDB ist eine reine Browser-API,
 * dafür ist Client-JS unumgänglich (siehe lib/offline-document-cache.ts für
 * die Architektur- und Sicherheitsbegründung).
 */
export function OfflineDocumentViewer({ documentId, sourceUrl, fileName, mimeType, isPdf, referenceDateIso, altText }: Props) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [keepLonger, setKeepLonger] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

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
        const meta = await cacheDocument(documentId, blob, fileName, mimeType, referenceDateIso);
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
  }, [documentId, sourceUrl, fileName, mimeType, referenceDateIso]);

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

      {isCached && expiresAt && (
        <div className="flex items-center gap-3 flex-wrap justify-center mt-4">
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.68rem", letterSpacing: "0.03em" }}>
            {keepLonger ? "Offline dauerhaft verfügbar" : `Offline verfügbar bis ${formatDateDE(expiresAt)}`}
          </span>
          {!keepLonger && (
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
