'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BUDGET_CATEGORY_ORDER } from '@/lib/budget'

function readCommonFields(formData: FormData) {
  const tripId       = String(formData.get('trip_id') ?? '')
  const slug         = String(formData.get('slug') ?? '')
  const stageId      = String(formData.get('stage_id') ?? '').trim()
  const category     = String(formData.get('category') ?? '').trim()
  const label        = String(formData.get('label') ?? '').trim()
  const amountRaw    = String(formData.get('amount') ?? '').trim().replace(',', '.')
  const currency     = String(formData.get('currency') ?? '').trim().toUpperCase() || 'EUR'
  const returnTo     = String(formData.get('return_to') ?? '').trim()

  const amount = amountRaw ? Number(amountRaw) : null

  return { tripId, slug, stageId, category, label, amount, amountRaw, currency, returnTo }
}

export async function createBudgetItem(formData: FormData) {
  const f = readCommonFields(formData)
  const newPath = `/trips/${f.slug}/budget/new`

  if (f.label.length < 2)
    redirect(`${newPath}?error=${encodeURIComponent('Bezeichnung: mindestens 2 Zeichen erforderlich')}`)
  if (!BUDGET_CATEGORY_ORDER.includes(f.category as never))
    redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Kategorie auswählen')}`)
  if (f.amountRaw && (f.amount === null || Number.isNaN(f.amount) || f.amount < 0))
    redirect(`${newPath}?error=${encodeURIComponent('Betrag: bitte eine gültige, nicht-negative Zahl angeben')}`)

  const supabase = await createClient()

  const { error } = await supabase.from('budget_items').insert({
    trip_id: f.tripId,
    stage_id: f.stageId || null,
    category: f.category,
    label: f.label,
    amount_actual: f.amount,
    currency: f.currency,
  })

  if (error)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(f.returnTo || `/trips/${f.slug}/budget`)
}

export async function updateBudgetItem(formData: FormData) {
  const itemId = String(formData.get('item_id') ?? '')
  const f = readCommonFields(formData)
  const editPath = `/trips/${f.slug}/budget/${itemId}/edit`

  if (f.label.length < 2)
    redirect(`${editPath}?error=${encodeURIComponent('Bezeichnung: mindestens 2 Zeichen erforderlich')}`)
  if (!BUDGET_CATEGORY_ORDER.includes(f.category as never))
    redirect(`${editPath}?error=${encodeURIComponent('Bitte eine Kategorie auswählen')}`)
  if (f.amountRaw && (f.amount === null || Number.isNaN(f.amount) || f.amount < 0))
    redirect(`${editPath}?error=${encodeURIComponent('Betrag: bitte eine gültige, nicht-negative Zahl angeben')}`)

  const supabase = await createClient()

  const { error } = await supabase.from('budget_items').update({
    stage_id: f.stageId || null,
    category: f.category,
    label: f.label,
    amount_actual: f.amount,
    currency: f.currency,
  }).eq('id', itemId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(f.returnTo || `/trips/${f.slug}/budget`)
}

export async function deleteBudgetItem(formData: FormData) {
  const itemId   = String(formData.get('item_id') ?? '')
  const slug     = String(formData.get('slug') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()
  const { error } = await supabase.from('budget_items').delete().eq('id', itemId)

  if (error)
    redirect(`/trips/${slug}/budget/${itemId}/edit?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo || `/trips/${slug}/budget`)
}

export async function setTripBudget(formData: FormData) {
  const tripId       = String(formData.get('trip_id') ?? '')
  const slug         = String(formData.get('slug') ?? '')
  const amountRaw    = String(formData.get('budget_amount') ?? '').trim().replace(',', '.')
  const currency     = String(formData.get('budget_currency') ?? '').trim().toUpperCase() || 'EUR'
  const budgetPath   = `/trips/${slug}/budget`

  const amount = amountRaw ? Number(amountRaw) : null
  if (amountRaw && (amount === null || Number.isNaN(amount) || amount < 0))
    redirect(`${budgetPath}?error=${encodeURIComponent('Budget: bitte eine gültige, nicht-negative Zahl angeben')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('trips').update({
    budget_amount: amount,
    budget_currency: currency,
  }).eq('id', tripId)

  if (error)
    redirect(`${budgetPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(budgetPath)
}
