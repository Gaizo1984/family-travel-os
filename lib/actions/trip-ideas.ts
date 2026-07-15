'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function chooseTripIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const sessionId = String(formData.get('session_id') ?? '')

  const supabase = await createClient()
  await supabase.from('trip_ideas').update({ is_chosen: true }).eq('id', ideaId)
  await supabase.from('trip_idea_sessions').update({ status: 'idea_chosen' }).eq('id', sessionId)

  redirect(`/plan/ideas/${sessionId}/${ideaId}`)
}

export async function updateTripIdeaNotes(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const sessionId = String(formData.get('session_id') ?? '')
  const developmentNotes = String(formData.get('development_notes') ?? '').trim()

  const supabase = await createClient()
  const { error } = await supabase.from('trip_ideas').update({ development_notes: developmentNotes || null }).eq('id', ideaId)

  if (error)
    redirect(`/plan/ideas/${sessionId}/${ideaId}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/plan/ideas/${sessionId}/${ideaId}`)
}

/**
 * §"Es muss die Löschoption geben": ohne dieses Löschen sammeln sich
 * Reiseideen/-varianten unbegrenzt an (jede /plan-Anfrage erzeugt 3 neue
 * Ideen). Löscht die einzelne Idee (inkl. Hotel-Shortlist/Budget/Varianten,
 * da alles in derselben Zeile liegt) -- gehört eine Idee zu einer Session
 * und war sie deren letzte verbliebene, wird die jetzt leere Session
 * gleich mitgelöscht, damit keine verwaisten Sessions liegen bleiben.
 */
export async function deleteTripIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/discover/ideas')

  const supabase = await createClient()
  const { data: idea } = await supabase.from('trip_ideas').select('session_id').eq('id', ideaId).maybeSingle()

  const { error } = await supabase.from('trip_ideas').delete().eq('id', ideaId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  if (idea?.session_id) {
    const { count } = await supabase.from('trip_ideas').select('id', { count: 'exact', head: true }).eq('session_id', idea.session_id)
    if (!count) await supabase.from('trip_idea_sessions').delete().eq('id', idea.session_id)
  }

  redirect(returnTo)
}

/** §"Favoriten & Vergleich": einfacher An/Aus-Toggle, keine Bestätigungsseite nötig (niedriges Risiko, jederzeit umkehrbar). */
export async function toggleTripIdeaFavorite(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const currentlyFavorite = String(formData.get('current') ?? '') === 'true'
  const returnTo = String(formData.get('return_to') ?? '/discover/ideas')

  const supabase = await createClient()
  const { error } = await supabase.from('trip_ideas').update({ is_favorite: !currentlyFavorite }).eq('id', ideaId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(returnTo)
}

/**
 * §"Späteres 'Als Reise anlegen' vorbereiten": markiert eine Idee aus dem
 * Vergleich als Gewinner (is_chosen, bereits bestehendes Feld -- ohne
 * Session-Statuswechsel wie bei chooseTripIdea, da eine verglichene Idee
 * auch ein sessionloser Discover-Bookmark sein kann) und speichert optional
 * die bevorzugte Variante strukturiert. Setzt noch KEINE Buchung/
 * Verfügbarkeit voraus -- reine Vormerkung für eine spätere Umwandlung.
 */
export async function chooseComparisonWinner(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const variantType = String(formData.get('variant_type') ?? '').trim() || null
  const returnTo = String(formData.get('return_to') ?? '/discover/ideas')

  const supabase = await createClient()
  const { error } = await supabase.from('trip_ideas').update({ is_chosen: true, chosen_variant_type: variantType }).eq('id', ideaId)
  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(returnTo)
}

/** Discover-Bookmark: legt eine trip_ideas-Zeile ohne Session an (origin='discover_bookmark'). */
export async function bookmarkTripIdea(formData: FormData) {
  const destination = String(formData.get('destination') ?? '').trim()
  const routeSummary = String(formData.get('route_summary') ?? '').trim()
  const bestSeason = String(formData.get('best_season') ?? '').trim()
  const reasoning = String(formData.get('reasoning') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { data: family } = await supabase.from('families').select('id').limit(1).single()
  if (!family?.id) redirect(returnTo || '/discover')

  await supabase.from('trip_ideas').insert({
    family_id: family.id,
    origin: 'discover_bookmark',
    destination,
    route_summary: routeSummary || null,
    best_season: bestSeason || null,
    reasoning: reasoning || null,
    budget_currency: 'EUR',
  })

  redirect(returnTo || '/discover')
}
