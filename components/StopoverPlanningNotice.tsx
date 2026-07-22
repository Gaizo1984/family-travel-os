import Link from 'next/link'

/**
 * §"Zwischenstopp-Planung soll optional bleiben" (Nutzervorgabe, wörtlich):
 * macht sichtbar/nachvollziehbar, dass Vorschläge sich bereits auf das
 * eigentliche Ziel beziehen statt auf den aktuellen kurzen Zwischenstopp --
 * plus einen expliziten, optionalen Umschalter zurück auf den Zwischenstopp.
 * Rein informativ/UI, keine eigene Logik (siehe lib/today.ts::resolvePlanningLocation).
 */
export function StopoverPlanningNotice({
  destinationLabel, stopoverLabel, preferStopover, toggleHref,
}: {
  destinationLabel: string
  stopoverLabel: string
  /** true = die Seite zeigt aktuell bewusst den Zwischenstopp (Umschalter zurück zum Ziel), false = Standardfall (Vorschläge zeigen bereits das Ziel, Umschalter zum Zwischenstopp). */
  preferStopover: boolean
  /** Fertige Ziel-URL für den Umschalter (mit bzw. ohne `?stopover=1`, je nach Richtung). */
  toggleHref: string
}) {
  return (
    <div
      className="mb-4 px-4 py-3 rounded-lg"
      style={{ background: 'rgba(184,154,94,0.1)', border: '1px solid rgba(184,154,94,0.3)' }}
    >
      <p style={{ color: 'var(--foreground)', fontSize: '0.75rem', lineHeight: 1.5 }}>
        {preferStopover ? (
          <>Ihr plant gerade für euren kurzen Zwischenstopp in <strong>{stopoverLabel}</strong>.</>
        ) : (
          <>Ihr seid heute nur kurz in <strong>{stopoverLabel}</strong> -- die Vorschläge beziehen sich
          bereits auf euer Ziel <strong>{destinationLabel}</strong>.</>
        )}
      </p>
      <Link href={toggleHref} style={{ color: 'var(--accent)', fontSize: '0.68rem', letterSpacing: '0.04em', textDecoration: 'none' }}>
        {preferStopover ? `Zurück zur ${destinationLabel}-Planung →` : `Stattdessen für ${stopoverLabel} planen →`}
      </Link>
    </div>
  )
}
