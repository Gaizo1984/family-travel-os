import { createLumiCoreServiceClient } from '@/lib/supabase/lumi-core-service'

export type CacheCleanupResult = Record<string, number>

/**
 * §"Cache darf ausschließlich wiederbeschaffbare Daten enthalten ...
 * abgelaufene Cacheeinträge automatisiert bereinigen" (Nutzervorgabe).
 *
 * §"Keine starre 50-MB-Logik bauen, bevor tatsächliche Tabellengrößen und
 * Supabase-Möglichkeiten geprüft wurden" (Nutzervorgabe, wörtlich): diese
 * Umgebung hat keinen Zugriff auf reale Tabellengrößen (kein
 * SUPABASE_SERVICE_ROLE_KEY/DB-Admin-Zugriff in dieser Session) -- bewusst
 * KEINE größenbasierte Löschung, ausschließlich zeitbasierte TTLs nach
 * bereits bewährtem Vorbild (`hotel_search_cache`: 30 Tage,
 * `cleanup-content-sessions`-Cron-Muster). Bevor jemals eine größenbasierte
 * Regel ergänzt wird, sollten reale Tabellengrößen im Supabase-Dashboard
 * geprüft werden.
 *
 * Ausdrücklich NICHT hier: `hotel_search_cache`/`signed_url_cache` (haben
 * bereits eigene, aktiv geprüfte TTL-Logik beim Lesen), `family_memories`,
 * `persons`, `past_trips`, `saved_flight_options`, `lumi_brain_usage`,
 * `flight_search_usage` (dauerhaft bzw. bewusst ohne Ablauf, siehe
 * Architekturplan) -- niemals in diesem Cleanup berühren.
 *
 * FINALER CUTOVER: läuft jetzt gegen Lumi Core über den neuen
 * Service-Role-Client (lib/supabase/lumi-core-service.ts) -- der
 * cookie-basierte createLumiCoreClient() liefert in diesem sitzungslosen
 * Cron-Kontext keine authentifizierte Session, RLS würde jede Abfrage
 * still auf 0 Zeilen filtern.
 */
const CATEGORY_PLACES_TTL_DAYS = 14
const DAY_PLAN_TTL_DAYS = 7
const FLIGHT_SEARCH_TTL_DAYS = 30
const CONCIERGE_MESSAGES_TTL_DAYS = 30
const TODAY_RECOMMENDATIONS_TTL_DAYS = 7
const CONTENT_STRATEGIES_TTL_DAYS = 30
const CONCIERGE_CATEGORY_SUGGESTIONS_TTL_DAYS = 14

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export async function cleanupExpiredCacheEntries(): Promise<CacheCleanupResult> {
  const lumiCore = createLumiCoreServiceClient()
  const result: CacheCleanupResult = {}

  const jobs = [
    {
      table: 'travel_category_places_cache',
      run: () => lumiCore.from('travel_category_places_cache').delete({ count: 'exact' }).lt('updated_at', cutoffIso(CATEGORY_PLACES_TTL_DAYS)),
    },
    {
      table: 'travel_day_plan_cache',
      run: () => lumiCore.from('travel_day_plan_cache').delete({ count: 'exact' }).lt('updated_at', cutoffIso(DAY_PLAN_TTL_DAYS)),
    },
    {
      table: 'travel_flight_search_cache',
      run: () => lumiCore.from('travel_flight_search_cache').delete({ count: 'exact' }).lt('updated_at', cutoffIso(FLIGHT_SEARCH_TTL_DAYS)),
    },
    {
      table: 'travel_concierge_messages',
      run: () => lumiCore.from('travel_concierge_messages').delete({ count: 'exact' }).lt('created_at', cutoffIso(CONCIERGE_MESSAGES_TTL_DAYS)),
    },
    {
      table: 'travel_today_recommendations',
      run: () => lumiCore.from('travel_today_recommendations').delete({ count: 'exact' }).lt('created_at', cutoffIso(TODAY_RECOMMENDATIONS_TTL_DAYS)),
    },
    {
      table: 'travel_content_strategies',
      run: () => lumiCore.from('travel_content_strategies').delete({ count: 'exact' }).lt('created_at', cutoffIso(CONTENT_STRATEGIES_TTL_DAYS)),
    },
    {
      table: 'travel_concierge_category_suggestions',
      run: () => lumiCore.from('travel_concierge_category_suggestions').delete({ count: 'exact' }).lt('updated_at', cutoffIso(CONCIERGE_CATEGORY_SUGGESTIONS_TTL_DAYS)),
    },
  ]

  for (const job of jobs) {
    const { count, error } = await job.run()
    if (error) {
      console.error('[cache-cleanup] Löschen fehlgeschlagen', { table: job.table, error: error.message })
      continue
    }
    result[job.table] = count ?? 0
  }

  return result
}
