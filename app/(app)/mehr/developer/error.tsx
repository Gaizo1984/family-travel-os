'use client';

/**
 * §"Beim Klicken auf Developer kommt 'This Page couldn't load'": ohne
 * Error-Boundary führt jeder unerwartete Rendering-Fehler in diesem sich
 * schnell weiterentwickelnden Testbereich (z. B. ein Cache-Eintrag aus
 * `dev_test_runs`, dessen Form sich seit dem letzten Sprint geändert hat)
 * zum generischen Next.js-Fehlerbildschirm. Diese Boundary fängt das ab und
 * bietet einen Weg zurück, statt die ganze Seite unbrauchbar zu machen.
 */
export default function DeveloperError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: '100%', background: '#0b0f19', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }}
    >
      <div style={{ color: '#f87171', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Developer-Bereich: Fehler beim Laden</div>
      <div style={{ color: '#6b7280', fontSize: '0.72rem', maxWidth: '32rem', marginBottom: '1.5rem' }}>
        {error.message || 'Unbekannter Fehler.'}
      </div>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          background: '#312e81', color: '#e0e7ff', border: '1px solid #4338ca', borderRadius: '6px',
          padding: '0.5rem 1rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Erneut versuchen
      </button>
    </div>
  );
}
