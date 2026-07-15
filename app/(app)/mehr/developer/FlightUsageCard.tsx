import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { getFlightProviderName, isFlightProviderSandbox } from '@/lib/providers/flights-provider'

const DEFAULT_MONTHLY_LIMIT = 50

/**
 * §"Kostenübersicht im Developer-Bereich vorbereiten" (Nutzervorgabe):
 * reine Anzeige, kein Test-Trigger, kein Zurücksetzen-Button. Modus/Name
 * kommen ausschließlich aus den bereits providerneutralen Exporten von
 * `lib/providers/flights-provider.ts` -- keine eigene Duffel-Sonderlogik
 * in dieser Seite.
 */
export async function FlightUsageCard() {
  const { id: familyId } = await getFamily()
  const supabase = await createClient()
  const monthKey = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('flight_search_usage')
    .select('search_count')
    .eq('family_id', familyId)
    .eq('month_key', monthKey)
    .maybeSingle()

  const providerName = getFlightProviderName()
  const isSandbox = isFlightProviderSandbox()
  const limit = Number(process.env.FLIGHT_SEARCH_MONTHLY_LIMIT ?? String(DEFAULT_MONTHLY_LIMIT))
  const count = usage?.search_count ?? 0

  return (
    <section
      style={{
        background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '1.25rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 style={{ color: '#e5e7eb', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.01em' }}>Flugsuche -- Nutzung &amp; Modus</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.15rem' }}>Reine Anzeige, kein eigener Testaufruf.</p>
        </div>
        <span
          style={{
            color: isSandbox ? '#fbbf24' : '#4ade80', background: isSandbox ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.12)',
            borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.68rem', letterSpacing: '0.04em', flexShrink: 0,
          }}
        >
          {providerName} · {isSandbox ? 'Testmodus' : 'Live'}
        </span>
      </div>
      <div style={{ marginTop: '0.85rem', fontSize: '0.78rem', color: '#e5e7eb' }}>
        Suchen diesen Monat: {count} / {limit}
      </div>
    </section>
  )
}
