'use client'

import { useRouter } from 'next/navigation'

const FIELD_STYLE: React.CSSProperties = {
  padding: '8px 14px', background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--foreground)', fontSize: '0.72rem', fontWeight: 300, outline: 'none',
}

/** §"Dropdown-Menü nach Jahreszahl": springt bei Auswahl direkt zur gefilterten Ansicht, ohne eigenen Submit-Button -- reine Navigation, kein Formularstatus. */
export function YearFilterSelect({
  years, currentYear, basePath,
}: {
  years: number[]
  currentYear: number | null
  basePath: string
}) {
  const router = useRouter()

  return (
    <select
      value={currentYear ?? ''}
      onChange={(e) => router.push(e.target.value ? `${basePath}&year=${e.target.value}` : basePath)}
      style={FIELD_STYLE}
      aria-label="Nach Jahr filtern"
    >
      <option value="">Alle Jahre</option>
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
