import { formatDateDE } from '@/lib/demo-data'

export type FlightDateComparisonRow = {
  departureDate: string
  returnDate: string | null
  nights: number | null
  minPrice: number
  currency: string
}

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', color: 'var(--muted)', fontSize: '0.58rem',
  letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 400,
}
const TD: React.CSSProperties = { padding: '10px 14px', color: 'var(--foreground)' }

/**
 * Kompakte Preisübersicht je Datumskombination bei der flexiblen Flugsuche
 * -- reines Rendering der bereits geladenen/bewerteten Daten, keine eigene
 * Neuberechnung von Preisen oder Rängen (die kommt aus `FlightScoringService`).
 */
export function FlightDateComparisonTable({ rows }: { rows: FlightDateComparisonRow[] }) {
  if (rows.length === 0) return null
  const cheapest = Math.min(...rows.map((r) => r.minPrice))
  const sorted = [...rows].sort((a, b) => a.departureDate.localeCompare(b.departureDate))

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={TH}>Hinflug</th>
              <th style={TH}>Rückflug</th>
              <th style={TH}>Nächte</th>
              <th style={TH}>Ab Preis</th>
              <th style={TH}>Differenz</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const delta = Math.round(r.minPrice - cheapest)
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={TD}>{formatDateDE(r.departureDate)}</td>
                  <td style={TD}>{r.returnDate ? formatDateDE(r.returnDate) : '—'}</td>
                  <td style={TD}>{r.nights ?? '—'}</td>
                  <td style={TD}>{Math.round(r.minPrice)} {r.currency}</td>
                  <td style={{ ...TD, color: delta === 0 ? 'var(--accent)' : 'var(--muted)' }}>
                    {delta === 0 ? 'günstigste Variante' : `+${delta} ${r.currency}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
