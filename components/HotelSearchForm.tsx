'use client'

import { DateSelectFields } from '@/components/DateSelectFields'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'
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
 * §"Nur Ort, Reisezeitraum und Nächte" (Nutzervorgabe): bewusst schlank
 * gehalten, damit die eigenständige Hotelsuche nicht wie eine verkleinerte
 * Reiseidee wirkt -- Reisende/Zimmer/Budget wurden aus der UI entfernt
 * (die Suche selbst braucht sie nicht, siehe `getOrSearchHotelOptions`;
 * `searchHotelsStandalone` fällt ohne `traveler_ids` automatisch auf die
 * gesamte Familie zurück).
 */
export function HotelSearchForm({
  action, defaultDestination, defaultCheckInIso, defaultNights, ideaId,
}: {
  action: (formData: FormData) => void | Promise<void>
  defaultDestination?: string
  defaultCheckInIso?: string | null
  defaultNights?: string | null
  ideaId?: string | null
}) {
  const range = getDateFieldRange('travel')
  const today = isoToday()

  return (
    <form action={action}>
      {ideaId && <input type="hidden" name="idea_id" value={ideaId} />}

      <div className="mb-5">
        <label style={LABEL_STYLE}>Ort</label>
        <input name="destination" type="text" required defaultValue={defaultDestination} placeholder="z. B. Costa Rica" style={FIELD_STYLE} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <DateSelectFields label="Reisezeitraum (Check-in)" namePrefix="check_in" range={range} quickActions defaultIso={defaultCheckInIso} minIso={today} />
        <div>
          <label style={LABEL_STYLE}>Nächte</label>
          <input name="nights" type="number" min={1} max={90} defaultValue={defaultNights ?? ''} style={FIELD_STYLE} />
        </div>
      </div>

      <label className="flex items-center gap-2 mb-5" style={{ cursor: 'pointer' }}>
        <input type="checkbox" name="force_refresh" />
        <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Ergebnisse neu abrufen (ignoriert einen bereits gespeicherten Suchtreffer für dieses Ziel)</span>
      </label>

      <SubmitButtonWithProgress label="Hotels suchen" pendingLabel="Hotels werden gesucht …" />
    </form>
  )
}
