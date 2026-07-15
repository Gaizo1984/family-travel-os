'use client'

import { useState } from 'react'
import { SubmitButtonWithProgress } from '@/components/SubmitButtonWithProgress'

export type CompareSelectableIdea = { id: string; label: string }

/**
 * §"Vergleich nur startbar bei genau 2-3 ausgewählten Ideen (auch
 * clientseitig durchgesetzt)": sperrt weitere Checkboxen ab 3 Auswahlen,
 * aktiviert den Button erst ab 2 -- ergänzt die serverseitige Validierung in
 * generateIdeaComparison (lib/actions/trip-idea-comparisons.ts), ersetzt sie
 * nicht (Formulare lassen sich immer per DevTools umgehen).
 */
export function IdeaCompareSelector({
  ideas,
  action,
}: {
  ideas: CompareSelectableIdea[]
  action: (formData: FormData) => void | Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  const canCompare = selected.size >= 2 && selected.size <= 3

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!canCompare) e.preventDefault()
      }}
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {ideas.map((idea) => {
          const isChecked = selected.has(idea.id)
          const isDisabled = !isChecked && selected.size >= 3
          return (
            <label
              key={idea.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', cursor: isDisabled ? 'default' : 'pointer',
                padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem',
                background: isChecked ? 'rgba(184,154,94,0.14)' : 'var(--surface)',
                border: `1px solid ${isChecked ? 'rgba(184,154,94,0.4)' : 'var(--border)'}`,
                color: isDisabled && !isChecked ? 'var(--muted)' : 'var(--foreground)',
                opacity: isDisabled && !isChecked ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                name="idea_ids"
                value={idea.id}
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => toggle(idea.id)}
                style={{ accentColor: 'var(--accent)', width: '13px', height: '13px', cursor: 'inherit' }}
              />
              {idea.label}
            </label>
          )
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButtonWithProgress
          label="Vergleichen"
          pendingLabel="Vergleich wird erstellt …"
          style={{
            background: canCompare ? 'var(--foreground)' : 'var(--border)',
            color: canCompare ? 'var(--surface)' : 'var(--muted)',
            border: 'none', borderRadius: '6px', padding: '9px 18px', fontSize: '0.62rem', letterSpacing: '0.12em',
            cursor: canCompare ? 'pointer' : 'not-allowed',
          }}
        />
        <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>
          {selected.size === 0 ? 'Wählt 2 oder 3 Ideen aus' : `${selected.size} von max. 3 ausgewählt`}
        </span>
      </div>
    </form>
  )
}
