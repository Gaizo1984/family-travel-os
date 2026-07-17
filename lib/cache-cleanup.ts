import { createServiceRoleClient } from '@/lib/supabase/service-role'

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
  const supabase = createServiceRoleClient()
  const result: CacheCleanupResult = {}

  const jobs = [
    {
      table: 'category_places_cache',
      run: () => supabase.from('category_places_cache').delete({ count: 'exact' }).lt('updated_at', cutoffIso(CATEGORY_PLACES_TTL_DAYS)),
    },
    {
      table: 'day_plan_cache',
      run: () => supabase.from('day_plan_cache').delete({ count: 'exact' }).lt('updated_at', cutoffIso(DAY_PLAN_TTL_DAYS)),
    },
    {
      table: 'flight_search_cache',
      run: () => supabase.from('flight_search_cache').delete({ count: 'exact' }).lt('updated_at', cutoffIso(FLIGHT_SEARCH_TTL_DAYS)),
    },
    {
      table: 'concierge_messages',
      run: () => supabase.from('concierge_messages').delete({ count: 'exact' }).lt('created_at', cutoffIso(CONCIERGE_MESSAGES_TTL_DAYS)),
    },
    {
      table: 'today_recommendations',
      run: () => supabase.from('today_recommendations').delete({ count: 'exact' }).lt('created_at', cutoffIso(TODAY_RECOMMENDATIONS_TTL_DAYS)),
    },
    {
      table: 'content_strategies',
      run: () => supabase.from('content_strategies').delete({ count: 'exact' }).lt('created_at', cutoffIso(CONTENT_STRATEGIES_TTL_DAYS)),
    },
    {
      table: 'concierge_category_suggestions',
      run: () => supabase.from('concierge_category_suggestions').delete({ count: 'exact' }).lt('updated_at', cutoffIso(CONCIERGE_CATEGORY_SUGGESTIONS_TTL_DAYS)),
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
