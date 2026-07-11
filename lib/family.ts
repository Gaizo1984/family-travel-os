import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Request-scoped Deduplication via React cache() — nie über Requests/
 * Sessions hinweg gültig, kein Cross-User-/Cross-Family-Leck möglich (die App
 * hat aktuell ohnehin keine Auth/Mehrfamilien-Architektur, aber dieses Muster
 * bleibt auch dann sicher, falls sich das ändert). Erspart die bisher auf
 * >15 Seiten unabhängig wiederholte families-Abfrage innerhalb *eines*
 * Seitenaufrufs (z. B. wenn Layout und Page dieselbe Familie brauchen),
 * ohne irgendeinen Zustand über den einzelnen Request hinaus zu halten.
 */
export const getFamily = cache(async (): Promise<{ id: string; name: string | null }> => {
  const supabase = await createClient()
  const { data } = await supabase.from('families').select('id, name').limit(1).single()
  return { id: data?.id ?? '', name: data?.name ?? null }
})
