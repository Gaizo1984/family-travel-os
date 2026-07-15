'use client'

import { useState } from 'react'
import { DateSelectFields } from '@/components/DateSelectFields'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'
import { TravelerChipSelector, type BriefingPerson } from '@/components/TravelerChipSelector'
import { getDateFieldRange } from '@/lib/documents'
import { isoToday } from '@/lib/date-utils'

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px',
}
const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 300, outline: 'none',
}

/**
 * §"Eine echte eigenständige Hotelsuche, unabhängig von einer Reiseidee":
 * funktioniert leer (Kachel auf /discover) genauso wie vorausgefüllt
 * (Deep-Link aus einer Ideen-Detailseite), analog zu `FlightSearchForm`.
 * Check-in/Nächte/Zimmer/Budget fließen NICHT in die eigentliche Places-
 * Suche ein (siehe `getOrSearchHotelOptions`) -- das wird hier transparent
 * kommuniziert, damit niemand eine terminabhängige Verfügbarkeitsprüfung erwartet.
 */
export function HotelSearchForm({
  persons, action, defaultDestination, defaultCheckInIso, defaultNights, defaultTravelerIds, defaultRooms,
  defaultBudgetMin, defaultBudgetMax, ideaId,
}: {
  persons: BriefingPerson[]
  action: (formData: FormData) => void | Promise<void>
  defaultDestination?: string
  defaultCheckInIso?: string | null
  defaultNights?: string | null
  defaultTravelerIds?: string[]
  defaultRooms?: string | null
  defaultBudgetMin?: string | null
  defaultBudgetMax?: string | null
  ideaId?: string | null
}) {
  const [travelerIds, setTravelerIds] = useState<string[]>(defaultTravelerIds ?? [])
  const range = getDateFieldRange('travel')
  const today = isoToday()

  return (
    <form action={action}>
      {ideaId && <input type="hidden" name="idea_id" value={ideaId} />}

      <div className="mb-5">
        <label style={LABEL_STYLE}>Reiseziel / Ort</label>
        <input name="destination" type="text" required defaultValue={defaultDestination} placeholder="z. B. Costa Rica" style={FIELD_STYLE} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <DateSelectFields label="Check-in (optional)" namePrefix="check_in" range={range} quickActions defaultIso={defaultCheckInIso} minIso={today} />
        <div>
          <label style={LABEL_STYLE}>Nächte (optional)</label>
          <input name="nights" type="number" min={1} max={90} defaultValue={defaultNights ?? ''} style={FIELD_STYLE} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label style={LABEL_STYLE}>Zimmer</label>
          <input name="rooms" type="number" min={1} max={10} defaultValue={defaultRooms ?? '1'} style={FIELD_STYLE} />
        </div>
        <div />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label style={LABEL_STYLE}>Budget ab (optional)</label>
          <input name="budget_min" type="number" min={0} defaultValue={defaultBudgetMin ?? ''} placeholder="€" style={FIELD_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE}>Budget bis (optional)</label>
          <input name="budget_max" type="number" min={0} defaultValue={defaultBudgetMax ?? ''} placeholder="€" style={FIELD_STYLE} />
        </div>
      </div>

      <div className="mb-6">
        <label style={LABEL_STYLE}>Wer reist mit?</label>
        <TravelerChipSelector persons={persons} selectedIds={travelerIds} onChange={setTravelerIds} />
      </div>

      <p className="mb-6" style={{ color: 'var(--muted)', fontSize: '0.68rem', fontStyle: 'italic', lineHeight: 1.5 }}>
        Check-in, Nächte, Zimmer und Budget fließen aktuell nicht in die Hotelsuche selbst ein (Google liefert keine
        terminabhängige Verfügbarkeit) -- sie werden für die Preisprüfung bei HolidayCheck vorbereitet.
      </p>

      <SubmitButtonWithProgress label="Hotels suchen" pendingLabel="Hotels werden gesucht …" />
    </form>
  )
}
