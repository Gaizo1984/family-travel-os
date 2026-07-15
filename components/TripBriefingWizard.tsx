'use client'

import { useState } from 'react'
import { DateSelectFields } from '@/components/DateSelectFields'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'
import { getDateFieldRange } from '@/lib/documents'
import {
  CLIMATE_PREFERENCE_LABELS, CLIMATE_PREFERENCE_ORDER, type ClimatePreference,
  TRIP_TYPE_PREFERENCE_LABELS, TRIP_TYPE_PREFERENCE_ORDER, type TripTypePreference,
  STOPOVER_PREFERENCE_LABELS, STOPOVER_PREFERENCE_ORDER, type StopoverPreference,
  TRAVEL_DATE_MODE_LABELS, TRAVEL_DATE_MODE_ORDER, type TravelDateMode,
} from '@/lib/travel-preferences'

export type BriefingPerson = { id: string; name: string; birth_date: string | null; is_minor: boolean }

const STEP_LABELS = ['Wer reist?', 'Wann?', 'Welche Reise?', 'Klima & Anreise', 'Budget & Ausschlüsse', 'Zusammenfassung']

const LABEL_STYLE: React.CSSProperties = {
  color: 'var(--muted)', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px',
}
const FIELD_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--foreground)', fontSize: '0.82rem', fontWeight: 300, outline: 'none',
}
const SHORTCUT_STYLE: React.CSSProperties = {
  fontSize: '0.65rem', color: 'var(--accent)', background: 'var(--background)', border: '1px solid var(--border)',
  padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
}

/** Nur für den "Familie ohne Baby"-Shortcut -- reine UI-Schwelle, keine Reisebedürfnis-Logik. */
function isBaby(p: BriefingPerson): boolean {
  if (!p.birth_date) return false
  const ageYears = (Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)
  return ageYears < 2
}

function computeNights(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-light mb-5" style={{ color: 'var(--foreground)', fontSize: '1.1rem', letterSpacing: '0.01em' }}>{children}</h3>
}

