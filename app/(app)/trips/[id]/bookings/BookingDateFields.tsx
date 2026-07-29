'use client'

import { useState } from 'react'
import { DateSelectFields } from '@/components/DateSelectFields'
import { TripDateField } from '@/components/TripDateField'
import { getDateFieldRange } from '@/lib/documents'
import { TRIP_BOUNDED_BOOKING_TYPES, BOOKING_CATEGORIES } from '@/lib/bookings'
import { defaultTripDayIso } from '@/lib/trip-status'
import type { BookingType } from '@/lib/supabase/types'
import type { StageDateLookupInput } from '@/lib/journey'

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
const NIGHTS_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

function addNightsIso(checkinIso: string, nights: number): string {
  const d = new Date(checkinIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + nights)
  return d.toISOString().slice(0, 10)
}

function nightsBetween(startIso: string, endIso: string): number | null {
  const diff = Math.round((new Date(endIso + 'T00:00:00Z').getTime() - new Date(startIso + 'T00:00:00Z').getTime()) / 86400000)
  return diff > 0 && diff <= NIGHTS_OPTIONS.length ? diff : null
}

/**
 * Nutzt die gemeinsame DateSelectFields-Komponente statt eines eigenen
 * `type="date"`-Inputs (Muster wie StageDateFields.tsx). Die Kopplung
 * Start→Ende (Ende darf nicht vor Start liegen) lässt sich mit
 * <select>-Feldern nicht mehr über ein natives `min`-Attribut erzwingen —
 * das war ohnehin nur eine Browser-Komfortprüfung, die serverseitige
 * Validierung in lib/actions/bookings.ts bleibt unverändert bestehen.
 *
 * §"Reisebezogene Buchungen: eine Datumsauswahl statt drei Dropdowns, auf
 * den Reisezeitraum begrenzt" (Nutzervorgabe, wörtlich): für die in
 * `TRIP_BOUNDED_BOOKING_TYPES` gelisteten Typen (Aktivität, Restaurant,
 * Mietwagen, Transfer, Zug, Fähre, Sonstiges) übernimmt `TripDateField` die
 * Datumsauswahl, sobald der Reisezeitraum bekannt ist. Flug/Unterkunft/
 * Versicherung bleiben bewusst außen vor (spannen den Zeitraum selbst mit
 * auf bzw. haben eigene Gültigkeit) -- für sie bleibt `DateSelectFields`
 * unverändert UND unbegrenzt (kein `minIso`/`maxIso` mehr durchgereicht),
 * auch wenn der Reisezeitraum bekannt ist.
 */
