'use client'

import { useState } from 'react'

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 16px', background: 'var(--background)',
  border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)',
  fontSize: '0.85rem', outline: 'none',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem',
  letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px',
}

function computeNights(start: string, end: string): number | null {
  if (!start || !end) return null
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

export function StageDateFields({
  defaultStartDate = '',
  defaultEndDate = '',
}: {
  defaultStartDate?: string
  defaultEndDate?: string
}) {
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const nights = computeNights(startDate, endDate)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <div>
        <label htmlFor="stage-start" style={LABEL_STYLE}>Von</label>
        <input
          id="stage-start"
          name="start_date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={FIELD_STYLE}
        />
      </div>
      <div>
        <label htmlFor="stage-end" style={LABEL_STYLE}>Bis</label>
        <input
          id="stage-end"
          name="end_date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={FIELD_STYLE}
        />
      </div>
      <div>
        <span style={LABEL_STYLE}>Nächte</span>
        <div style={{ ...FIELD_STYLE, color: 'var(--muted)' }}>
          {nights !== null ? `${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}` : '—'}
        </div>
      </div>
    </div>
  )
}
