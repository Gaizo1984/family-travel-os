'use client'

import { useState } from 'react'

/**
 * §"Geführter Content-Kontext -- kompakte Fokus-Chips/Stimmungs-Chips": ein
 * einzelner, wiederverwendbarer Baustein statt separater Select-Felder --
 * `multiple=false` verhält sich wie Radio-Buttons (max. 1 aktiv), `true` wie
 * Checkboxen. Sendet ganz normal per natives `<input type="checkbox">` mit,
 * kein Client-State außerhalb dieser Komponente nötig.
 */
export function ChipToggleGroup({
  name,
  options,
  multiple = false,
  defaultValue = [],
}: {
  name: string
  options: readonly { value: string; label: string }[]
  multiple?: boolean
  defaultValue?: string[]
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue)

  function toggle(value: string) {
    setSelected((prev) => {
      if (multiple) return prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      return prev.includes(value) ? [] : [value]
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <label key={o.value} style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => toggle(o.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                display: 'inline-block', padding: '7px 14px', borderRadius: '999px', fontSize: '0.68rem',
                border: `1px solid ${active ? 'var(--foreground)' : 'var(--border)'}`,
                background: active ? 'var(--foreground)' : 'transparent',
                color: active ? 'var(--surface)' : 'var(--muted)',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              }}
            >
              {o.label}
            </span>
          </label>
        )
      })}
    </div>
  )
}
