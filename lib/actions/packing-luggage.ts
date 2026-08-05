'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

function packingPath(slug: string): string {
  return `/trips/${slug}/packing`
}
function luggagePath(slug: string): string {
  return `/trips/${slug}/packing/luggage`
}

/** §"Optional sollen Gepäckstücke angelegt werden können" (Nutzervorgabe, wörtlich): rein additiv zur bestehenden groben luggage_assignment-Spalte -- eine Reise muss nie Gepäckstücke anlegen, um die Packliste normal zu nutzen. */
export async function addPackingLuggage(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const personId = String(formData.get('person_id') ?? '').trim() || null
  const allowedWeightRaw = String(formData.get('allowed_weight_grams') ?? '').trim()
  const allowedWeightGrams = allowedWeightRaw ? Math.max(0, Math.round(Number(allowedWeightRaw))) : null

  if (!label || !tripId) {
    revalidatePath(luggagePath(slug))
    return
  }

  const supabase = await createClient()
  const { count } = await supabase.from('packing_luggage').select('id', { count: 'exact', head: true }).eq('trip_id', tripId)
  await supabase.from('packing_luggage').insert({
    trip_id: tripId, person_id: personId, label,
    allowed_weight_grams: Number.isFinite(allowedWeightGrams) ? allowedWeightGrams : null,
    sort_order: count ?? 0,
  })

  revalidatePath(luggagePath(slug))
}

export async function updatePackingLuggage(formData: FormData) {
  const luggageId = String(formData.get('luggage_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const personId = String(formData.get('person_id') ?? '').trim() || null
  const allowedWeightRaw = String(formData.get('allowed_weight_grams') ?? '').trim()
  const allowedWeightGrams = allowedWeightRaw ? Math.max(0, Math.round(Number(allowedWeightRaw))) : null

  if (!label || !luggageId) {
    revalidatePath(luggagePath(slug))
    return
  }

  const supabase = await createClient()
  await supabase.from('packing_luggage').update({
    label, person_id: personId, allowed_weight_grams: Number.isFinite(allowedWeightGrams) ? allowedWeightGrams : null,
  }).eq('id', luggageId)

  revalidatePath(luggagePath(slug))
}

/** §"Jeder Gegenstand kann einem Gepäckstück zugeordnet werden": beim Löschen eines Gepäckstücks werden zugeordnete Gegenstände nicht gelöscht, `luggage_id` fällt via ON DELETE SET NULL automatisch auf "nicht zugeordnet" zurück. */
export async function deletePackingLuggage(formData: FormData) {
  const luggageId = String(formData.get('luggage_id') ?? '')
  const slug = String(formData.get('slug') ?? '')

  const supabase = await createClient()
  await supabase.from('packing_luggage').delete().eq('id', luggageId)

  revalidatePath(luggagePath(slug))
  revalidatePath(packingPath(slug))
}
