'use client'

import { useState } from 'react'

/**
 * §Flugmaske einfach halten: Zwischenstopp-Felder sind technisch weiterhin
 * normale detailFields (siehe lib/bookings.ts), werden aber UI-seitig hinter
 * einem Einklapp-Button versteckt, statt die Maske dauerhaft mit optionalen
 * Feldern zu füllen. `defaultOpen` wird gesetzt, wenn bereits Werte für diese
 * Gruppe existieren (Bearbeiten einer Buchung mit vorhandenem Zwischenstopp).
 */
export function CollapsibleDetailGroup({
  label,
  defaultOpen,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))

  if (!open) {
    return (
      <div className="col-span-1 sm:col-span-2 mb-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: 'transparent', color: 'var(--accent)', border: '1px dashed rgba(184,154,94,0.4)',
            borderRadius: '8px', padding: '12px 16px', fontSize: '0.7rem', letterSpacing: '0.08em',
            cursor: 'pointer', width: '100%', textAlign: 'left', WebkitAppearance: 'none', appearance: 'none',
          }}
        >
          {label}
        </button>
      </div>
    )
  }

  return (
    <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
      {children}
    </div>
  )
}
