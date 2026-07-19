'use client'

import { useEffect, useState } from 'react'
import { Plane, Hotel, Ticket, Luggage, FileCheck2, Trash2 } from 'lucide-react'
import {
  getTripSnapshot, listCachedDocumentsForTrip, removeCachedDocument,
  type OfflineTripSnapshot, type CachedDocumentMeta,
} from '@/lib/offline-document-cache'
import { OfflineDocumentViewer } from '@/components/OfflineDocumentViewer'

type Tab = 'uebersicht' | 'journey' | 'fluege-hotels' | 'dokumente'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'journey', label: 'Journey' },
  { key: 'fluege-hotels', label: 'Flüge & Hotels' },
  { key: 'dokumente', label: 'Dokumente' },
]

const DOC_GROUP_LABELS: Record<CachedDocumentMeta['docType'], string> = {
  boarding_pass: 'Boardingpässe',
  baggage_tag: 'Gepäckbelege',
  esta: 'ESTA',
  eta: 'ETA',
}
const DOC_GROUP_ICONS: Record<CachedDocumentMeta['docType'], typeof Ticket> = {
  boarding_pass: Ticket, baggage_tag: Luggage, esta: FileCheck2, eta: FileCheck2,
}
const DOC_GROUP_ORDER: CachedDocumentMeta['docType'][] = ['boarding_pass', 'baggage_tag', 'esta', 'eta']

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            padding: '10px 12px', fontSize: '0.72rem', letterSpacing: '0.02em',
            color: active === t.key ? 'var(--foreground)' : 'var(--muted)',
            borderBottom: active === t.key ? '2px solid var(--accent)' : '2px solid transparent',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function DocumentRow({ doc, onRemoved }: { doc: CachedDocumentMeta; onRemoved: () => void }) {
  const [open, setOpen] = useState(false);
  const isSensitive = doc.policy === 'sensitive';
  const expiresLabel = isSensitive
    ? `bis ${new Date(doc.expiresAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr`
    : doc.keepLonger ? 'dauerhaft' : `bis ${new Date(doc.expiresAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  return (
    <div className="rounded-lg p-4 mb-2" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div style={{ color: 'var(--foreground)', fontSize: '0.82rem' }}>{doc.label}</div>
          <div className="flex items-center gap-1.5 mt-1" style={{ color: '#4C7A5D', fontSize: '0.66rem' }}>
            Offline verfügbar {expiresLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid rgba(184,154,94,0.4)', borderRadius: '20px', padding: '6px 12px', fontSize: '0.62rem', cursor: 'pointer' }}
          >
            {open ? 'Schließen' : 'Öffnen'}
          </button>
          <button
            type="button"
            onClick={async () => { await removeCachedDocument(doc.documentId); onRemoved(); }}
            aria-label="Offline-Kopie löschen"
            style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 8px', cursor: 'pointer', display: 'flex' }}
          >
            <Trash2 size={13} strokeWidth={1.6} />
          </button>
        </div>
      </div>
      {open && (
        <div className="rounded-lg p-5 mt-3 flex justify-center" style={{ background: '#1a1714' }}>
          <OfflineDocumentViewer
            documentId={doc.documentId}
            sourceUrl={null}
            fileName={doc.fileName}
            mimeType={doc.mimeType}
            isPdf={doc.mimeType === 'application/pdf'}
            referenceDateIso={doc.cachedAt}
            altText={doc.label}
            policy={doc.policy}
            tripId={doc.tripId}
            docType={doc.docType}
            label={doc.label}
          />
        </div>
      )}
    </div>
  );
}

export function OfflineTripDetail({ tripId }: { tripId: string }) {
  const [tab, setTab] = useState<Tab>('uebersicht');
  const [snapshot, setSnapshot] = useState<OfflineTripSnapshot | null | undefined>(undefined);
  const [documents, setDocuments] = useState<CachedDocumentMeta[]>([]);

  async function reloadDocuments() {
    setDocuments(await listCachedDocumentsForTrip(tripId));
  }

  useEffect(() => {
    getTripSnapshot(tripId).then(setSnapshot);
    reloadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  if (snapshot === undefined) {
    return <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Lädt …</p>;
  }
  if (snapshot === null) {
    return (
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          Für diese Reise ist kein Offline-Stand gespeichert.
        </p>
      </div>
    );
  }

  const docsByType = new Map<CachedDocumentMeta['docType'], CachedDocumentMeta[]>();
  for (const d of documents) {
    const list = docsByType.get(d.docType) ?? [];
    list.push(d);
    docsByType.set(d.docType, list);
  }

  return (
    <div>
      <div style={{ color: 'var(--accent)', fontSize: '0.55rem', letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: '10px' }}>
        Offline · {snapshot.statusLabel}
      </div>
      <h1 className="font-light mb-2" style={{ color: 'var(--foreground)', fontSize: 'clamp(1.4rem, 5vw, 1.9rem)', letterSpacing: '-0.01em' }}>
        {snapshot.title}
      </h1>
      <p className="mb-6" style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
        {snapshot.dateRangeLabel}
      </p>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'uebersicht' && (
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {snapshot.subtitle && <p className="mb-3" style={{ color: 'var(--foreground)', fontSize: '0.88rem' }}>{snapshot.subtitle}</p>}
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            {snapshot.dateRangeLabel} · {snapshot.statusLabel}
          </p>
        </div>
      )}

      {tab === 'journey' && (
        snapshot.journeyDays.length > 0 ? (
          <div className="space-y-3">
            {snapshot.journeyDays.map((day) => (
              <div key={day.date} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <span style={{ color: 'var(--foreground)', fontSize: '0.82rem' }}>{day.dateLabel}</span>
                  {day.stageLabel && <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{day.stageLabel}</span>}
                </div>
                {day.items.length > 0 ? (
                  <div className="space-y-1.5">
                    {day.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2" style={{ fontSize: '0.78rem' }}>
                        {item.time && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{item.time}</span>}
                        <span style={{ color: 'var(--foreground)' }}>{item.title}</span>
                        {item.subtitle && <span style={{ color: 'var(--muted)' }}>· {item.subtitle}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>Nichts geplant</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Kein Journey-Zeitplan gespeichert.</p>
        )
      )}

      {tab === 'fluege-hotels' && (
        snapshot.flightsAndHotels.length > 0 ? (
          <div className="space-y-2.5">
            {snapshot.flightsAndHotels.map((b) => {
              const Icon = b.type === 'flight' ? Plane : Hotel;
              return (
                <div key={b.id} className="rounded-xl p-5 flex items-start gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Icon size={16} strokeWidth={1.4} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                  <div className="min-w-0">
                    <div style={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>{b.title}</div>
                    {b.provider && <div style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>{b.provider}</div>}
                    {(b.startLabel || b.endLabel) && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                        {b.startLabel}{b.startLabel && b.endLabel ? ' – ' : ''}{b.endLabel}
                      </div>
                    )}
                    {b.reference && <div style={{ color: 'var(--muted)', fontSize: '0.68rem', marginTop: '2px' }}>Ref. {b.reference}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Keine Flug-/Hotelbuchungen gespeichert.</p>
        )
      )}

      {tab === 'dokumente' && (
        documents.length > 0 ? (
          <div>
            {DOC_GROUP_ORDER.filter((t) => (docsByType.get(t)?.length ?? 0) > 0).map((docType) => {
              const Icon = DOC_GROUP_ICONS[docType];
              return (
                <div key={docType} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={13} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--muted)', fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                      {DOC_GROUP_LABELS[docType]}
                    </span>
                  </div>
                  {docsByType.get(docType)!.map((doc) => (
                    <DocumentRow key={doc.documentId} doc={doc} onRemoved={reloadDocuments} />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Keine Dokumente offline gespeichert.</p>
        )
      )}
    </div>
  );
}
