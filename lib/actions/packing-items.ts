'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import type { PackingStatus, LuggageAssignment, PackingPriority } from '@/lib/packing-list'
import { PACKING_STATUS_ORDER, LUGGAGE_ASSIGNMENT_ORDER, PACKING_PRIORITY_ORDER } from '@/lib/packing-list'

function packingPath(slug: string): string {
  return `/trips/${slug}/packing`
}

function isPackingPriority(value: string): value is PackingPriority {
  return (PACKING_PRIORITY_ORDER as string[]).includes(value)
}

/** §"Eigenen Gegenstand hinzufügen" (Nutzervorgabe): source bleibt 'manuell'/source_key bleibt NULL -- eine Regenerierung fasst diese Zeile nie an (siehe lib/packing-list-generation.ts). */
export async function addPackingItem(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim() || null
  const personId = String(formData.get('person_id') ?? '').trim() || null
  const quantityRaw = Number(formData.get('quantity') ?? 1)
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw) : 1
  const priorityRaw = String(formData.get('priority') ?? '')
  const priority = isPackingPriority(priorityRaw) ? priorityRaw : 'empfohlen'
  const isLastMinute = formData.get('is_last_minute') === 'on'

  if (label.length < 1 || !tripId) {
    revalidatePath(packingPath(slug))
    return
  }

  const supabase = await createLumiCoreClient()
  await supabase.from('travel_packing_items').insert({
    trip_id: tripId, household_member_id: personId, label, category, quantity, priority, is_last_minute: isLastMinute,
    status: 'offen', luggage_assignment: 'unassigned', source: 'manuell', source_key: null,
  })

  revalidatePath(packingPath(slug))
}

function isPackingStatus(value: string): value is PackingStatus {
  return (PACKING_STATUS_ORDER as string[]).includes(value)
}

export async function updatePackingItemStatus(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!isPackingStatus(status)) return

  const supabase = await createLumiCoreClient()
  await supabase.from('travel_packing_items').update({ status }).eq('id', itemId)

  revalidatePath(packingPath(slug))
}

function isLuggageAssignment(value: string): value is LuggageAssignment {
  return (LUGGAGE_ASSIGNMENT_ORDER as string[]).includes(value)
}

/** §"Anzahl bearbeiten / Person ändern / Gepäckstück zuordnen / Notiz ergänzen" (Nutzervorgabe): bewusst EINE Bearbeiten-Aktion für die selteneren Feldänderungen, statt vier einzelner -- der schnelle Eingepackt-Toggle bleibt als eigene Aktion getrennt (siehe oben), dieses Formular deckt zusätzlich die selteneren Status-Werte (noch_besorgen/nicht_benoetigt) mit ab. */
export async function updatePackingItemDetails(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const quantityRaw = Number(formData.get('quantity') ?? 1)
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw) : 1
  const personId = String(formData.get('person_id') ?? '').trim() || null
  const luggageAssignmentRaw = String(formData.get('luggage_assignment') ?? '')
  const luggageAssignment = isLuggageAssignment(luggageAssignmentRaw) ? luggageAssignmentRaw : 'unassigned'
  const luggageId = String(formData.get('luggage_id') ?? '').trim() || null
  const weightGramsRaw = String(formData.get('weight_grams') ?? '').trim()
  const weightGrams = weightGramsRaw ? Math.max(0, Math.round(Number(weightGramsRaw))) : null
  const note = String(formData.get('note') ?? '').trim() || null
  const priorityRaw = String(formData.get('priority') ?? '')
  const priority = isPackingPriority(priorityRaw) ? priorityRaw : 'empfohlen'
  const isLastMinute = formData.get('is_last_minute') === 'on'
  const statusRaw = String(formData.get('status') ?? '')

  const supabase = await createLumiCoreClient()
  await supabase.from('travel_packing_items').update({
    quantity, household_member_id: personId, luggage_assignment: luggageAssignment, luggage_id: luggageId,
    weight_grams: Number.isFinite(weightGrams) ? weightGrams : null,
    note, priority, is_last_minute: isLastMinute,
    ...(isPackingStatus(statusRaw) ? { status: statusRaw } : {}),
  }).eq('id', itemId)

  revalidatePath(packingPath(slug))
}

export async function deletePackingItem(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const slug = String(formData.get('slug') ?? '')

  const supabase = await createLumiCoreClient()
  await supabase.from('travel_packing_items').delete().eq('id', itemId)

  revalidatePath(packingPath(slug))
}

/** §"Löschbutton für die Packliste" (Nutzervorgabe): löscht ALLE Gegenstände (manuell UND KI-generierte) dieser Reise plus einen ggf. offenen Aktualisierungs-Entwurf -- eigene Bestätigungsseite (app/(app)/trips/[id]/packing/delete/page.tsx), gleiches Muster wie das endgültige Löschen einer Reise (app/(app)/trips/[id]/delete/page.tsx). */
export async function deletePackingList(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')

  const supabase = await createLumiCoreClient()
  await supabase.from('travel_packing_items').delete().eq('trip_id', tripId)
  await supabase.from('travel_packing_list_drafts').delete().eq('trip_id', tripId)

  redirect(packingPath(slug))
}
