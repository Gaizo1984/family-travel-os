'use client'

import { useState } from 'react'

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 16px', background: 'var(--background)',
  border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)',
  fontSize: '0.9rem', fontWeight: 300, outline: 'none',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem',
  letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px',
}

/**
 * Client-Teilkomponente nach dem Muster von StageDateFields.tsx: hält
 * start_date im State, damit das Enddatum-Feld ein `min` bekommen kann
 * (verhindert Ende-vor-Start bereits im Browser, ergänzt die serverseitige
 * Prüfung in lib/actions/bookings.ts).
 */
export function BookingDateFields({
  showEnd,
  startLabel,
  endLabel,
  defaultStartDate,
  defaultStartTime,
  defaultEndDate,
  defaultEndTime,
}: {
  showEnd: boolean
  startLabel: string
  endLabel: string
  defaultStartDate: string
  defaultStartTime: string
  defaultEndDate: string
  defaultEndTime: string
}) {
  const [startDate, setStartDate] = useState(defaultStartDate)

  return (
    <div className={`grid grid-cols-1 ${showEnd ? 'sm:grid-cols-2' : 'sm:grid-cols-2 sm:max-w-md'} gap-4 mb-5`}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="bk-start-date" style={LABEL_STYLE}>{startLabel} *</label>
          <input
            id="bk-start-date" name="start_date" type="date" required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={FIELD_STYLE}
          />
        </div>
        <div>
          <label htmlFor="bk-start-time" style={{ ...LABEL_STYLE, opacity: 0 }}>Zeit</label>
          <input id="bk-start-time" name="start_time" type="time" defaultValue={defaultStartTime} style={FIELD_STYLE} />
        </div>
      </div>
      {showEnd && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="bk-end-date" style={LABEL_STYLE}>{endLabel}</label>
            <input
              id="bk-end-date" name="end_date" type="date"
              defaultValue={defaultEndDate}
              min={startDate || undefined}
              style={FIELD_STYLE}
            />
          </div>
          <div>
            <label htmlFor="bk-end-time" style={{ ...LABEL_STYLE, opacity: 0 }}>Zeit</label>
            <input id="bk-end-time" name="end_time" type="time" defaultValue={defaultEndTime} style={FIELD_STYLE} />
          </div>
        </div>
      )}
    </div>
  )
}
