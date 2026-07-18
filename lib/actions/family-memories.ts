'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * §"Nie automatisch Daten ändern -- immer Bestätigung verlangen" (Nutzervorgabe,
 * bestehendes Muster wie commitConciergeAction): erst der bewusste Klick auf
 * "Bestätigen" schaltet einen Memory-Kandidaten von 'pending' auf 'confirmed'.
 * RLS (family_members_only) reicht als Zugriffsschutz -- kein redundanter
 * family_id-Filter in der Query nötig (gleiches Muster wie
 * lib/actions/bookings.ts::toggleBookingCancelled).
 */
/**
 * §"Buttons: Speichern / Bearbeiten / Nicht speichern" (Nutzervorgabe):
 * optionales `summary`-Feld -- nur gesetzt, wenn die Karte im Bearbeiten-Modus
 * abgeschickt wurde (siehe components/MemoryCandidateCard.tsx). Ohne dieses
 * Feld (normaler "Speichern"-Klick) verhält sich die Funktion exakt wie
 * zuvor: nur der Status wechselt.
 */
export async function confirmFamilyMemory(formData: FormData) {
  const memoryId = String(formData.get('memory_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/concierge'
  const editedSummary = String(formData.get('summary') ?? '').trim()
  if (!memoryId) redirect(returnTo)

  const supabase = await createClient()
  const update: { status: string; updated_at: string; summary?: string } = { status: 'confirmed', updated_at: new Date().toISOString() }
  if (editedSummary) update.summary = editedSummary
  const { error } = await supabase.from('family_memories').update(update).eq('id', memoryId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  redirect(returnTo)
}

/** §"Ablehnung wird respektiert" -- Eintrag bleibt (status='declined') statt gelöscht zu werden, damit derselbe Kandidat nicht erneut vorgeschlagen wird (siehe hasDeclinedSimilarMemory). */
export async function declineFamilyMemory(formData: FormData) {
  const memoryId = String(formData.get('memory_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/concierge'
  if (!memoryId) redirect(returnTo)

  const supabase = await createClient()
  const { error } = await supabase.from('family_memories').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', memoryId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  redirect(returnTo)
}

/** §"Einträge bearbeiten" ("Unsere Vorlieben"): nur die menschenlesbare Zusammenfassung -- category/memory_type bleiben wie ursprünglich erkannt, structured_value wird bewusst nicht über ein Freitextfeld verändert. */
export async function updateFamilyMemorySummary(formData: FormData) {
  const memoryId = String(formData.get('memory_id') ?? '')
  const summary = String(formData.get('summary') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/today/preferences'
  if (!memoryId || !summary) redirect(returnTo)

  const supabase = await createClient()
  const { error } = await supabase.from('family_memories').update({ summary, updated_at: new Date().toISOString() }).eq('id', memoryId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  redirect(returnTo)
}

/** Endgültiges Löschen eines bereits bestätigten oder abgelehnten Eintrags (z.B. aus "Unsere Vorlieben"). */
export async function deleteFamilyMemory(formData: FormData) {
  const memoryId = String(formData.get('memory_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/concierge'
  if (!memoryId) redirect(returnTo)

  const supabase = await createClient()
  const { error } = await supabase.from('family_memories').delete().eq('id', memoryId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)
  redirect(returnTo)
}
