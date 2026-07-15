'use client'

export type BriefingPerson = { id: string; name: string; birth_date: string | null; is_minor: boolean }

const SHORTCUT_STYLE: React.CSSProperties = {
  fontSize: '0.65rem', color: 'var(--accent)', background: 'var(--background)', border: '1px solid var(--border)',
  padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
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

/** Nur für den "Familie ohne Baby"-Shortcut -- reine UI-Schwelle, keine Reisebedürfnis-Logik. */
function isBaby(p: BriefingPerson): boolean {
  if (!p.birth_date) return false
  const ageYears = (Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)
  return ageYears < 2
}

/**
 * §"Keine doppelte Logik": Reisenden-Auswahl (Chips + Schnellauswahl "Alle"/
 * "Nur Erwachsene"/"Familie ohne Baby") -- von `TripBriefingWizard` UND der
 * eigenständigen Flugsuche (`/discover/flights`) genutzt, statt dieselbe
 * Auswahl-Logik zweimal zu pflegen. Reiner Controlled-Component-Baustein
 * (Auswahlzustand lebt beim Aufrufer) -- `name` steuert, unter welchem
 * Formularfeld-Namen die ausgewählten Personen-IDs beim Submit ankommen.
 */
export function TravelerChipSelector({
  persons, selectedIds, onChange, name = 'traveler_ids',
}: {
  persons: BriefingPerson[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  name?: string
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" style={SHORTCUT_STYLE} onClick={() => onChange(persons.map((p) => p.id))}>Alle</button>
        <button type="button" style={SHORTCUT_STYLE} onClick={() => onChange(persons.filter((p) => !p.is_minor).map((p) => p.id))}>Nur Erwachsene</button>
        <button type="button" style={SHORTCUT_STYLE} onClick={() => onChange(persons.filter((p) => !isBaby(p)).map((p) => p.id))}>Familie ohne Baby</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {persons.map((p) => (
          <label key={p.id}>
            <input type="checkbox" name={name} value={p.id} checked={selectedIds.includes(p.id)} onChange={() => toggle(p.id)} className="sr-only" />
            <ChipToggle selected={selectedIds.includes(p.id)} onClick={() => toggle(p.id)}>{p.name}</ChipToggle>
          </label>
        ))}
      </div>
    </div>
  )
}
