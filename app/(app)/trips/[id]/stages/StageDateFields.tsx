'use client'

import { useState } from 'react'
import { DateSelectFields } from '@/components/DateSelectFields'
import { getDateFieldRange } from '@/lib/documents'

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem',
  letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px',
}
const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '14px 16px', background: 'var(--background)',
  border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)',
  fontSize: '0.85rem', outline: 'none',
}

function computeNights(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

const RANGE = getDateFieldRange('travel')

export function StageDateFields({
  defaultStartDate = '',
  defaultEndDate = '',
}: {
  defaultStartDate?: string
  defaultEndDate?: string
}) {
  const [startIso, setStartIso] = useState<string | null>(defaultStartDate || null)
  const [endIso, setEndIso] = useState<string | null>(defaultEndDate || null)
  const nights = computeNights(startIso, endIso)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <DateSelectFields
        label="Von" namePrefix="start_date" defaultIso={defaultStartDate || null}
        range={RANGE} quickActions onChange={(iso) => setStartIso(iso)}
      />
      <DateSelectFields
        label="Bis" namePrefix="end_date" defaultIso={defaultEndDate || null}
        range={RANGE} quickActions onChange={(iso) => setEndIso(iso)}
      />
      <div>
        <span style={LABEL_STYLE}>Nächte</span>
        <div style={{ ...FIELD_STYLE, color: 'var(--muted)' }}>
          {nights !== null ? `${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}` : '—'}
        </div>
      </div>
    </div>
  )
}
