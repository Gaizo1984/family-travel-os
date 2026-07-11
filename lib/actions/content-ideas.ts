'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Json } from '@/lib/supabase/types'

type SuggestionJson = {
  title: string; format: string; hook: string; angle: string
  caption_draft: string; hashtags: string[]
}

/** Markiert einen der KI-Vorschläge als gewählt (rein informativ, kein Draft). */
export async function chooseContentIdeaSuggestion(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const chosenIndex = Number(formData.get('chosen_index') ?? '0')

  const supabase = await createClient()
  await supabase.from('content_ideas').update({ chosen_index: chosenIndex, status: 'chosen' }).eq('id', ideaId)

  redirect(`/content-studio/ideas/${ideaId}`)
}

/** Erzeugt aus einem gewählten Vorschlag einen echten, editierbaren Draft. */
export async function createContentDraftFromIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const suggestionIndex = Number(formData.get('suggestion_index') ?? '0')

  const supabase = await createClient()
  const { data: idea } = await supabase.from('content_ideas').select('project_id, suggestions').eq('id', ideaId).maybeSingle()

  if (!idea)
    redirect(`/content-studio/ideas/${ideaId}?error=${encodeURIComponent('Idee nicht gefunden')}`)

  if (!idea.project_id)
    redirect(`/content-studio/ideas/${ideaId}?error=${encodeURIComponent('Kein Projekt für diese Idee gefunden')}`)

  const suggestions = idea.suggestions as unknown as SuggestionJson[]
  const suggestion = suggestions[suggestionIndex]
  if (!suggestion)
    redirect(`/content-studio/ideas/${ideaId}?error=${encodeURIComponent('Vorschlag nicht gefunden')}`)

  const structure = suggestion.format === 'reel'
    ? { scenes: [{ text: suggestion.hook }], outro: '', caption: suggestion.caption_draft, hashtags: suggestion.hashtags }
    : suggestion.format === 'carousel'
      ? { slides: [{ text: suggestion.hook }], caption: suggestion.caption_draft, hashtags: suggestion.hashtags }
      : { text: suggestion.caption_draft, hashtags: suggestion.hashtags }

  const { data: draft, error } = await supabase.from('content_drafts').insert({
    idea_id: ideaId,
    project_id: idea.project_id,
    draft_type: suggestion.format === 'reel' ? 'reel_plan' : suggestion.format === 'carousel' ? 'carousel_plan' : suggestion.format === 'story' ? 'reel_plan' : 'caption',
    structure,
    notes: `${suggestion.title} — ${suggestion.angle}`,
  }).select('id').single()

  if (error || !draft)
    redirect(`/content-studio/ideas/${ideaId}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  await supabase.from('content_ideas').update({ chosen_index: suggestionIndex, status: 'chosen' }).eq('id', ideaId)

  redirect(`/content-studio/drafts/${draft.id}`)
}

/** Favorisieren/Entfavorisieren — unabhängig vom status (suggested/chosen/archived). */
export async function toggleFavoriteContentIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const nextValue = formData.get('next_value') === 'true'
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  await supabase.from('content_ideas').update({ is_favorite: nextValue }).eq('id', ideaId)

  redirect(returnTo || `/content-studio/ideas/${ideaId}`)
}

export async function archiveContentIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  await supabase.from('content_ideas').update({ status: 'archived' }).eq('id', ideaId)

  redirect(returnTo || '/content-studio/ideas')
}

export async function unarchiveContentIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { data: idea } = await supabase.from('content_ideas').select('chosen_index').eq('id', ideaId).maybeSingle()
  await supabase.from('content_ideas').update({ status: idea?.chosen_index !== null ? 'chosen' : 'suggested' }).eq('id', ideaId)

  redirect(returnTo || `/content-studio/ideas/${ideaId}`)
}

/** Löscht eine Idee inkl. eines eventuell hochgeladenen Fotos (kein Storage-Waise). */
export async function deleteContentIdea(formData: FormData) {
  const ideaId = String(formData.get('idea_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { data: idea } = await supabase.from('content_ideas').select('source_media_storage_path').eq('id', ideaId).maybeSingle()

  if (idea?.source_media_storage_path)
    await supabase.storage.from('documents').remove([idea.source_media_storage_path])

  const { error } = await supabase.from('content_ideas').delete().eq('id', ideaId)
  if (error)
    redirect(`/content-studio/ideas/${ideaId}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo || '/content-studio/ideas')
}

export async function updateContentDraft(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const draftType = String(formData.get('draft_type') ?? '')
  const visibility = String(formData.get('visibility') ?? 'private')
  const scheduledAt = String(formData.get('scheduled_at') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const instagramReady = formData.get('instagram_ready') === 'on'

  const supabase = await createClient()

  let structure: Record<string, unknown>
  if (draftType === 'reel_plan') {
    const sceneTexts = formData.getAll('scene_text').map(String)
    structure = { scenes: sceneTexts.filter(Boolean).map((text) => ({ text })), outro: String(formData.get('outro') ?? '') }
  } else if (draftType === 'carousel_plan') {
    const slideTexts = formData.getAll('slide_text').map(String)
    structure = { slides: slideTexts.filter(Boolean).map((text) => ({ text })) }
  } else {
    structure = { text: String(formData.get('caption_text') ?? '') }
  }
  structure.hashtags = String(formData.get('hashtags') ?? '').split(',').map((h) => h.trim()).filter(Boolean)

  const { error } = await supabase.from('content_drafts').update({
    structure: structure as Json,
    visibility,
    scheduled_at: scheduledAt || null,
    notes: notes || null,
    instagram_ready: instagramReady,
  }).eq('id', draftId)

  if (error)
    redirect(`/content-studio/drafts/${draftId}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/content-studio/drafts/${draftId}`)
}
