'use client';

import { useFormStatus } from 'react-dom';

/**
 * §"Man sieht nicht, ob die KI arbeitet": eigene Client-Komponente, da
 * `useFormStatus` nur innerhalb einer Client-Komponente unterhalb des
 * `<form>` funktioniert -- BookingForm/DocumentForm bleiben Server-
 * Komponenten. Zeigt während der Auslesung Text + deaktivierten Button statt
 * stillschweigend zu warten. Von beiden KI-Auslese-Formularen geteilt
 * (Buchungen + Dokumente), keine zweite Implementierung.
 */
export function ExtractSubmitButton({
  formAction,
  style,
}: {
  formAction: (formData: FormData) => void | Promise<void>;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate
      disabled={pending}
      style={{ ...style, opacity: pending ? 0.6 : 1, cursor: pending ? "default" : "pointer" }}
    >
      {pending ? "Wird ausgelesen …" : "🤖 Dokument auslesen"}
    </button>
  );
}
