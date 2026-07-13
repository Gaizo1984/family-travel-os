import { DevTestCard, inputStyle, buttonStyle } from './DevTestCard'
import { runPlacesTest, type PlacesTestResult } from '@/lib/actions/dev-tests/places-test'
import type { DevTestRun } from '@/lib/dev-test-runs'
import type { PlacesCategory } from '@/lib/providers/places-provider'

const CATEGORIES: PlacesCategory[] = ['restaurant', 'attraction', 'beach', 'nature']
const CATEGORY_LABELS: Record<PlacesCategory, string> = {
  restaurant: 'Restaurants', attraction: 'Sehenswürdigkeiten', beach: 'Strände', nature: 'Naturziele',
}

export function PlacesTestCard({ lastRun }: { lastRun: DevTestRun | null }) {
  const result = lastRun?.result as unknown as PlacesTestResult | undefined

  return (
    <DevTestCard
      title="Google Places API (New)"
      description="Hotel/Hauptort, Koordinaten, Top-Treffer je Kategorie mit Bewertung, Öffnungszeiten, echter Fahrzeit, Foto."
      lastRun={lastRun}
    >
      <form action={runPlacesTest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Ort</div>
          <input
            name="location"
            defaultValue="Playa Conchal, Costa Rica"
            style={inputStyle}
          />
        </label>
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Hotel (Referenzpunkt, optional)</div>
          <input name="hotel" placeholder="z. B. The Westin Reserva Conchal" style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>Testen</button>
      </form>

      {/* §Absicherung gegen Alt-Cache: result.origin gab es vor dem Bugfix-Sprint
          noch nicht -- ohne diese Prüfung würde ein älterer, noch im
          dev_test_runs-Cache liegender Testlauf beim Zugriff auf
          result.origin.* die ganze Seite zum Absturz bringen ("This Page
          couldn't load"). Fehlt das Feld, wird einfach kein Ergebnis gezeigt. */}
      {result?.origin && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#e5e7eb' }}>
            Ausgangspunkt ({result.origin.source === 'hotel' ? 'Hotel' : 'Ort'}): <strong>{result.origin.formattedAddress}</strong>{' '}
            ({result.origin.lat.toFixed(4)}, {result.origin.lng.toFixed(4)})
          </div>
          {CATEGORIES.map((category) => {
            const items = result.categories?.[category] ?? []
            return (
              <div key={category}>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.35rem' }}>{CATEGORY_LABELS[category]}</div>
                {items.length === 0 ? (
                  <div style={{ fontSize: '0.7rem', color: '#4b5563' }}>Keine Treffer</div>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {items.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 flex-wrap" style={{ fontSize: '0.72rem', color: '#d1d5db' }}>
                        {p.photoName && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/places-photo/${p.photoName}?maxWidthPx=64`}
                            alt=""
                            width={28}
                            height={28}
                            style={{ borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}
                        <span style={{ flex: 1 }}>{p.name}</span>
                        {p.rating != null && <span style={{ color: '#fbbf24' }}>★ {p.rating} ({p.userRatingCount ?? 0})</span>}
                        {p.openNow != null && <span style={{ color: p.openNow ? '#4ade80' : '#f87171' }}>{p.openNow ? 'geöffnet' : 'Jetzt geschlossen'}</span>}
                        {p.distanceKm != null && <span style={{ color: '#6b7280' }}>{p.distanceKm} km Luftlinie</span>}
                        {p.durationMinutes != null && (
                          <span style={{ color: '#9ca3af' }}>{p.durationMinutes} Min ({p.travelDistanceKm} km Fahrstrecke)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </DevTestCard>
  )
}
