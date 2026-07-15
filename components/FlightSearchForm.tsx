'use client'

import { useState } from 'react'
import { DateSelectFields } from '@/components/DateSelectFields'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'
import { TravelerChipSelector, type BriefingPerson } from '@/components/TravelerChipSelector'
import { getDateFieldRange } from '@/lib/documents'
import { isoToday } from '@/lib/date-utils'
import { countFlexibleDateCombinations } from '@/lib/flight-date-combinations'

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px',
}
const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 300, outline: 'none',
}

export type SearchMode = 'fixed' | 'flexible'

function ChipToggle({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 15px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer',
        background: selected ? 'rgba(184,154,94,0.14)' : 'var(--surface)',
        border: `1px solid ${selected ? 'rgba(184,154,94,0.4)' : 'var(--border)'}`,
        color: selected ? 'var(--foreground)' : 'var(--muted)',
        WebkitAppearance: 'none', appearance: 'none',
      }}
    >
      {children}
    </button>
  )
}

/**
 * §"Eine einzige Flugvergleich-UI": funktioniert leer (Kachel auf /discover)
 * genauso wie vorausgefüllt (Deep-Link von einer Ideen-Detailseite) --
 * steuert das ausschließlich über die `default*`-Props, keine eigene
 * Verzweigungslogik nötig.
 */
export function FlightSearchForm({
  persons, action, defaultDestination, defaultDepartureCity, defaultDepartureIso, defaultReturnIso, defaultTravelerIds, ideaId,
  defaultMode, defaultWindowStartIso, defaultWindowEndIso, defaultNightsMin, defaultNightsMax,
}: {
  persons: BriefingPerson[]
  action: (formData: FormData) => void | Promise<void>
  defaultDestination?: string
  defaultDepartureCity?: string
  defaultDepartureIso?: string | null
  defaultReturnIso?: string | null
  defaultTravelerIds?: string[]
  ideaId?: string | null
  defaultMode?: SearchMode
  defaultWindowStartIso?: string | null
  defaultWindowEndIso?: string | null
  defaultNightsMin?: string | null
  defaultNightsMax?: string | null
}) {
  const [travelerIds, setTravelerIds] = useState<string[]>(defaultTravelerIds ?? [])
  const [searchMode, setSearchMode] = useState<SearchMode>(defaultMode ?? 'fixed')
  const [departureIso, setDepartureIso] = useState<string | null>(defaultDepartureIso ?? null)
  const [windowStartIso, setWindowStartIso] = useState<string | null>(defaultWindowStartIso ?? null)
  const [windowEndIso, setWindowEndIso] = useState<string | null>(defaultWindowEndIso ?? null)
  const [nightsMin, setNightsMin] = useState(defaultNightsMin || '12')
  const [nightsMax, setNightsMax] = useState(defaultNightsMax || '14')
  const range = getDateFieldRange('travel')
  const today = isoToday()

  const { total, capped } = countFlexibleDateCombinations(
    windowStartIso ?? '', windowEndIso ?? '', Number(nightsMin) || 0, Number(nightsMax) || 0,
  )

  return (
    <form action={action}>
      {ideaId && <input type="hidden" name="idea_id" value={ideaId} />}
      <input type="hidden" name="search_mode" value={searchMode} />

      <div className="mb-5">
        <label style={LABEL_STYLE}>Reiseziel</label>
        <input name="destination" type="text" required defaultValue={defaultDestination} placeholder="z. B. Costa Rica" style={FIELD_STYLE} />
      </div>

      <div className="mb-5">
        <label style={LABEL_STYLE}>Abflugort</label>
        <input name="departure_city" type="text" required defaultValue={defaultDepartureCity} placeholder="z. B. Frankfurt" style={FIELD_STYLE} />
      </div>

      <div className="mb-6">
        <label style={LABEL_STYLE}>Wann?</label>
        <div className="flex flex-wrap gap-2">
          <ChipToggle selected={searchMode === 'fixed'} onClick={() => setSearchMode('fixed')}>Feste Reisedaten</ChipToggle>
          <ChipToggle selected={searchMode === 'flexible'} onClick={() => setSearchMode('flexible')}>Flexibler Zeitraum</ChipToggle>
        </div>
      </div>

      {searchMode === 'fixed' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <DateSelectFields
            label="Hinflug" namePrefix="departure_date" range={range} quickActions
            defaultIso={defaultDepartureIso} minIso={today}
            onChange={(iso) => setDepartureIso(iso)}
          />
          <DateSelectFields
            label="Rückflug (optional)" namePrefix="return_date" range={range} quickActions
            defaultIso={defaultReturnIso} minIso={departureIso ?? today}
          />
        </div>
      )}

      {searchMode === 'flexible' && (
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <DateSelectFields
              label="Frühester Abflug" namePrefix="window_start_date" range={range} quickActions
              defaultIso={defaultWindowStartIso} minIso={today}
              onChange={(iso) => setWindowStartIso(iso)}
            />
            <DateSelectFields
              label="Späteste Rückkehr" namePrefix="window_end_date" range={range} quickActions
              defaultIso={defaultWindowEndIso} minIso={windowStartIso ?? today}
              onChange={(iso) => setWindowEndIso(iso)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={LABEL_STYLE}>Nächte ab</label>
              <input
                name="nights_min" type="number" min={1} max={60} required
                value={nightsMin} onChange={(e) => setNightsMin(e.target.value)}
                style={FIELD_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Nächte bis</label>
              <input
                name="nights_max" type="number" min={1} max={60} required
                value={nightsMax} onChange={(e) => setNightsMax(e.target.value)}
                style={FIELD_STYLE}
              />
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.72rem', lineHeight: 1.5 }}>
            {total === 0 && 'Bitte Reisefenster und Nächtezahl wählen, um Datumsvarianten zu berechnen.'}
            {total > 0 && total <= capped && `${total} Datumsvarianten werden geprüft.`}
            {total > 0 && total > capped && (
              <>
                {capped} von {total} möglichen Datumsvarianten werden geprüft, gleichmäßig über das Reisefenster verteilt.
                Weitere Varianten können nach dem ersten Suchlauf gezielt nachgeprüft werden.
              </>
            )}
          </p>
        </div>
      )}

      <div className="mb-6">
        <label style={LABEL_STYLE}>Wer reist mit?</label>
        <TravelerChipSelector persons={persons} selectedIds={travelerIds} onChange={setTravelerIds} />
      </div>

      <SubmitButtonWithProgress label="Flüge suchen" pendingLabel="Flüge werden gesucht …" />
    </form>
  )
}
