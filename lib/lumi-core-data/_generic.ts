import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

type Tables = LumiCoreDatabase['public']['Tables']

/**
 * Gemeinsamer CRUD-Baustein für die 34 Fachtabellen dieser Gruppen (siehe
 * README) -- vermeidet, denselben list/get/create/update/remove-Code 34x
 * beinahe identisch zu wiederholen (wie es trips.ts/stages.ts/bookings.ts
 * in Gruppe 1 noch einzeln taten).
 *
 * `table` ist generisch (K extends keyof Tables) -- Supabase-js kann
 * `.insert()`/`.update()`/`.eq()` für einen generischen Tabellennamen
 * nicht mehr gegen die konkrete Zeilenform auflösen (es entsteht eine
 * Union über ALLE Tabellen). Deshalb wird HIER, innerhalb dieses einen
 * Bausteins, bewusst mit `any` auf den Client zugegriffen -- die
 * öffentlichen Funktionssignaturen (Row/Insert je K) bleiben davon
 * unberührt und für jeden Aufrufer voll typsicher. Reines
 * Scaffolding/Vorbereitungs-Modul, noch nirgends aktiv verdrahtet.
 */
export function createCrud<K extends keyof Tables>(table: K) {
  type Row = Tables[K]['Row']
  type Insert = Tables[K]['Insert']

  async function listBy(column: string, value: string, orderBy?: string): Promise<Row[]> {
    const lumiCore = (await createLumiCoreClient()) as unknown as { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
    let query = lumiCore.from(table).select('*').eq(column, value)
    if (orderBy) query = query.order(orderBy)
    const { data, error } = await query
    if (error) throw new Error(`${String(table)}.listBy: ${error.message}`)
    return (data ?? []) as Row[]
  }

  async function getById(id: string): Promise<Row | null> {
    const lumiCore = (await createLumiCoreClient()) as unknown as { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data, error } = await lumiCore.from(table).select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`${String(table)}.getById: ${error.message}`)
    return data as Row | null
  }

  async function create(input: Insert): Promise<Row> {
    const lumiCore = (await createLumiCoreClient()) as unknown as { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data, error } = await lumiCore.from(table).insert(input).select('*').single()
    if (error || !data) throw new Error(`${String(table)}.create: ${error?.message ?? 'kein Ergebnis'}`)
    return data as Row
  }

  async function update(id: string, patch: Partial<Insert>): Promise<void> {
    const lumiCore = (await createLumiCoreClient()) as unknown as { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
    const { error } = await lumiCore.from(table).update(patch).eq('id', id)
    if (error) throw new Error(`${String(table)}.update: ${error.message}`)
  }

  async function remove(id: string): Promise<void> {
    const lumiCore = (await createLumiCoreClient()) as unknown as { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
    const { error } = await lumiCore.from(table).delete().eq('id', id)
    if (error) throw new Error(`${String(table)}.remove: ${error.message}`)
  }

  return { listBy, getById, create, update, remove }
}
