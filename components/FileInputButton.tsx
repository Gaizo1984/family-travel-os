'use client'

import { useState } from 'react'

/**
 * §"Benennung wo man die Datei auswählt... abändern" (Nutzer-Feedback): der
 * native `<input type="file">`-Beschriftungstext ("Datei auswählen") kommt
 * vom Browser selbst und lässt sich nicht per Prop/CSS umbenennen -- einzige
 * verlässliche Lösung ist ein visuell verstecktes Input plus ein eigenes,
 * per `htmlFor` verknüpftes Label als Button. Zeigt zusätzlich den Namen der
 * gewählten Datei an, damit dabei keine Rückmeldung verloren geht.
 */
export function FileInputButton({
  id, name, accept, required, buttonLabel, capture,
}: {
  id: string
  name: string
  accept?: string
  required?: boolean
  buttonLabel: string
  capture?: 'environment' | 'user'
}) {
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        id={id} name={name} type="file" accept={accept} required={required} capture={capture}
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      />
      <label
        htmlFor={id}
        className="inline-block"
        style={{
          cursor: 'pointer', padding: '9px 14px', background: 'var(--background)',
          border: '1px solid var(--border)', borderRadius: '8px',
          color: 'var(--foreground)', fontSize: '0.78rem', fontWeight: 300, whiteSpace: 'nowrap',
        }}
      >
        {buttonLabel}
      </label>
      <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
        {fileName ?? 'Keine Datei ausgewählt'}
      </span>
    </div>
  )
}
