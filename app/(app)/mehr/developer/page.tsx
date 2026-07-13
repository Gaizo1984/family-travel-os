import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAllTestRuns } from '@/lib/dev-test-runs'
import { PlacesTestCard } from './PlacesTestCard'
import { GeocodingTestCard } from './GeocodingTestCard'
import { WeatherTestCard } from './WeatherTestCard'
import { ComputeRouteTestCard } from './ComputeRouteTestCard'
import { ComputeRouteMatrixTestCard } from './ComputeRouteMatrixTestCard'
import { DaytripTestCard } from './DaytripTestCard'
import { OpenAiTestCard } from './OpenAiTestCard'

/**
 * Dauerhafter, geschützter Developer-Bereich (Mehr → Developer) für
 * serverseitige Smoke-Tests neuer Integrationen (aktuell Places API New,
 * Geocoding API, Routes API, OpenAI) -- bereits durch die App-weite
 * Auth-Gate (proxy.ts, Security Foundation 1A) auf eingeloggte Nutzer
 * beschränkt, kein zusätzliches Rollensystem nötig. Bewusst optisch klar von
 * der normalen App abgesetzt (dunkel/monospace), damit nie mit
 * Produktionsoberflächen verwechselt wird. Rührt bestehende Produktionslogik
 * nicht an.
 */
export default async function DeveloperPage() {
  const runs = await getAllTestRuns()

  return (
    <div style={{ minHeight: '100%', background: '#0b0f19' }}>
      <div className="max-w-4xl w-full mx-auto px-5 md:px-8 pb-16 pt-9">
        <Link
          href="/mehr"
          className="inline-flex items-center gap-1.5"
          style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace', marginBottom: '1.25rem' }}
        >
          <ArrowLeft size={14} strokeWidth={1.6} />
          Zurück zu Mehr
        </Link>

        <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '0.5rem' }}>
          <h1 style={{ color: '#e5e7eb', fontSize: '1.4rem', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
            Developer
          </h1>
          <span
            style={{
              color: '#fbbf24', background: 'rgba(251,191,36,0.12)', borderRadius: '999px',
              padding: '0.15rem 0.6rem', fontSize: '0.65rem', letterSpacing: '0.06em', fontFamily: 'ui-monospace, monospace',
            }}
          >
            NUR FÜR ENTWICKLUNG
          </span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace', marginBottom: '2rem' }}>
          Serverseitige Testmodule für externe Integrationen. Alle Aufrufe laufen ausschließlich auf dem Server, API-Keys
          verlassen nie den Browser.
        </p>

        <div className="flex flex-col gap-4">
          <PlacesTestCard lastRun={runs.places ?? null} />
          <GeocodingTestCard lastRun={runs.geocoding ?? null} />
          <WeatherTestCard lastRun={runs.weather ?? null} />
          <ComputeRouteTestCard lastRun={runs.routes_compute_route ?? null} />
          <ComputeRouteMatrixTestCard lastRun={runs.routes_compute_route_matrix ?? null} />
          <DaytripTestCard lastRun={runs.daytrip_multi_stop ?? null} />
          <OpenAiTestCard lastRun={runs.openai_recommendations ?? null} placesAvailable={runs.places?.success === true} />
        </div>
      </div>
    </div>
  )
}