export function TripBriefingWizard({ persons, action, children }: { persons: BriefingPerson[]; action: (formData: FormData) => void | Promise<void>; children?: React.ReactNode }) {
  const [step, setStep] = useState(0)
  const [wishTextError, setWishTextError] = useState(false)

  const [travelerIds, setTravelerIds] = useState<string[]>([])
  const [dateMode, setDateMode] = useState<TravelDateMode>('flexible')
  const [startIso, setStartIso] = useState<string | null>(null)
  const [endIso, setEndIso] = useState<string | null>(null)
  const [periodText, setPeriodText] = useState('')
  const [nightsMin, setNightsMin] = useState('')
  const [nightsMax, setNightsMax] = useState('')
  const [tripType, setTripType] = useState<TripTypePreference | ''>('')
  const [climate, setClimate] = useState<ClimatePreference | ''>('')
  const [rainRiskTolerant, setRainRiskTolerant] = useState(false)
  const [maxStopovers, setMaxStopovers] = useState('')
  const [stopoverPref, setStopoverPref] = useState<StopoverPreference | ''>('')
  const [departureCity, setDepartureCity] = useState('')
  const [includesFlights, setIncludesFlights] = useState(false)
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState('EUR')
  const [excludedDestinationsText, setExcludedDestinationsText] = useState('')
  const [avoidPastDestinations, setAvoidPastDestinations] = useState(true)
  const [excludedTripTypes, setExcludedTripTypes] = useState<TripTypePreference[]>([])
  const [excludedClimates, setExcludedClimates] = useState<ClimatePreference[]>([])

  const dateRange = getDateFieldRange('travel')
  const exactNights = computeNights(startIso, endIso)

  function toggleTraveler(id: string) {
    setTravelerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function toggleInArray<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]))
  }

  function applyRelaxedArrival() {
    setStopoverPref('ausgeschlossen')
    setMaxStopovers('0')
  }

  const canGoNext = step !== 0 || travelerIds.length > 0
  const isLastStep = step === STEP_LABELS.length - 1

  const personById = new Map(persons.map((p) => [p.id, p]))

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // §"Nichts passiert beim Absenden": der Reisewunsch (Freitext oben,
        // außerhalb der Wizard-Schritte) trägt `required`, aber das blockiert
        // native/lautlos ohne sichtbare Rückmeldung, sobald das Feld komplett
        // leer ist -- besonders leicht übersehen, da es oberhalb des ganzen
        // Wizards sitzt. Eigene, sichtbare Prüfung statt stiller Blockade.
        const wishText = String(new FormData(e.currentTarget).get('wish_text') ?? '').trim()
        if (wishText.length < 10) {
          e.preventDefault()
          setWishTextError(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          setWishTextError(false)
        }
      }}
    >
      <input type="hidden" name="travel_date_mode" value={dateMode} />

      {children}

      {wishTextError && (
        <div className="mb-6 px-4 py-3 rounded-lg" style={{ background: 'rgba(181,98,74,0.12)', border: '1px solid rgba(181,98,74,0.35)' }}>
          <p style={{ color: '#B5624A', fontSize: '0.78rem', lineHeight: 1.5 }}>
            Bitte oben euren Reisewunsch in ein paar Worten beschreiben, bevor ihr Ideen generieren könnt.
          </p>
        </div>
      )}

      {/* ── Fortschrittsanzeige ── */}
      <div className="flex gap-1 mb-2">
        {STEP_LABELS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= step ? 'var(--accent)' : 'var(--border)' }} />
        ))}
      </div>
      <div className="mb-6" style={{ color: 'var(--muted)', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Schritt {step + 1} von {STEP_LABELS.length} · {STEP_LABELS[step]}
      </div>

      <div className="rounded-xl p-6 md:p-8 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* 1. Wer reist? */}
        <div style={{ display: step === 0 ? 'block' : 'none' }}>
          <SectionTitle>Wer reist mit?</SectionTitle>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" style={SHORTCUT_STYLE} onClick={() => setTravelerIds(persons.map((p) => p.id))}>Alle</button>
            <button type="button" style={SHORTCUT_STYLE} onClick={() => setTravelerIds(persons.filter((p) => !p.is_minor).map((p) => p.id))}>Nur Erwachsene</button>
            <button type="button" style={SHORTCUT_STYLE} onClick={() => setTravelerIds(persons.filter((p) => !isBaby(p)).map((p) => p.id))}>Familie ohne Baby</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {persons.map((p) => (
              <label key={p.id}>
                <input type="checkbox" name="traveler_ids" value={p.id} checked={travelerIds.includes(p.id)} onChange={() => toggleTraveler(p.id)} className="sr-only" />
                <ChipToggle selected={travelerIds.includes(p.id)} onClick={() => toggleTraveler(p.id)}>{p.name}</ChipToggle>
              </label>
            ))}
          </div>
          {travelerIds.length === 0 && (
            <p className="mt-4" style={{ color: 'var(--muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>Bitte mindestens einen Reisenden auswählen.</p>
          )}
        </div>

        {/* 2. Wann? */}
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <SectionTitle>Wann soll es losgehen?</SectionTitle>
          <div className="flex flex-wrap gap-2 mb-6">
            {TRAVEL_DATE_MODE_ORDER.map((mode) => (
              <ChipToggle key={mode} selected={dateMode === mode} onClick={() => setDateMode(mode)}>{TRAVEL_DATE_MODE_LABELS[mode]}</ChipToggle>
            ))}
          </div>

          {dateMode === 'exact' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                <DateSelectFields label="Von" namePrefix="start_date" range={dateRange} quickActions onChange={(iso) => setStartIso(iso)} />
                <DateSelectFields label="Bis" namePrefix="end_date" range={dateRange} quickActions onChange={(iso) => setEndIso(iso)} />
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                Nächte: {exactNights !== null ? `${exactNights} ${exactNights === 1 ? 'Nacht' : 'Nächte'}` : '—'} (automatisch berechnet)
              </p>
            </>
          )}

          {(dateMode === 'month' || dateMode === 'school_holiday') && (
            <div className="mb-5">
              <label style={LABEL_STYLE}>{dateMode === 'school_holiday' ? 'Welche Ferien?' : 'Welcher Monat?'}</label>
              <input
                name="travel_period_text" type="text" value={periodText} onChange={(e) => setPeriodText(e.target.value)}
                placeholder={dateMode === 'school_holiday' ? 'z. B. Herbstferien 2027' : 'z. B. August 2027'}
                style={FIELD_STYLE}
              />
            </div>
          )}

          {(dateMode === 'month' || dateMode === 'school_holiday' || dateMode === 'flexible') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={LABEL_STYLE}>Nächte (min.)</label>
                <input name="nights_min" type="number" min="1" value={nightsMin} onChange={(e) => setNightsMin(e.target.value)} placeholder="z. B. 10" style={FIELD_STYLE} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Nächte (max.)</label>
                <input name="nights_max" type="number" min="1" value={nightsMax} onChange={(e) => setNightsMax(e.target.value)} placeholder="z. B. 14" style={FIELD_STYLE} />
              </div>
            </div>
          )}

          {dateMode === 'open' && (
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>Der Reisezeitraum wird später festgelegt.</p>
          )}
        </div>

        {/* 3. Welche Reise? */}
        <div style={{ display: step === 2 ? 'block' : 'none' }}>
          <SectionTitle>Welche Art von Reise?</SectionTitle>
          <label style={LABEL_STYLE}>Reiseart</label>
          <div className="flex flex-wrap gap-2 mb-6">
            {TRIP_TYPE_PREFERENCE_ORDER.map((t) => (
              <label key={t}>
                <input type="radio" name="trip_type_preference" value={t} checked={tripType === t} onChange={() => setTripType(t)} className="sr-only" />
                <ChipToggle selected={tripType === t} onClick={() => setTripType(t)}>{TRIP_TYPE_PREFERENCE_LABELS[t]}</ChipToggle>
              </label>
            ))}
          </div>
          <label style={LABEL_STYLE}>Klimawunsch</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {CLIMATE_PREFERENCE_ORDER.map((c) => (
              <label key={c}>
                <input type="radio" name="climate_preference" value={c} checked={climate === c} onChange={() => setClimate(c)} className="sr-only" />
                <ChipToggle selected={climate === c} onClick={() => setClimate(c)}>{CLIMATE_PREFERENCE_LABELS[c]}</ChipToggle>
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="rain_risk_tolerant" checked={rainRiskTolerant} onChange={(e) => setRainRiskTolerant(e.target.checked)} style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }} />
            <span style={{ color: 'var(--foreground)', fontSize: '0.8rem' }}>Ein gewisses Regenrisiko ist für uns akzeptabel</span>
          </label>
        </div>

        {/* 4. Klima & Anreise */}
        <div style={{ display: step === 3 ? 'block' : 'none' }}>
          <SectionTitle>Anreise</SectionTitle>
          <p className="mb-5" style={{ color: 'var(--muted)', fontSize: '0.75rem', lineHeight: 1.6 }}>
            Wie viel Flugzeit und wie viele Zwischenstopps sind für euch in Ordnung?
          </p>
          <div className="mb-5">
            <button type="button" style={SHORTCUT_STYLE} onClick={applyRelaxedArrival}>Entspannte Anreise (keine Stopovers)</button>
          </div>
          <label style={LABEL_STYLE}>Stopover-Präferenz</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {STOPOVER_PREFERENCE_ORDER.map((s) => (
              <label key={s}>
                <input type="radio" name="stopover_preference" value={s} checked={stopoverPref === s} onChange={() => setStopoverPref(s)} className="sr-only" />
                <ChipToggle selected={stopoverPref === s} onClick={() => setStopoverPref(s)}>{STOPOVER_PREFERENCE_LABELS[s]}</ChipToggle>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label style={LABEL_STYLE}>Max. Umstiege</label>
              <input name="max_stopovers" type="number" min="0" value={maxStopovers} onChange={(e) => setMaxStopovers(e.target.value)} placeholder="z. B. 1" style={FIELD_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Abflugort</label>
              <input name="departure_city" type="text" value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} placeholder="z. B. Frankfurt" style={FIELD_STYLE} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="includes_flights" checked={includesFlights} onChange={(e) => setIncludesFlights(e.target.checked)} style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }} />
            <span style={{ color: 'var(--foreground)', fontSize: '0.8rem' }}>Budget soll Flüge einschließen</span>
          </label>
        </div>

        {/* 5. Budget & Ausschlüsse */}
        <div style={{ display: step === 4 ? 'block' : 'none' }}>
          <SectionTitle>Budget & Ausschlüsse</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <div>
              <label style={LABEL_STYLE}>Budget von</label>
              <input name="budget_min" type="number" min="0" step="100" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} style={FIELD_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Budget bis</label>
              <input name="budget_max" type="number" min="0" step="100" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} style={FIELD_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Währung</label>
              <select name="budget_currency" value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} style={FIELD_STYLE}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="CHF">CHF</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <p className="mb-6" style={{ color: 'var(--accent)', fontSize: '0.72rem', fontStyle: 'italic' }}>
            Standard ist gehobenes 5-Sterne-Niveau (Westin, Le Méridien oder vergleichbar).
          </p>

          <div className="mb-5">
            <label style={LABEL_STYLE}>Ausschlussländer/-regionen</label>
            <input
              name="excluded_destinations_text" type="text" value={excludedDestinationsText}
              onChange={(e) => setExcludedDestinationsText(e.target.value)}
              placeholder="z. B. Thailand, Karibik (kommagetrennt)"
              style={FIELD_STYLE}
            />
          </div>

          <label className="mb-5" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="avoid_past_destinations" checked={avoidPastDestinations} onChange={(e) => setAvoidPastDestinations(e.target.checked)} style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }} />
            <span style={{ color: 'var(--foreground)', fontSize: '0.8rem' }}>Bereits besuchte Ziele vermeiden</span>
          </label>

          <label style={LABEL_STYLE}>Reisearten ausschließen</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {TRIP_TYPE_PREFERENCE_ORDER.map((t) => (
              <label key={t}>
                <input type="checkbox" name="excluded_trip_types" value={t} checked={excludedTripTypes.includes(t)} onChange={() => toggleInArray(setExcludedTripTypes, t)} className="sr-only" />
                <ChipToggle selected={excludedTripTypes.includes(t)} onClick={() => toggleInArray(setExcludedTripTypes, t)}>{TRIP_TYPE_PREFERENCE_LABELS[t]}</ChipToggle>
              </label>
            ))}
          </div>
          <label style={LABEL_STYLE}>Klimata ausschließen</label>
          <div className="flex flex-wrap gap-2">
            {CLIMATE_PREFERENCE_ORDER.map((c) => (
              <label key={c}>
                <input type="checkbox" name="excluded_climates" value={c} checked={excludedClimates.includes(c)} onChange={() => toggleInArray(setExcludedClimates, c)} className="sr-only" />
                <ChipToggle selected={excludedClimates.includes(c)} onClick={() => toggleInArray(setExcludedClimates, c)}>{CLIMATE_PREFERENCE_LABELS[c]}</ChipToggle>
              </label>
            ))}
          </div>
        </div>

        {/* 6. Zusammenfassung */}
        <div style={{ display: step === 5 ? 'block' : 'none' }}>
          <SectionTitle>Zusammenfassung</SectionTitle>
          <div className="flex flex-col gap-3 mb-6" style={{ fontSize: '0.8rem' }}>
            <div><span style={{ color: 'var(--muted)' }}>Reisende: </span><span style={{ color: 'var(--foreground)' }}>{travelerIds.length > 0 ? travelerIds.map((id) => personById.get(id)?.name).filter(Boolean).join(', ') : '—'}</span></div>
            <div>
              <span style={{ color: 'var(--muted)' }}>Zeitraum: </span>
              <span style={{ color: 'var(--foreground)' }}>
                {TRAVEL_DATE_MODE_LABELS[dateMode]}
                {dateMode === 'exact' && startIso && endIso ? ` (${startIso} – ${endIso}, ${exactNights ?? '?'} Nächte)` : ''}
                {(dateMode === 'month' || dateMode === 'school_holiday') && periodText ? ` (${periodText})` : ''}
                {(nightsMin || nightsMax) && dateMode !== 'exact' ? `, ${nightsMin || '?'}–${nightsMax || nightsMin || '?'} Nächte` : ''}
              </span>
            </div>
            <div><span style={{ color: 'var(--muted)' }}>Reiseart: </span><span style={{ color: 'var(--foreground)' }}>{tripType ? TRIP_TYPE_PREFERENCE_LABELS[tripType] : 'keine Präferenz'}</span></div>
            <div><span style={{ color: 'var(--muted)' }}>Klima: </span><span style={{ color: 'var(--foreground)' }}>{climate ? CLIMATE_PREFERENCE_LABELS[climate] : 'keine Präferenz'}{rainRiskTolerant ? ', Regenrisiko akzeptabel' : ''}</span></div>
            <div><span style={{ color: 'var(--muted)' }}>Anreise: </span><span style={{ color: 'var(--foreground)' }}>{stopoverPref ? STOPOVER_PREFERENCE_LABELS[stopoverPref] : 'keine Präferenz'}{maxStopovers ? `, max. ${maxStopovers} Umstiege` : ''}{departureCity ? `, ab ${departureCity}` : ''}</span></div>
            <div><span style={{ color: 'var(--muted)' }}>Budget: </span><span style={{ color: 'var(--foreground)' }}>{budgetMin || budgetMax ? `${budgetMin || '?'}–${budgetMax || '?'} ${budgetCurrency}` : 'offen'}{includesFlights ? ' (inkl. Flüge)' : ''}</span></div>
            {(excludedDestinationsText || excludedTripTypes.length > 0 || excludedClimates.length > 0) && (
              <div><span style={{ color: 'var(--muted)' }}>Ausschlüsse: </span><span style={{ color: 'var(--foreground)' }}>{[excludedDestinationsText, excludedTripTypes.map((t) => TRIP_TYPE_PREFERENCE_LABELS[t]).join(', '), excludedClimates.map((c) => CLIMATE_PREFERENCE_LABELS[c]).join(', ')].filter(Boolean).join(' · ')}</span></div>
            )}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
            Ihr könnt über „Zurück" jederzeit einzelne Angaben ändern.
          </p>
        </div>

      </div>

      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} style={SHORTCUT_STYLE}>← Zurück</button>
        ) : <span />}
        {!isLastStep ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canGoNext}
            style={{
              background: canGoNext ? 'var(--foreground)' : 'var(--border)', color: canGoNext ? 'var(--surface)' : 'var(--muted)',
              border: 'none', borderRadius: '6px', padding: '11px 20px', fontSize: '0.65rem', letterSpacing: '0.16em',
              textTransform: 'uppercase', cursor: canGoNext ? 'pointer' : 'not-allowed',
            }}
          >
            Weiter →
          </button>
        ) : (
          <SubmitButtonWithProgress label="Reiseideen generieren" pendingLabel="Vorschlag wird ermittelt …" />
        )}
      </div>
    </form>
  )
}
