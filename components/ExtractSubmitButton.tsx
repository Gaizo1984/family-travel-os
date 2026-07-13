'use client';

import { useFormStatus } from 'react-dom';

/**
 * §"Man sieht nicht, ob die KI arbeitet": eigene Client-Komponente, da
 * `useFormStatus` nur innerhalb einer Client-Komponente unterhalb des
 * `<form>` funktioniert -- BookingForm/DocumentForm bleiben Server-
 * Komponenten. Zeigt während der Auslesung Text + deaktivierten Button statt
 * stillschweigend zu warten. Von beiden KI-Auslese-Formularen geteilt
 * (Buchungen + Dokumente), keine zweite Implementierung.
 *
 * §"'Wird ausgelesen' darf nur hier erscheinen, nicht beim normalen
 * Speichern": dasselbe Formular hat einen zweiten Submit-Button
 * (`SaveSubmitButton`) -- `status.action === formAction` prüft, ob GENAU
 * diese Aktion (die KI-Auslesung) gerade läuft, nicht irgendeine beliebige
 * Formular-Aktion.
 */
export function ExtractSubmitButton({
  formAction,
  style,
}: {
  formAction: (formData: FormData) => void | Promise<void>;
  style?: React.CSSProperties;
}) {
  const status = useFormStatus();
  const isExtracting = status.pending && status.action === formAction;

  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate
      disabled={status.pending}
      style={{ ...style, opacity: status.pending ? 0.6 : 1, cursor: status.pending ? "default" : "pointer" }}
    >
      {isExtracting ? "Wird ausgelesen …" : "🤖 Dokument auslesen"}
    </button>
  );
}
