import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'

type StageRow = LumiCoreDatabase['public']['Tables']['travel_stages']['Row']
type StageInsert = LumiCoreDatabase['public']['Tables']['travel_stages']['Insert']

export async function listStagesForTrip(tripId: string): Promise<StageRow[]> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_stages').select('*').eq('trip_id', tripId).order('sort_order')
  if (error) throw new Error(`listStagesForTrip: ${error.message}`)
  return data
}

export async function getStageById(stageId: string): Promise<StageRow | null> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_stages').select('*').eq('id', stageId).maybeSingle()
  if (error) throw new Error(`getStageById: ${error.message}`)
  return data
}

export async function createStage(input: StageInsert): Promise<StageRow> {
  const lumiCore = await createLumiCoreClient()
  const { data, error } = await lumiCore.from('travel_stages').insert(input).select('*').single()
  if (error || !data) throw new Error(`createStage: ${error?.message ?? 'kein Ergebnis'}`)
  return data
}

export async function updateStage(stageId: string, patch: Partial<StageInsert>): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_stages').update(patch).eq('id', stageId)
  if (error) throw new Error(`updateStage: ${error.message}`)
}

export async function deleteStage(stageId: string): Promise<void> {
  const lumiCore = await createLumiCoreClient()
  const { error } = await lumiCore.from('travel_stages').delete().eq('id', stageId)
  if (error) throw new Error(`deleteStage: ${error.message}`)
}
