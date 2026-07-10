'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Holt einen aktuellen Wechselkurs von EODHD (Forex-Endpoint, bereits vorhandener,
 * bezahlter Key aus einem anderen Projekt — hier nur serverseitig gelesen, nie an
 * den Client übertragen). Symbolformat "{FREMDWÄHRUNG}{REISEWÄHRUNG}.FOREX", z. B.
 * "USDEUR.FOREX" = wie viel EUR ein USD wert ist. Schlägt der Abruf fehl, bleibt
 * der zuletzt gespeicherte/manuelle Kurs unverändert — kein Erfinden von Kursen.
 */
export async function refreshExchangeRate(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase()
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const detailPath = returnTo || `/trips/${slug}/budget`

  if (!currency)
    redirect(`${detailPath}?error=${encodeURIComponent('Bitte eine Fremdwährung angeben.')}`)

  if (!process.env.EODHD_API_KEY)
    redirect(`${detailPath}?error=${encodeURIComponent('Automatischer Kursabruf ist aktuell nicht konfiguriert. Bitte Kurs manuell eintragen.')}`)

  const supabase = await createClient()
  const { data: trip } = await supabase.from('trips').select('budget_currency').eq('id', tripId).maybeSingle()
  const tripCurrency = trip?.budget_currency ?? 'EUR'

  if (currency === tripCurrency)
    redirect(`${detailPath}?error=${encodeURIComponent('Diese Währung entspricht bereits der Reisewährung.')}`)

  let rate: number
  try {
    const symbol = `${currency}${tripCurrency}.FOREX`
    const url = `https://eodhd.com/api/real-time/${symbol}?api_token=${process.env.EODHD_API_KEY}&fmt=json`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`EODHD-Anfrage fehlgeschlagen (${response.status})`)
    const data = await response.json()
    const value = Number(data?.close)
    if (!value || Number.isNaN(value)) throw new Error('Kein gültiger Kurs in der Antwort enthalten')
    rate = value
  } catch (e) {
    redirect(`${detailPath}?error=${encodeURIComponent('Kursabruf fehlgeschlagen: ' + (e instanceof Error ? e.message : 'unbekannter Fehler') + '. Bitte manuell eintragen oder erneut versuchen.')}`)
  }

  const { error } = await supabase.from('trip_exchange_rates').upsert({
    trip_id: tripId, currency, rate, source: 'eodhd', updated_at: new Date().toISOString(),
  })
  if (error)
    redirect(`${detailPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(detailPath)
}

export async function setManualExchangeRate(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase()
  const rateRaw = String(formData.get('rate') ?? '').trim().replace(',', '.')
  const returnTo = String(formData.get('return_to') ?? '').trim()
  const detailPath = returnTo || `/trips/${slug}/budget`

  const rate = Number(rateRaw)
  if (!currency || !rateRaw || Number.isNaN(rate) || rate <= 0)
    redirect(`${detailPath}?error=${encodeURIComponent('Bitte Fremdwährung und einen gültigen Kurs (größer als 0) angeben.')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('trip_exchange_rates').upsert({
    trip_id: tripId, currency, rate, source: 'manual', updated_at: new Date().toISOString(),
  })
  if (error)
    redirect(`${detailPath}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(detailPath)
}