export function BookingDateFields({
  bookingType,
  showEnd,
  startLabel,
  endLabel,
  defaultStartDate,
  defaultStartTime,
  defaultEndDate,
  defaultEndTime,
  showNightsHelper,
  minIso,
  maxIso,
  stages,
}: {
  bookingType: BookingType
  showEnd: boolean
  startLabel: string
  endLabel: string
  defaultStartDate: string
  defaultStartTime: string
  defaultEndDate: string
  defaultEndTime: string
  /**
   * §Hotelerfassung: "Check-in + Nächte eingeben, Check-out automatisch
   * berechnen" -- nur für Unterkünfte aktiviert (BookingForm.tsx). Check-out
   * bleibt zusätzlich frei manuell editierbar ("entweder eintragen oder
   * Dropdown"), das Nächte-Feld ist nur eine Komfort-Hilfe, keine Pflicht.
   */
  showNightsHelper?: boolean
  /** Reisezeitraum -- `null`/`undefined` lässt die Felder wie bisher unbegrenzt (z.B. wenn der Zeitraum noch offen ist). */
  minIso?: string | null
  maxIso?: string | null
  /** Optional: für "· Ort"-Suffix je Reisetag in TripDateField, siehe buildStageByDateMap. */
  stages?: StageDateLookupInput[]
}) {
  const isTripBounded = TRIP_BOUNDED_BOOKING_TYPES.includes(bookingType)
  // §"Flug/Unterkunft/Versicherung nicht mehr auf den Reisezeitraum
  // begrenzen" (heutige Nutzerentscheidung, engt die frühere, für ALLE
  // Buchungsarten geltende Regel bewusst ein): DateSelectFields bekommt für
  // diese drei Typen gar keine Schranken mehr durchgereicht.
  const dateSelectMinIso = isTripBounded ? minIso : undefined
  const dateSelectMaxIso = isTripBounded ? maxIso : undefined
  const marginDays = BOOKING_CATEGORIES.activity.types.includes(bookingType) ? 2 : 0

  const [startIso, setStartIso] = useState<string | null>(defaultStartDate || null)
  const [nights, setNights] = useState<number | null>(
    showNightsHelper && defaultStartDate && defaultEndDate ? nightsBetween(defaultStartDate, defaultEndDate) : null,
  )
  const [endIso, setEndIso] = useState<string | null>(defaultEndDate || null)
  // §Check-out (DateSelectFields) ist unkontrolliert -- ein key-Wechsel
  // remounted es mit dem per Nächte-Dropdown berechneten Datum, ohne die
  // gemeinsame DateSelectFields-Komponente selbst kontrolliert machen zu
  // müssen (die an vielen anderen Stellen unverändert weiterläuft).
  const [endKey, setEndKey] = useState(0)

  function applyNights(n: number | null, fromIso: string | null) {
    setNights(n)
    if (n && fromIso) {
      setEndIso(addNightsIso(fromIso, n))
      setEndKey((k) => k + 1)
    }
  }

  return (
    <div className={`grid grid-cols-1 ${showEnd ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-4 mb-5`}>
      <div>
        {isTripBounded && minIso && maxIso ? (
          <TripDateField
            label={`${startLabel} *`} namePrefix="start_date"
            defaultIso={defaultStartDate || defaultTripDayIso(minIso, maxIso)}
            tripStartIso={minIso} tripEndIso={maxIso} marginDays={marginDays}
            stages={stages} quickActions
            onChange={(iso) => { setStartIso(iso); if (iso && nights) applyNights(nights, iso) }}
          />
        ) : (
          <DateSelectFields
            label={`${startLabel} *`} namePrefix="start_date" defaultIso={defaultStartDate || null}
            range={RANGE} quickActions minIso={dateSelectMinIso} maxIso={dateSelectMaxIso}
            onChange={(iso) => { setStartIso(iso); if (iso && nights) applyNights(nights, iso) }}
          />
        )}
        <label htmlFor="bk-start-time" style={LABEL_STYLE}>Uhrzeit</label>
        <input id="bk-start-time" name="start_time" type="time" defaultValue={defaultStartTime} style={FIELD_STYLE} />
      </div>
      {showEnd && (
        <div>
          {showNightsHelper && (
            <div className="mb-3">
              <label htmlFor="bk-nights-helper" style={LABEL_STYLE}>Nächte (berechnet Check-out)</label>
              <select
                id="bk-nights-helper"
                value={nights ?? ''}
                onChange={(e) => applyNights(e.target.value ? Number(e.target.value) : null, startIso)}
                style={FIELD_STYLE}
              >
                <option value="">— manuell wählen —</option>
                {NIGHTS_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Nacht' : 'Nächte'}</option>
                ))}
              </select>
            </div>
          )}
          {/* §"Mietwagen/Transfer: Rückgabe/Ankunft darf nicht vor Abholung/
              Abfahrt liegen, beide Daten im Reisezeitraum" (Nutzervorgabe,
              wörtlich): `earliestIso` koppelt die untere Schranke des
              Enddatums an das aktuell gewählte Startdatum -- ein Verstoß wird
              (wie Reisezeitraum-Verstöße auch) nie automatisch geändert,
              sondern nur mit Warnung angezeigt (siehe TripDateField). Ende
              bleibt wie bisher optional (kein `required`). */}
          {isTripBounded && minIso && maxIso ? (
            <TripDateField
              key={endKey}
              label={showNightsHelper ? `${endLabel} *` : endLabel} namePrefix="end_date"
              defaultIso={endIso} required={false}
              tripStartIso={minIso} tripEndIso={maxIso} marginDays={0}
              earliestIso={startIso ?? minIso} stages={stages}
            />
          ) : (
            <DateSelectFields
              key={endKey}
              label={showNightsHelper ? `${endLabel} *` : endLabel} namePrefix="end_date" defaultIso={endIso}
              range={RANGE} quickActions minIso={dateSelectMinIso} maxIso={dateSelectMaxIso}
            />
          )}
          <label htmlFor="bk-end-time" style={LABEL_STYLE}>Uhrzeit</label>
          <input id="bk-end-time" name="end_time" type="time" defaultValue={defaultEndTime} style={FIELD_STYLE} />
        </div>
      )}
    </div>
  )
}
