'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

/**
 * Gemeinsame Progress-Komponente für Formulare mit länger laufenden
 * Server Actions (Foto-Upload, KI-Analyse) — von Travel Memory UND Content
 * Studio genutzt, um doppelte Lade-UI-Logik zu vermeiden. Zeigt während der
 * Server-Action-Laufzeit einen Spinner + Statustext statt des normalen Labels.
 */
export function SubmitButtonWithProgress({
  label,
  pendingLabel,
  style,
  icon,
  className,
}: {
  label: string
  pendingLabel: string
  style?: React.CSSProperties
  /** Optionales Icon, das im Ruhezustand statt des Spinners angezeigt wird (z.B. RefreshCw). */
  icon?: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      style={{
        background: "var(--foreground)", color: "var(--surface)", border: "none",
        borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
        letterSpacing: "0.16em", textTransform: "uppercase", cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.75 : 1, display: "flex", alignItems: "center", gap: "8px",
        whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
        ...style,
      }}
    >
      {pending ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : icon}
      {pending ? pendingLabel : label}
    </button>
  )
}
