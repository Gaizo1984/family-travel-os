'use client'

import { useState } from 'react'
import { ChevronDown, MapPin, X } from 'lucide-react'
import type { TripPickerEntry } from '@/lib/lumi-trip-picker'

const STATUS_LABEL: Record<TripPickerEntry['status'], string> = {
  active: 'Läuft', upcoming: 'Bevorstehend', historical: 'Abgeschlossen',
}
const STATUS_COLOR: Record<TripPickerEntry['status'], string> = {
  active: '#6B8F71', upcoming: 'var(--accent)', historical: 'var(--muted)',
}

/**
 * §Phase B "Reise zuordnen" (Nutzervorgabe): 1:1-Vorbild components/LumiTripPicker.tsx
 * (gleiche zentrale Reiseliste lib/lumi-trip-picker.ts, gleiches Bottom-Sheet-
 * Pattern) -- hier ohne "Allgemein"-Option (eine gemerkte Flug-/Hotel-Option
 * muss einer konkreten Reise zugeordnet werden, kein trip-loser Zustand nach
 * der Zuordnung) und mit austauschbarer Server Action, da Flüge und Hotels
 * unterschiedliche Actions (assignTripToSavedFlightOption/...HotelOption)
 * brauchen, aber identisch aussehen sollen -- keine zweite UI-Kopie.
 */
export function AssignTripPicker({
  trips, savedOptionId, assignAction, returnTo, triggerLabel = 'Reise zuordnen',
}: {
  trips: TripPickerEntry[]
  savedOptionId: string
  assignAction: (formData: FormData) => void
  returnTo: string
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.68rem', padding: 0 }}
      >
        {triggerLabel}
        <ChevronDown size={12} strokeWidth={1.8} />
      </button>

      {open && (
        <>
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
                <form key={trip.id} action={assignAction}>
                  <input type="hidden" name="id" value={savedOptionId} />
                  <input type="hidden" name="trip_id" value={trip.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-3 flex flex-col gap-1"
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
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
