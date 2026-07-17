'use client'

import { useState } from 'react'
import { ChevronDown, MapPin, X } from 'lucide-react'
import { selectLumiBrainTrip } from '@/lib/actions/lumi-trip-selection'
import type { TripPickerEntry } from '@/lib/lumi-trip-picker'

const STATUS_LABEL: Record<TripPickerEntry['status'], string> = {
  active: 'Läuft', upcoming: 'Bevorstehend', historical: 'Abgeschlossen',
}
const STATUS_COLOR: Record<TripPickerEntry['status'], string> = {
  active: '#6B8F71', upcoming: 'var(--accent)', historical: 'var(--muted)',
}

/**
 * §"Mobile-first bevorzugt: Pill ... daneben Auswahl öffnet Bottom Sheet oder
 * Dropdown" (Nutzervorgabe, wörtlich) -- ein einzelner Pill statt weiterer
 * langer Pill-Reihen; Klick öffnet die vollständige, bereits zentral sortierte
 * Reiseliste aus lib/lumi-trip-picker.ts (keine zweite Sortier-/Matching-
 * Logik hier). Jeder Eintrag ist ein eigenes Formular auf die bestehende
 * Server Action `selectLumiBrainTrip`, die die Auswahl familiengebunden
 * merkt (siehe dortiger Kommentar).
 */
export function LumiTripPicker({
  trips, selectedTripId, familyId, returnToBase,
}: {
  trips: TripPickerEntry[]
  selectedTripId: string | null
  familyId: string
  returnToBase: string
}) {
  const [open, setOpen] = useState(false)
  const selected = trips.find((t) => t.id === selectedTripId) ?? null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          fontSize: '0.68rem', background: selectedTripId ? 'rgba(184,154,94,0.14)' : 'var(--surface)',
          border: `1px solid ${selectedTripId ? 'rgba(184,154,94,0.4)' : 'var(--border)'}`,
          color: selectedTripId ? 'var(--foreground)' : 'var(--muted)', cursor: 'pointer',
        }}
      >
        {selected ? selected.title : 'Reise auswählen'}
        <ChevronDown size={12} strokeWidth={1.8} />
      </button>

      {open && (
        <>
          {/* §Bugfix "Picker-Einträge nicht anklickbar": app/(app)/layout.tsx
             rendert die mobile Bottom-Nav ebenfalls `fixed ... z-50`, aber
             NACH {children} im DOM -- bei gleichem z-index gewinnt bei
             position:fixed-Geschwistern die spätere DOM-Reihenfolge, die Nav
             lag dadurch (unsichtbar) ÜBER dem Sheet und fing Taps auf den
             unteren Einträgen ab. Sheet/Backdrop müssen über z-50 liegen. */}
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[70] md:absolute md:inset-x-auto md:bottom-auto md:top-full md:mt-2 md:w-80 rounded-t-2xl md:rounded-xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '70vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--foreground)', fontSize: '0.78rem' }}>Reise auswählen</span>
              <button type="button" onClick={() => setOpen(false)} style={{ color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 48px)' }}>
              {trips.length === 0 && (
                <div className="px-4 py-6" style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                  Noch keine Reisen angelegt.
                </div>
              )}
              {trips.map((trip) => (
                <form key={trip.id} action={selectLumiBrainTrip}>
                  <input type="hidden" name="family_id" value={familyId} />
                  <input type="hidden" name="slug" value={trip.slug} />
                  <input type="hidden" name="return_to_base" value={returnToBase} />
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-3 flex flex-col gap-1"
                    style={{
                      background: trip.id === selectedTripId ? 'rgba(184,154,94,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: 'var(--foreground)', fontSize: '0.82rem' }}>{trip.title}</span>
                      <span style={{ color: STATUS_COLOR[trip.status], fontSize: '0.6rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {STATUS_LABEL[trip.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3" style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>
                      <span>{trip.dateRangeLabel}</span>
                      {trip.destinationLabel && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} strokeWidth={1.8} />
                          {trip.destinationLabel}
                        </span>
                      )}
                    </div>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
