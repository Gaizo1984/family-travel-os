import { createClient } from './supabase/server'
import type { BookingType } from './supabase/types'

export type BudgetCategory =
  | 'flights' | 'accommodation' | 'transport' | 'activities'
  | 'restaurants' | 'documents' | 'insurance' | 'other'

export const BUDGET_CATEGORY_ORDER: BudgetCategory[] = [
  'flights', 'accommodation', 'transport', 'activities', 'restaurants', 'documents', 'insurance', 'other',
]

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  flights: 'Flüge',
  accommodation: 'Hotels / Unterkünfte',
  transport: 'Transfers / Mietwagen / Transport',
  activities: 'Aktivitäten / Ausflüge',
  restaurants: 'Restaurants',
  documents: 'Visa / Dokumente',
  insurance: 'Versicherungen',
  other: 'Sonstiges',
}

/** Ordnet bestehende Buchungstypen den Budget-Kategorien zu — keine Doppelpflege der Kategorien. */
export function bookingTypeToBudgetCategory(type: BookingType): BudgetCategory {
  switch (type) {
    case 'flight': return 'flights'
    case 'accommodation': return 'accommodation'
    case 'rental_car': case 'transfer': case 'train': case 'ferry': return 'transport'
    case 'activity': return 'activities'
    case 'restaurant': return 'restaurants'
    case 'insurance': return 'insurance'
    default: return 'other'
  }
}

export type BudgetLineItem = {
  id: string
  source: 'booking' | 'manual'
  category: BudgetCategory
  label: string
  amount: number
  currency: string
  /** null, wenn für `currency` kein Wechselkurs hinterlegt ist — wird dann nie naiv addiert. */
  convertedAmount: number | null
  href: string
}

export type BudgetResult = {
  tripCurrency: string
  budgetAmount: number | null
  totalConverted: number
  remaining: number | null
  percentUsed: number | null
  byCategory: Record<BudgetCategory, { total: number; items: BudgetLineItem[] }>
  items: BudgetLineItem[]
  /** Fremdwährungen, für die noch kein Kurs hinterlegt ist. */
  missingRateCurrencies: string[]
}

export async function computeTripBudget(tripId: string): Promise<BudgetResult> {
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('id, slug, budget_amount, budget_currency')
    .eq('id', tripId)
    .maybeSingle()

  const tripCurrency = trip?.budget_currency ?? 'EUR'
  const budgetAmount = trip?.budget_amount ?? null
  const slug = trip?.slug ?? ''

  const { data: rateRows } = await supabase
    .from('trip_exchange_rates')
    .select('currency, rate')
    .eq('trip_id', tripId)
  const rates = new Map<string, number>((rateRows ?? []).map((r) => [r.currency, r.rate]))
  rates.set(tripCurrency, 1)

  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select('id, type, title, amount, currency, status')
    .eq('trip_id', tripId)

  const { data: itemsRaw } = await supabase
    .from('budget_items')
    .select('id, category, label, amount_actual, amount_planned, currency')
    .eq('trip_id', tripId)

  const items: BudgetLineItem[] = []

  for (const b of bookingsRaw ?? []) {
    if (b.status === 'cancelled' || b.amount == null) continue
    const currency = b.currency || tripCurrency
    const rate = rates.get(currency)
    items.push({
      id: b.id,
      source: 'booking',
      category: bookingTypeToBudgetCategory(b.type as BookingType),
      label: b.title,
      amount: b.amount,
      currency,
      convertedAmount: rate != null ? b.amount * rate : null,
      href: `/trips/${slug}/bookings/${b.id}`,
    })
  }

  for (const i of itemsRaw ?? []) {
    const amount = i.amount_actual ?? i.amount_planned
    if (amount == null) continue
    const currency = i.currency || tripCurrency
    const rate = rates.get(currency)
    items.push({
      id: i.id,
      source: 'manual',
      category: (BUDGET_CATEGORY_ORDER as string[]).includes(i.category) ? (i.category as BudgetCategory) : 'other',
      label: i.label,
      amount,
      currency,
      convertedAmount: rate != null ? amount * rate : null,
      href: `/trips/${slug}/budget/${i.id}/edit`,
    })
  }

  const byCategory = Object.fromEntries(
    BUDGET_CATEGORY_ORDER.map((cat) => [cat, { total: 0, items: [] as BudgetLineItem[] }]),
  ) as Record<BudgetCategory, { total: number; items: BudgetLineItem[] }>

  for (const item of items) {
    byCategory[item.category].items.push(item)
    if (item.convertedAmount != null) byCategory[item.category].total += item.convertedAmount
  }

  const totalConverted = items.reduce((sum, i) => sum + (i.convertedAmount ?? 0), 0)
  const missingRateCurrencies = [...new Set(items.filter((i) => i.convertedAmount == null).map((i) => i.currency))]

  const remaining = budgetAmount != null ? budgetAmount - totalConverted : null
  const percentUsed = budgetAmount != null && budgetAmount > 0 ? (totalConverted / budgetAmount) * 100 : null

  return { tripCurrency, budgetAmount, totalConverted, remaining, percentUsed, byCategory, items, missingRateCurrencies }
}
