'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/** §"Text kopieren": rein clientseitig, kein Server-Roundtrip nötig. */
export function CopyTextButton({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard-API nicht verfügbar -- kein Absturz, nur kein visuelles Feedback.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'transparent', color: copied ? '#6B8F71' : 'var(--muted)', border: '1px solid var(--border)',
        borderRadius: '6px', padding: '6px 12px', fontSize: '0.6rem', letterSpacing: '0.08em',
        textTransform: 'uppercase', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
        ...style,
      }}
    >
      {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.5} />}
      {copied ? 'Kopiert' : 'Text kopieren'}
    </button>
  )
}
