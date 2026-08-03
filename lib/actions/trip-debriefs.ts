'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createPendingMemoryCandidate, hasDeclinedSimilarMemory } from '@/lib/family-memories'
import { DEBRIEF_STEPS, nextDebriefStep, previousDebriefStep, buildDebriefMemoryCandidates, type DebriefStep, type DebriefAnswers } from '@/lib/trip-debriefs'

function isDebriefStep(value: string): value is DebriefStep {
  return (DEBRIEF_STEPS as readonly string[]).includes(value)
}

function debriefPath(slug: string): string {
  return `/trips/${slug}/debrief`
}

/**
 * §"Server Action pro Schritt-Weiter-Klick, damit 'später fortsetzen' auch
 * geräte-/sitzungsübergreifend funktioniert" (Architekturplan): schreibt die
 * Antwort des GERADE ABGESCHLOSSENEN Schritts in `answers` und rückt
 * `current_step` auf den nächsten vor -- ein einziger genereller Pfad statt
 * einer Server Action je Schritt, da sich nur die gesammelten Felder
 * unterscheiden.
 */
export async function saveDebriefStep(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const step = String(formData.get('step') ?? '')
  if (!isDebriefStep(step)) redirect(debriefPath(slug))

  const supabase = await createClient()
  const { data: existing } = await supabase.from('trip_debriefs').select('answers').eq('id', debriefId).maybeSingle()
  const answers: DebriefAnswers = (existing?.answers as DebriefAnswers) ?? {}

  if (step === 'hotel_rating') {
    const rating = Number(formData.get('rating') ?? 0)
    const note = String(formData.get('note') ?? '').trim()
    if (rating > 0) answers.hotel_rating = { rating, ...(note ? { note } : {}) }
  } else if (step === 'best_moment') {
    const text = String(formData.get('text') ?? '').trim()
    if (text) answers.best_moment = { text }
  } else if (step === 'worst_moment') {
    const text = String(formData.get('text') ?? '').trim()
    if (text) answers.worst_moment = { text }
  } else if (step === 'person_highlights') {
    const highlights: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('highlight_')) continue
      const text = String(value).trim()
      if (text) highlights[key.slice('highlight_'.length)] = text
    }
    if (Object.keys(highlights).length > 0) answers.person_highlights = highlights
  } else if (step === 'would_revisit') {
    const value = String(formData.get('value') ?? '')
    if (value === 'yes' || value === 'no' || value === 'maybe') answers.would_revisit = { value }
  }

  const next = nextDebriefStep(step)
  await supabase.from('trip_debriefs').update({ answers, current_step: next ?? step, updated_at: new Date().toISOString() }).eq('id', debriefId)

  redirect(debriefPath(slug))
}

export async function goToPreviousDebriefStep(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const step = String(formData.get('step') ?? '')
  if (!isDebriefStep(step)) redirect(debriefPath(slug))

  const prev = previousDebriefStep(step)
  if (!prev) redirect(debriefPath(slug))

  const supabase = await createClient()
  await supabase.from('trip_debriefs').update({ current_step: prev }).eq('id', debriefId)
  redirect(debriefPath(slug))
}

/** §"Übersprungen werden" (Nutzervorgabe): beendet den aktiven Zustand, damit der partielle Unique-Index (nur ein aktiver Dialog je Reise) keinen erneuten Start blockiert -- wird aber per triggerDueTripDebriefs() ohnehin nie erneut angelegt (siehe dortiger Kommentar "einmalig"). */
export async function skipDebrief(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today')

  const supabase = await createClient()
  await supabase.from('trip_debriefs').update({ status: 'skipped' }).eq('id', debriefId)
  redirect(returnTo)
}

/** §"Dauerhaft geschlossen werden" (Nutzervorgabe) -- eigener Status, unterscheidbar von "später erneut angeboten" (skipped ist hier bewusst identisch behandelt, da ein Dialog laut Vorgabe ohnehin nur einmalig entsteht; der eigene Status bleibt für spätere Auswertung/Statistik erhalten). */
export async function closeDebrief(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today')

  const supabase = await createClient()
  await supabase.from('trip_debriefs').update({ status: 'closed' }).eq('id', debriefId)
  redirect(returnTo)
}

