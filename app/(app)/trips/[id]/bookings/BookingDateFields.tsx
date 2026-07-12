'use client'

import { DateSelectFields } from '@/components/DateSelectFields'
import { getDateFieldRange } from '@/lib/documents'

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '14px 16px', background: 'var(--background)',
  border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)',
  fontSize: '0.9rem', fontWeight: 300, outline: 'none',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem',
  letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px',
}

const RANGE = getDateFieldRange('travel')

/**
 * Nutzt die gemeinsame DateSelectFields-Komponente statt eines eigenen
 * `type="date"`-Inputs (Muster wie StageDateFields.tsx). Die Kopplung
 * Start→Ende (Ende darf nicht vor Start liegen) lässt sich mit
 * <select>-Feldern nicht mehr über ein natives `min`-Attribut erzwingen —
 * das war ohnehin nur eine Browser-Komfortprüfung, die serverseitige
 * Validierung in lib/actions/bookings.ts bleibt unverändert bestehen.
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
  return (
    <div className={`grid grid-cols-1 ${showEnd ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-4 mb-5`}>
      <div>
        <DateSelectFields
          label={`${startLabel} *`} namePrefix="start_date" defaultIso={defaultStartDate || null}
          range={RANGE} quickActions
        />
        <label htmlFor="bk-start-time" style={LABEL_STYLE}>Uhrzeit</label>
        <input id="bk-start-time" name="start_time" type="time" defaultValue={defaultStartTime} style={FIELD_STYLE} />
      </div>
      {showEnd && (
        <div>
          <DateSelectFields
            label={endLabel} namePrefix="end_date" defaultIso={defaultEndDate || null}
            range={RANGE} quickActions
          />
          <label htmlFor="bk-end-time" style={LABEL_STYLE}>Uhrzeit</label>
          <input id="bk-end-time" name="end_time" type="time" defaultValue={defaultEndTime} style={FIELD_STYLE} />
        </div>
      )}
    </div>
  )
}
