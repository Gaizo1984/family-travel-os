'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Ersetzt ein rohes `<input type="password">` um ein Augen-Symbol, das
 * Klartext ein-/ausblendet — Security Foundation 1B, an allen drei
 * tatsächlichen Passwort-Eingabefeldern der App genutzt (Login,
 * Passwort-Reset x2). Alle Standard-Input-Props werden 1:1 durchgereicht,
 * damit native Formular-Validierung/-Submission unverändert bleibt.
 */
export function PasswordField({
  id,
  name,
  autoComplete,
  required,
  minLength,
  style,
}: {
  id: string
  name: string
  autoComplete?: string
  required?: boolean
  minLength?: number
  style?: React.CSSProperties
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id} name={name} type={visible ? 'text' : 'password'}
        autoComplete={autoComplete} required={required} minLength={minLength}
        style={{ ...style, paddingRight: '48px' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Passwort ausblenden' : 'Passwort einblenden'}
        style={{
          position: 'absolute', top: '50%', right: '2px', transform: 'translateY(-50%)',
          width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
          WebkitAppearance: 'none', appearance: 'none',
        }}
      >
        {visible ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
      </button>
    </div>
  )
}
