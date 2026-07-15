'use client'

import { useState } from 'react'
import { DateSelectFields } from '@/components/DateSelectFields'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'
import { TravelerChipSelector, type BriefingPerson } from '@/components/TravelerChipSelector'
import { getDateFieldRange } from '@/lib/documents'

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px',
}
const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 300, outline: 'none',
}

/**
 * §"Eine einzige Flugvergleich-UI": funktioniert leer (Kachel auf /discover)
 * genauso wie vorausgefüllt (Deep-Link von einer Ideen-Detailseite) --
 * steuert das ausschließlich über die `default*`-Props, keine eigene
 * Verzweigungslogik nötig.
 */
export function FlightSearchForm({
  persons, action, defaultDestination, defaultDepartureCity, defaultDepartureIso, defaultReturnIso, defaultTravelerIds, ideaId,
}: {
  persons: BriefingPerson[]
  action: (formData: FormData) => void | Promise<void>
  defaultDestination?: string
  defaultDepartureCity?: string
  defaultDepartureIso?: string | null
  defaultReturnIso?: string | null
  defaultTravelerIds?: string[]
  ideaId?: string | null
}) {
  const [travelerIds, setTravelerIds] = useState<string[]>(defaultTravelerIds ?? [])
  const range = getDateFieldRange('travel')

  return (
    <form action={action}>
      {ideaId && <input type="hidden" name="idea_id" value={ideaId} />}

      <div className="mb-5">
        <label style={LABEL_STYLE}>Reiseziel</label>
        <input name="destination" type="text" required defaultValue={defaultDestination} placeholder="z. B. Costa Rica" style={FIELD_STYLE} />
      </div>

      <div className="mb-5">
        <label style={LABEL_STYLE}>Abflugort</label>
        <input name="departure_city" type="text" required defaultValue={defaultDepartureCity} placeholder="z. B. Frankfurt" style={FIELD_STYLE} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <DateSelectFields label="Hinflug" namePrefix="departure_date" range={range} quickActions defaultIso={defaultDepartureIso} />
        <DateSelectFields label="Rückflug (optional)" namePrefix="return_date" range={range} quickActions defaultIso={defaultReturnIso} />
      </div>

      <div className="mb-6">
        <label style={LABEL_STYLE}>Wer reist mit?</label>
        <TravelerChipSelector persons={persons} selectedIds={travelerIds} onChange={setTravelerIds} />
      </div>

      <SubmitButtonWithProgress label="Flüge suchen" pendingLabel="Flüge werden gesucht …" />
    </form>
  )
}
