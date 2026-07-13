'use client';

import { useFormStatus } from 'react-dom';

/**
 * §"'Wird ausgelesen' passt nicht beim normalen Speichern": dasselbe Formular
 * hat zwei Submit-Buttons (Speichern + KI-Auslesung), `useFormStatus` kennt
 * aber nur "irgendeine Aktion läuft gerade", nicht welche. Vergleich gegen
 * die eigene `action`-Referenz (`status.action === action`) unterscheidet,
 * ob GENAU dieser Button die laufende Aktion ausgelöst hat -- sonst würde
 * ein Klick auf "Speichern" fälschlich "Wird ausgelesen …" auf dem ANDEREN
 * Button zeigen (und umgekehrt). Von beiden Formularen geteilt (Buchungen +
 * Dokumente), analog zu `ExtractSubmitButton`.
 */
export function SaveSubmitButton({
  action,
  label,
  style,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  style?: React.CSSProperties;
}) {
  const status = useFormStatus();
  const isSaving = status.pending && status.action === action;

  return (
    <button
      type="submit"
      disabled={status.pending}
      style={{ ...style, opacity: status.pending ? 0.6 : 1, cursor: status.pending ? "default" : "pointer" }}
    >
      {isSaving ? "Wird gespeichert …" : label}
    </button>
  );
}
