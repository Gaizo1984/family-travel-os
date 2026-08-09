'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { tripDebriefs } from '@/lib/lumi-core-data/group1-documents-insurance-journey-packing'
import { createPendingMemoryCandidate, hasDeclinedSimilarMemory } from '@/lib/family-memories'
import {
  DEBRIEF_STEPS, nextDebriefStep, previousDebriefStep, buildDebriefMemoryCandidates, PACKING_FEEDBACK_TYPES,
  type DebriefStep, type DebriefAnswers, type PackingFeedbackType, type PackingFeedbackEntry,
} from '@/lib/trip-debriefs'
import { loadPackingItems } from '@/lib/packing-list'
import { maybeSuggestPackingPreference } from '@/lib/actions/packing-preference-learning'

function isPackingFeedbackType(value: string): value is PackingFeedbackType {
  return (PACKING_FEEDBACK_TYPES as string[]).includes(value)
}

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

  const existing = await tripDebriefs.getById(debriefId)
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
  } else if (step === 'packing_feedback') {
    // §"Bestehende Packgegenstände direkt auswählbar machen. Fehlende
    // Gegenstände können per Freitext ergänzt werden" (Nutzervorgabe,
    // wörtlich): je Feedbacktyp eine Mehrfachauswahl bestehender Items
    // (packing_feedback_<typ>_items[]) + ein optionales Freitextfeld
    // (packing_feedback_<typ>_text). Die Person wird bei ausgewählten Items
    // automatisch aus dem Item selbst übernommen (nicht redundant erneut
    // abgefragt) -- nur Freitext-Ergänzungen bleiben ohne Personenbezug.
    const supabase = await createClient()
    const packingItems = existing?.trip_id ? await loadPackingItems(supabase, existing.trip_id) : []
    const itemById = new Map(packingItems.map((i) => [i.id, i]))
    const entries: PackingFeedbackEntry[] = []

    for (const type of PACKING_FEEDBACK_TYPES) {
      const itemIds = formData.getAll(`packing_feedback_${type}_items`).map(String)
      for (const itemId of itemIds) {
        const item = itemById.get(itemId)
        if (!item) continue
        entries.push({ item_id: itemId, free_text: null, feedback_type: type, person_id: item.personId })
      }
      const freeText = String(formData.get(`packing_feedback_${type}_text`) ?? '').trim()
      if (freeText) entries.push({ item_id: null, free_text: freeText, feedback_type: type, person_id: null })
    }

    if (entries.length > 0) answers.packing_feedback = entries
  }

  const next = nextDebriefStep(step)
  await tripDebriefs.update(debriefId, { answers, current_step: next ?? step, updated_at: new Date().toISOString() })

  redirect(debriefPath(slug))
}

export async function goToPreviousDebriefStep(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const step = String(formData.get('step') ?? '')
  if (!isDebriefStep(step)) redirect(debriefPath(slug))

  const prev = previousDebriefStep(step)
  if (!prev) redirect(debriefPath(slug))

  await tripDebriefs.update(debriefId, { current_step: prev })
  redirect(debriefPath(slug))
}

/** §"Übersprungen werden" (Nutzervorgabe): beendet den aktiven Zustand, damit der partielle Unique-Index (nur ein aktiver Dialog je Reise) keinen erneuten Start blockiert -- wird aber per triggerDueTripDebriefs() ohnehin nie erneut angelegt (siehe dortiger Kommentar "einmalig"). */
export async function skipDebrief(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today')

  await tripDebriefs.update(debriefId, { status: 'skipped' })
  redirect(returnTo)
}

/** §"Dauerhaft geschlossen werden" (Nutzervorgabe) -- eigener Status, unterscheidbar von "später erneut angeboten" (skipped ist hier bewusst identisch behandelt, da ein Dialog laut Vorgabe ohnehin nur einmalig entsteht; der eigene Status bleibt für spätere Auswertung/Statistik erhalten). */
export async function closeDebrief(formData: FormData) {
  const debriefId = String(formData.get('debrief_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/today')

  await tripDebriefs.update(debriefId, { status: 'closed' })
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
  const supabase = await createClient()
  const packingItems = await loadPackingItems(supabase, tripId)
  const candidates = buildDebriefMemoryCandidates(tripTitle, answers, participants, packingItems)

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

  const existing = await tripDebriefs.getById(debriefId)
  const answers: DebriefAnswers = (existing?.answers as DebriefAnswers) ?? {}

  let participants: Array<{ id: string; name: string }> = []
  try { participants = JSON.parse(participantsRaw) } catch { participants = [] }

  await proposeDebriefMemories(familyId, tripId, tripTitle, answers, participants)
  await tripDebriefs.update(debriefId, { status: 'completed' })

  // §"Kontrolliertes Mehrfach-Reisen-Lernen" (Nutzervorgabe): best-effort,
  // niemals blockierend -- läuft nur für die Personen (inkl. "Gemeinsam" =
  // null), die in DIESEM Rückblick tatsächlich Packlisten-Feedback gegeben
  // haben (lib/actions/packing-preference-learning.ts).
  const distinctPersonIds = new Set((answers.packing_feedback ?? []).map((e) => e.person_id))
  for (const personId of distinctPersonIds) {
    try {
      await maybeSuggestPackingPreference(familyId, personId)
    } catch (e) {
      console.error('[trip-debriefs] maybeSuggestPackingPreference fehlgeschlagen', e)
    }
  }

  redirect(`/trips/${slug}`)
}

/** §"Highlight-Fotos" (Nutzervorgabe): erster Schreiber der bereits bestehenden, bisher ungenutzten Spalte memory_photos.is_highlight. */
export async function toggleMemoryPhotoHighlight(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const currentlyHighlighted = String(formData.get('currently_highlighted') ?? '') === 'true'

  const lumiCore = await createLumiCoreClient()
  await lumiCore.from('travel_memory_photos').update({ is_highlight: !currentlyHighlighted }).eq('id', photoId)

  redirect(debriefPath(slug))
}
