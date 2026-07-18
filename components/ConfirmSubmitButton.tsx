'use client'

/**
 * §"Sicherheitsabfrage vor dem vollständigen Löschen" (Nutzervorgabe,
 * Frag-LUMI-Fix Punkt 2): generischer, wiederverwendbarer Submit-Button mit
 * nativem `window.confirm()` vor dem Absenden -- bewusst kein eigenes
 * Modal-System dafür, das wäre ein paralleler Mechanismus für einen simplen
 * Bestätigungsdialog. Reine Bestätigung vor dem Absenden, keine eigene
 * Lösch-Logik -- die eigentliche Aktion bleibt die normale Server Action des
 * umgebenden `<form action={...}>`.
 */
export function ConfirmSubmitButton({
  label,
  confirmMessage,
  style,
}: {
  label: string
  confirmMessage: string
  style?: React.CSSProperties
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
      style={style}
    >
      {label}
    </button>
  )
}
