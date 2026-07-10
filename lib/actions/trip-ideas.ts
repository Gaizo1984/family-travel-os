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
