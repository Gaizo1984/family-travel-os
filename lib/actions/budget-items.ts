'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BUDGET_CATEGORY_ORDER } from '@/lib/budget'
import { resolveQuickCurrency } from '@/app/trips/[id]/CurrencyQuickSelect'

function readCommonFields(formData: FormData) {
  const tripId              = String(formData.get('trip_id') ?? '')
  const slug                = String(formData.get('slug') ?? '')
  const stageId              = String(formData.get('stage_id') ?? '').trim()
  const bookingId            = String(formData.get('booking_id') ?? '').trim()
  const category              = String(formData.get('category') ?? '').trim()
  const label                = String(formData.get('label') ?? '').trim()
  const amountRaw            = String(formData.get('amount') ?? '').trim().replace(',', '.')
  const currency             = resolveQuickCurrency(formData, 'currency', 'EUR')
  const returnTo             = String(formData.get('return_to') ?? '').trim()
  const existingStoragePath  = String(formData.get('existing_storage_path') ?? '').trim()
  const merchant              = String(formData.get('merchant') ?? '').trim()
  const receiptNumber        = String(formData.get('receipt_number') ?? '').trim()

  const amount = amountRaw ? Number(amountRaw) : null

  return {
    tripId, slug, stageId, bookingId, category, label, amount, amountRaw, currency,
    returnTo, existingStoragePath, merchant, receiptNumber,
  }
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

  const details: Record<string, string> = {}
  if (f.merchant) details.merchant = f.merchant
  if (f.receiptNumber) details.receipt_number = f.receiptNumber
  if (f.existingStoragePath) details.source = 'receipt'

  const { error } = await supabase.from('budget_items').insert({
    trip_id: f.tripId,
    stage_id: f.stageId || null,
    booking_id: f.bookingId || null,
    category: f.category,
    label: f.label,
    amount_actual: f.amount,
    currency: f.currency,
    storage_bucket: f.existingStoragePath ? 'documents' : null,
    storage_path: f.existingStoragePath || null,
    details: Object.keys(details).length > 0 ? details : null,
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
    booking_id: f.bookingId || null,
    category: f.category,
    label: f.label,
    amount_actual: f.amount,
    currency: f.currency,
  }).eq('id', itemId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(f.returnTo || `/trips/${f.slug}/budget`)
}

export async function removeBudgetItemReceipt(formData: FormData) {
  const itemId      = String(formData.get('item_id') ?? '')
  const slug        = String(formData.get('slug') ?? '')
  const storagePath = String(formData.get('storage_path') ?? '').trim()
  const returnTo    = String(formData.get('return_to') ?? '').trim()
  const editPath    = returnTo || `/trips/${slug}/budget/${itemId}/edit`

  const supabase = await createClient()

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('documents').remove([storagePath])
    if (storageError)
      redirect(`${editPath}?error=${encodeURIComponent('Beleg konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('budget_items')
    .update({ storage_bucket: null, storage_path: null })
    .eq('id', itemId)

  if (error)
    redirect(`${editPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(editPath)
}

export async function deleteBudgetItem(formData: FormData) {
  const itemId      = String(formData.get('item_id') ?? '')
  const slug        = String(formData.get('slug') ?? '')
  const storagePath = String(formData.get('storage_path') ?? '').trim()
  const returnTo    = String(formData.get('return_to') ?? '').trim()

  const supabase = await createClient()

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('documents').remove([storagePath])
    // Abbrechen statt trotzdem zu löschen — sonst bliebe der Beleg als
    // nicht mehr referenzierter Storage-Orphan zurück.
    if (storageError)
      redirect(`/trips/${slug}/budget/${itemId}/edit?error=${encodeURIComponent('Beleg konnte nicht gelöscht werden: ' + storageError.message)}`)
  }

  const { error } = await supabase.from('budget_items').delete().eq('id', itemId)

  if (error)
    redirect(`/trips/${slug}/budget/${itemId}/edit?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(returnTo || `/trips/${slug}/budget`)
}

export async function setTripBudget(formData: FormData) {
  const tripId       = String(formData.get('trip_id') ?? '')
  const slug         = String(formData.get('slug') ?? '')
  const amountRaw    = String(formData.get('budget_amount') ?? '').trim().replace(',', '.')
  const currency     = resolveQuickCurrency(formData, 'budget_currency', 'EUR')
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
