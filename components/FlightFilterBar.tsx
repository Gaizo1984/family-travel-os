'use client'

import { useMemo, useState } from 'react'
import { FlightCard } from '@/components/FlightCard'
import type { FlightSearchOption } from '@/lib/flight-types'

const CHIP_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: '20px', fontSize: '0.72rem', cursor: 'pointer',
  background: active ? 'rgba(184,154,94,0.14)' : 'var(--surface)',
  border: `1px solid ${active ? 'rgba(184,154,94,0.4)' : 'var(--border)'}`,
  color: active ? 'var(--foreground)' : 'var(--muted)',
})

/**
 * §"LUMI Flight Score zentral, UI rendert nur das Ergebnis": filtert
 * ausschließlich die bereits vom `FlightScoringService` bewerteten/
 * sortierten Optionen -- kein Neuberechnen von Badges/Reihenfolge, keine
 * neuen API-Aufrufe. Reines clientseitiges Ein-/Ausblenden der bereits
 * geladenen Liste.
 */
export function FlightFilterBar({
  options, isSandboxData, providerName, searchedAt,
}: {
  options: FlightSearchOption[]
  isSandboxData: boolean
  /** §"Kein eigener Test-/Live-Codepfad in der UI": Anzeigename kommt providerneutral von außen -- keine Duffel-Sonderlogik in dieser Komponente. */
  providerName: string
  searchedAt: string
}) {
  const [directOnly, setDirectOnly] = useState(false)
  const [maxOneStop, setMaxOneStop] = useState(false)
  const [baggageOnly, setBaggageOnly] = useState(false)

  const maxPriceOverall = useMemo(() => Math.max(...options.map((o) => o.price), 0), [options])
  const maxDurationOverall = useMemo(() => Math.max(...options.map((o) => o.totalDurationMinutes), 0), [options])
  const [maxPrice, setMaxPrice] = useState<number>(maxPriceOverall)
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number>(maxDurationOverall)

  const filtered = options.filter((o) => {
    if (directOnly && o.maxStopCount > 0) return false
    if (maxOneStop && o.maxStopCount > 1) return false
    if (baggageOnly && o.checkedBaggageStatus !== 'included') return false
    if (o.price > maxPrice) return false
    if (o.totalDurationMinutes > maxDurationMinutes) return false
    return true
  })

  return (
    <div>
      {isSandboxData && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(181,98,74,0.12)', border: '1px solid rgba(181,98,74,0.35)' }}>
          <p style={{ color: '#B5624A', fontSize: '0.75rem', lineHeight: 1.5 }}>
            {providerName}-Testdaten – keine echten Livepreise.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <span onClick={() => setDirectOnly((v) => !v)} style={CHIP_STYLE(directOnly)}>Direktflug</span>
        <span onClick={() => setMaxOneStop((v) => !v)} style={CHIP_STYLE(maxOneStop)}>Max. 1 Umstieg</span>
        <span onClick={() => setBaggageOnly((v) => !v)} style={CHIP_STYLE(baggageOnly)}>Gepäck inklusive</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Preis bis {Math.round(maxPrice)} {options[0]?.currency ?? ''}
          </label>
          <input
            type="range" min={0} max={Math.ceil(maxPriceOverall)} value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Reisezeit bis {Math.floor(maxDurationMinutes / 60)}h {maxDurationMinutes % 60}min
          </label>
          <input
            type="range" min={0} max={Math.ceil(maxDurationOverall)} value={maxDurationMinutes}
            onChange={(e) => setMaxDurationMinutes(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>Keine Flüge entsprechen den aktuellen Filtern.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((o) => <FlightCard key={o.id} option={o} searchedAt={searchedAt} />)}
        </div>
      )}

      <p className="mt-4" style={{ color: 'var(--muted)', fontSize: '0.65rem', fontStyle: 'italic' }}>
        Echte Flugsuchergebnisse, keine Sitzplatz-/Verfügbarkeitsgarantie zum Buchungszeitpunkt.
      </p>
    </div>
  )
}