/**
 * §"Kontrolliertes Lernen" (Nutzervorgabe): nur Antworten, die ein
 * anerkanntes, wiederholbares Vorlieben-Muster erfüllen, werden als
 * bestätigungspflichtiger Vorschlag angelegt -- ein einzelnes "schönstes
 * Erlebnis" bleibt reiner Fließtext in trip_debriefs.answers, wird NIE
 * automatisch zu einer family_memories-Zeile. Dieselbe Ablehnungs-Prüfung
 * (hasDeclinedSimilarMemory) wie die übrigen KI-Lernpfade -- eine bereits
 * abgelehnte, sinngemäß gleiche Erkenntnis wird nicht erneut vorgeschlagen.
 */
async function proposeDebriefMemories(
  familyId: string, tripId: string, tripTitle: string, answers: DebriefAnswers,
  participants: Array<{ id: string; name: string }>,
): Promise<void> {
  const candidates = buildDebriefMemoryCandidates(tripTitle, answers, participants)

  for (const candidate of candidates) {
    // §Debrief entsteht laut Trigger-Cron nur einmalig je Reise (siehe
    // lib/trip-debrief-generation.ts) -- die einzige Dopplungsgefahr wäre ein
    // doppelter Submit dieses Schritts; dagegen genügt die bestehende
    // hasDeclinedSimilarMemory-Prüfung für abgelehnte Vorschläge, ein
    // versehentlicher doppelter PENDING-Vorschlag bleibt tolerierbar (wird
    // beim Bestätigen/Ablehnen unter "Unsere Vorlieben" ohnehin sichtbar).
    if (await hasDeclinedSimilarMemory(familyId, candidate.category, candidate.summary)) continue

    await createPendingMemoryCandidate({
      familyId, personId: candidate.personId, tripId,
      memoryType: candidate.memoryType, category: candidate.category,
      structuredValue: candidate.structuredValue, summary: candidate.summary,
      source: 'nachreise_dialog',
    })
  }
}

/**
 * §Letzter Schritt "Bestätigen" (Nutzervorgabe): schließt den Dialog UND
 * erzeugt in einem Zug die bestätigungspflichtigen Vorschläge -- die
 * eigentliche Bestätigung passiert weiterhin erst unter "Unsere Vorlieben"
 * (components/MemoryCandidateCard.tsx), hier entsteht nur der pending-Vorschlag.
 */
export async function confirmDebrief(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const tripId = String(formData.get('trip_id') ?? '')
  const familyId = String(formData.get('family_id') ?? '')
  const tripTitle = String(formData.get('trip_title') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const participantsRaw = String(formData.get('participants_json') ?? '[]')

  const supabase = await createClient()
  const { data: existing } = await supabase.from('trip_debriefs').select('answers').eq('id', debriefId).maybeSingle()
  const answers: DebriefAnswers = (existing?.answers as DebriefAnswers) ?? {}

  let participants: Array<{ id: string; name: string }> = []
  try { participants = JSON.parse(participantsRaw) } catch { participants = [] }

  await proposeDebriefMemories(familyId, tripId, tripTitle, answers, participants)
  await supabase.from('trip_debriefs').update({ status: 'completed' }).eq('id', debriefId)

  redirect(`/trips/${slug}`)
}

/** §"Highlight-Fotos" (Nutzervorgabe): erster Schreiber der bereits bestehenden, bisher ungenutzten Spalte memory_photos.is_highlight. */
export async function toggleMemoryPhotoHighlight(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const currentlyHighlighted = String(formData.get('currently_highlighted') ?? '') === 'true'

  const supabase = await createClient()
  await supabase.from('memory_photos').update({ is_highlight: !currentlyHighlighted }).eq('id', photoId)

  redirect(debriefPath(slug))
}
