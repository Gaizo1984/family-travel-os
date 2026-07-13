'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BOOKING_TYPE_CONFIG, combineDateTime } from '@/lib/bookings'
import { suggestCountryCode } from '@/lib/geo-suggestions'
import { readDateGroupFromFormData } from '@/lib/documents'
import type { BookingType, BookingStatus, PaymentStatus } from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deterministische Etappen-Zuordnung (kein Raten): Wenn keine Etappe manuell
 * gewählt wurde, aber der Startzeitpunkt eindeutig in genau eine bestehende
 * Etappe fällt, wird diese automatisch übernommen. Bei mehreren möglichen
 * Treffern oder keinem Treffer bleibt die Buchung unzugeordnet — die
 * manuelle Auswahl im Formular hat immer Vorrang.
 */
async function suggestStageId(
  supabase: SupabaseClient,
  tripId: string,
  startDate: string,
): Promise<string | null> {
  if (!startDate) return null
  const { data: stages } = await supabase
    .from('stages')
    .select('id, start_date, end_date')
    .eq('trip_id', tripId)

  const matches = (stages ?? []).filter(
    (s) => s.start_date && s.end_date && startDate >= s.start_date && startDate <= s.end_date,
  )
  return matches.length === 1 ? matches[0].id : null
}

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Marker im `notes`-Feld automatisch erzeugter Etappen -- Grundlage für `syncAccommodationIntoStage`. */
const AUTO_STAGE_NOTE_LAYOVER = 'Automatisch aus Zwischenstopp-Angabe im Flug erzeugt.'
const AUTO_STAGE_NOTE_ACCOMMODATION = 'Automatisch aus Hotelbuchung erzeugt.'
const AUTO_STAGE_NOTES: string[] = [AUTO_STAGE_NOTE_LAYOVER, AUTO_STAGE_NOTE_ACCOMMODATION]

/**
 * §"Zwischenstopp als Bestandteil eines Fluges... daraus automatisch Etappe
 * erzeugen": im Gegensatz zum heuristischen `flight-stopovers.ts`-Mechanismus
 * (der noch eine Bestätigung verlangt) ist die explizite Nutzereingabe hier
 * bereits die Bestätigung — keine Zwischenbestätigung nötig. Idempotent: legt
 * dieselbe Etappe nicht doppelt an, falls die Buchung mehrfach gespeichert wird.
 */
async function maybeCreateLayoverStage(
  supabase: SupabaseClient,
  tripId: string,
  bookingType: BookingType,
  details: Record<string, string>,
  endDatetime: string | null,
): Promise<void> {
  if (bookingType !== 'flight') return
  const airport = details.layover_airport?.trim()
  const nights = Number(details.layover_nights)
  if (!airport || details.layover_overnight !== 'ja' || !Number.isFinite(nights) || nights <= 0) return
  if (!endDatetime) return

  const startDate = endDatetime.slice(0, 10)
  const endDate = addDaysIso(startDate, nights)

  const { data: existing } = await supabase
    .from('stages').select('id').eq('trip_id', tripId).eq('title', airport).eq('start_date', startDate).maybeSingle()
  if (existing) return

  const [{ data: last }, { data: trip }] = await Promise.all([
    supabase.from('stages').select('sort_order').eq('trip_id', tripId).order('sort_order', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('trips').select('title, subtitle').eq('id', tripId).maybeSingle(),
  ])

  const countryCode = suggestCountryCode(airport) ?? suggestCountryCode(`${trip?.title ?? ''} ${trip?.subtitle ?? ''}`)

  await supabase.from('stages').insert({
    trip_id: tripId,
    title: airport,
    location: airport,
    start_date: startDate,
    end_date: endDate,
    nights,
    sort_order: (last?.sort_order ?? -1) + 1,
    country_code: countryCode,
    notes: AUTO_STAGE_NOTE_LAYOVER,
  })
}

/**
 * §"Etappe aus Zwischenstopp UND die dazugehörige Hotelbuchung am
 * Zwischenstopp müssen als dieselbe Etappe erkannt werden" (Bsp. Costa Rica:
 * 1 Nacht Atlanta aus dem Flug-Zwischenstopp erzeugt, plus eine separate
 * Hotelbuchung für dieselbe Nacht): eine bereits vorhandene Etappe mit
 * exakt demselben Start-Datum wie der Buchung gilt als dieselbe Etappe --
 * bewusst ein exakter Start-Datum-Abgleich statt eines Datumsbereich-
 * Enthält-Vergleichs (letzterer verursachte den Bug, dass eine Unterkunfts-
 * Buchung, deren Check-in exakt auf den Check-out einer VORHERIGEN, ANDEREN
 * Hotel-Etappe fiel, fälschlich dieser vorherigen Etappe zugeschlagen wurde
 * statt eine eigene zu bekommen).
 */
async function findStageByExactStartDate(supabase: SupabaseClient, tripId: string, startDate: string): Promise<{ id: string; notes: string | null } | null> {
  const { data: stages } = await supabase.from('stages').select('id, notes').eq('trip_id', tripId).eq('start_date', startDate)
  return stages && stages.length === 1 ? stages[0] : null
}

async function syncAccommodationIntoStage(
  supabase: SupabaseClient,
  stageId: string,
  title: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const nights = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
  if (nights < 0) return
  await supabase.from('stages').update({
    title, location: title, accommodation: title,
    start_date: startDate, end_date: endDate, nights,
    notes: AUTO_STAGE_NOTE_ACCOMMODATION,
  }).eq('id', stageId)
}

/**
 * §"Hotel erzeugt/verknüpft automatisch passende Etappe": Gegenstück zu
 * `maybeCreateLayoverStage`, für Unterkunftsbuchungen. Greift nur, wenn nach
 * `suggestStageId` weiterhin keine Etappe zugeordnet ist. Prüft zuerst per
 * exaktem Start-Datum, ob bereits eine (automatisch oder manuell erzeugte)
 * Etappe für denselben Tag existiert -- typischerweise eine Zwischenstopp-
 * Etappe aus dem Flug -- und verknüpft sich damit statt eine zweite Etappe
 * für denselben Aufenthalt anzulegen. Automatisch erzeugte Treffer (Layover
 * oder frühere Hotelbuchung) werden dabei mit den echten Hoteldaten
 * angereichert; eine manuell angelegte Etappe wird nur verknüpft, nie
 * überschrieben. Gibt die Etappen-ID zurück, damit der Aufrufer die Buchung
 * selbst damit verknüpfen kann.
 */
async function maybeCreateAccommodationStage(
  supabase: SupabaseClient,
  tripId: string,
  bookingType: BookingType,
  title: string,
  startDatetime: string | null,
  endDatetime: string | null,
): Promise<string | null> {
  if (bookingType !== 'accommodation') return null
  // §Bugfix "Nächte = 0 / Enddatum = Check-in": ohne Check-out lässt sich keine
  // sinnvolle Etappe ableiten -- früher fiel endDate hier still auf startDate
  // zurück (Check-out ist serverseitig inzwischen aber ohnehin Pflichtfeld,
  // siehe createBooking/updateBooking; dieser Guard bleibt als Absicherung).
  if (!startDatetime || !endDatetime) return null

  const startDate = startDatetime.slice(0, 10)
  const endDate = endDatetime.slice(0, 10)

  const match = await findStageByExactStartDate(supabase, tripId, startDate)
  if (match) {
    if (match.notes && AUTO_STAGE_NOTES.includes(match.notes)) {
      await syncAccommodationIntoStage(supabase, match.id, title, startDate, endDate)
    }
    return match.id
  }

  const [{ data: last }, { data: trip }] = await Promise.all([
    supabase.from('stages').select('sort_order').eq('trip_id', tripId).order('sort_order', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('trips').select('title, subtitle').eq('id', tripId).maybeSingle(),
  ])

  const countryCode = suggestCountryCode(title) ?? suggestCountryCode(`${trip?.title ?? ''} ${trip?.subtitle ?? ''}`)
  const nights = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)

  const { data: created } = await supabase.from('stages').insert({
    trip_id: tripId,
    title,
    location: title,
    start_date: startDate,
    end_date: endDate,
    nights: nights >= 0 ? nights : null,
    accommodation: title,
    sort_order: (last?.sort_order ?? -1) + 1,
    country_code: countryCode,
    notes: AUTO_STAGE_NOTE_ACCOMMODATION,
  }).select('id').single()

  return created?.id ?? null
}

/**
 * §Reparaturpfad für bereits bestehende, fehlerhaft erzeugte Etappen
 * (Nächte = 0 / Enddatum = Check-in, entstanden vor diesem Fix oder durch
 * eine damals fehlende Check-out-Angabe): wird eine Unterkunftsbuchung mit
 * bereits verknüpfter, automatisch erzeugter Etappe (Layover oder frühere
 * Hotelbuchung) bearbeitet, zieht die Etappe die korrigierten Daten nach.
 * Rührt manuell angelegte/bearbeitete Etappen NICHT an.
 */
async function maybeSyncAccommodationStage(
  supabase: SupabaseClient,
  stageId: string,
  bookingType: BookingType,
  title: string,
  startDatetime: string | null,
  endDatetime: string | null,
): Promise<void> {
  if (bookingType !== 'accommodation' || !startDatetime || !endDatetime) return

  const { data: stage } = await supabase.from('stages').select('notes').eq('id', stageId).maybeSingle()
  if (!stage?.notes || !AUTO_STAGE_NOTES.includes(stage.notes)) return

  await syncAccommodationIntoStage(supabase, stageId, title, startDatetime.slice(0, 10), endDatetime.slice(0, 10))
}

function readCommonFields(formData: FormData) {
  const type = String(formData.get('type') ?? '') as BookingType
  const config = BOOKING_TYPE_CONFIG[type]

  let title               = String(formData.get('title') ?? '').trim()
  const provider          = String(formData.get('provider') ?? '').trim()
  const stageId            = String(formData.get('stage_id') ?? '').trim()
  const bookingReference  = String(formData.get('booking_reference') ?? '').trim()
  const status            = String(formData.get('status') ?? 'pending') as BookingStatus
  const paymentStatus     = String(formData.get('payment_status') ?? 'unpaid') as PaymentStatus
  const amountRaw         = String(formData.get('amount') ?? '').trim()
  const currency          = String(formData.get('currency') ?? '').trim() || 'EUR'
  const notes             = String(formData.get('notes') ?? '').trim()

  // §Bewusst nicht werfen wie combineIsoDate es sonst tut: readCommonFields
  // darf bei einem ungültigen Datum nicht mitten im Einlesen abbrechen, sonst
  // gehen alle bereits gelesenen Felder (Titel, Preis, ...) verloren, bevor
  // sie für die Formular-Wiederherstellung (siehe redirectWithDraft) zur
  // Verfügung stehen. Detail-Felder vom Typ 'date' (z. B. Buchungsdatum)
  // nutzen dieselbe Datumsgruppen-Lesung wie Start-/Enddatum und laufen
  // deshalb im selben try-Block.
  let startDate = ''
  let endDate = ''
  let dateError: string | null = null
  const details: Record<string, string> = {}
  try {
    startDate = readDateGroupFromFormData(formData, 'start_date', 'Startdatum') ?? ''
    endDate = readDateGroupFromFormData(formData, 'end_date', 'Enddatum') ?? ''
    for (const field of config?.detailFields ?? []) {
      if (field.type === 'date') {
        const iso = readDateGroupFromFormData(formData, field.key, field.label)
        if (iso) details[field.key] = iso
        continue
      }
      const value = String(formData.get(field.key) ?? '').trim()
      if (value) details[field.key] = value
    }
  } catch (e) {
    dateError = e instanceof Error ? e.message : 'Ungültiges Datum'
  }
  const startTime = String(formData.get('start_time') ?? '').trim()
  const endTime   = String(formData.get('end_time') ?? '').trim()

  // §Flugmaske hat kein eigenes Titel-Eingabefeld mehr (config.showTitleField
  // === false) -- der Titel wird aus der gewählten Richtung und, falls
  // vorhanden, der Flugroute abgeleitet, damit bestehende Konsumenten von
  // booking.title (Listen, Buchungsdetail) unverändert funktionieren.
  if (type === 'flight') {
    const directionLabel = details.direction === 'return' ? 'Rückflug' : 'Hinflug'
    const route = details.from && details.to ? ` ${details.from}–${details.to}` : ''
    title = `${directionLabel}${route}`
  }

  return {
    type, config, title, provider, stageId, bookingReference, status, paymentStatus,
    amountRaw, currency, notes, startDate, startTime, endDate, endTime, details, dateError,
  }
}

/**
 * §Formular-Daten bei Validierungsfehlern nicht verlieren (Nutzer-Feedback:
 * "Flug anlegen ist fehlerhaft... alle bis dahin getätigten Angaben werden
 * direkt gelöscht"): dieselbe draft-Query-Parameter-Technik, die es in
 * diesem Projekt schon für die KI-Dokumentenauslesung gibt
 * (app/(app)/family/[personId]/documents/new/page.tsx) -- das Formular wird
 * beim erneuten Rendern mit den zuletzt eingegebenen Werten statt leer
 * vorausgefüllt. `pathWithTrailingSeparator` muss bereits auf "?" oder "&"
 * enden.
 */
function redirectWithDraft(pathWithTrailingSeparator: string, error: string, f: ReturnType<typeof readCommonFields>): never {
  const draft = {
    stage_id: f.stageId || null,
    title: f.title,
    provider: f.provider || null,
    booking_reference: f.bookingReference || null,
    status: f.status,
    payment_status: f.paymentStatus,
    amount: f.amountRaw ? Number(f.amountRaw) : null,
    currency: f.currency,
    start_datetime: combineDateTime(f.startDate, f.startTime),
    end_datetime: combineDateTime(f.endDate, f.endTime),
    notes: f.notes || null,
    details: Object.keys(f.details).length > 0 ? f.details : null,
  }
  redirect(`${pathWithTrailingSeparator}error=${encodeURIComponent(error)}&draft=${encodeURIComponent(JSON.stringify(draft))}`)
}

export async function createBooking(formData: FormData) {
  const tripId   = String(formData.get('trip_id') ?? '')
  const slug     = String(formData.get('slug') ?? '')
  const category = String(formData.get('category') ?? '').trim()
  const f = readCommonFields(formData)

  const newPath = `/trips/${slug}/bookings/new?type=${f.type}${category ? `&category=${category}` : ''}&`

  if (f.dateError)
    redirectWithDraft(newPath, f.dateError, f)
  if (!f.config)
    redirect(`/trips/${slug}?error=${encodeURIComponent('Ungültiger Buchungstyp')}`)
  if (f.title.length < 2)
    redirectWithDraft(newPath, `${f.config.titleLabel}: mindestens 2 Zeichen erforderlich`, f)
  if (!f.startDate)
    redirectWithDraft(newPath, `${f.config.startLabel}: Datum ist erforderlich`, f)
  // §Bugfix "Nächte = 0 / Enddatum = Check-in in der automatisch erzeugten
  // Etappe": Check-out war bisher optional und fiel beim Fehlen still auf
  // Check-in zurück. Für Unterkünfte (einzige Buchungsart, die eine Etappe
  // erzeugt) ist Check-out jetzt Pflicht, analog zu Check-in.
  if (f.type === 'accommodation' && !f.endDate)
    redirectWithDraft(newPath, `${f.config.endLabel}: Datum ist erforderlich`, f)

  const startDatetime = combineDateTime(f.startDate, f.startTime)
  const endDatetime = f.config.showEnd ? combineDateTime(f.endDate, f.endTime) : null

  if (endDatetime && startDatetime && new Date(endDatetime) < new Date(startDatetime))
    redirectWithDraft(newPath, 'Enddatum darf nicht vor dem Startdatum liegen', f)

  const supabase = await createClient()
  // §Bugfix "Etappe wird nur für das erste von mehreren Hotels gebildet": bei
  // Unterkünften bewusst NICHT `suggestStageId` (breite Datumsbereich-
  // Überlappung) nutzen -- eine Unterkunftsbuchung, deren Check-in exakt auf
  // den Check-out einer vorherigen Etappe fällt (typisch bei
  // Hotelwechsel-am-selben-Tag), wurde dadurch fälschlich der VORHERIGEN
  // Etappe zugeordnet, statt ihre eigene zu bekommen. Für Unterkünfte
  // übernimmt `maybeCreateAccommodationStage` unten die (präzisere)
  // Zuordnung per exaktem Check-in-Datum -- das erkennt u. a. auch eine
  // bereits aus einem Flug-Zwischenstopp erzeugte Etappe als dieselbe.
  let stageId = f.stageId || (f.type !== 'accommodation' ? await suggestStageId(supabase, tripId, f.startDate) : null)

  const { data: created, error } = await supabase.from('bookings').insert({
    trip_id: tripId,
    stage_id: stageId,
    type: f.type,
    title: f.title,
    provider: f.provider || null,
    booking_reference: f.bookingReference || null,
    status: f.status,
    payment_status: f.paymentStatus,
    amount: f.amountRaw ? Number(f.amountRaw) : null,
    currency: f.currency,
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    details: Object.keys(f.details).length > 0 ? f.details : null,
    notes: f.notes || null,
  }).select('id').single()

  if (error)
    redirectWithDraft(newPath, 'Speicherfehler: ' + error.message, f)

  await maybeCreateLayoverStage(supabase, tripId, f.type, f.details, endDatetime)

  if (!stageId) {
    const newStageId = await maybeCreateAccommodationStage(supabase, tripId, f.type, f.title, startDatetime, endDatetime)
    if (newStageId && created) {
      stageId = newStageId
      await supabase.from('bookings').update({ stage_id: newStageId }).eq('id', created.id)
    }
  }

  redirect(category ? `/trips/${slug}/bookings/category/${category}` : `/trips/${slug}`)
}

export async function updateBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const editPath = `/trips/${slug}/bookings/${bookingId}/edit?`
  const f = readCommonFields(formData)

  if (f.dateError)
    redirectWithDraft(editPath, f.dateError, f)
  if (!f.config)
    redirect(`/trips/${slug}?error=${encodeURIComponent('Ungültiger Buchungstyp')}`)
  if (f.title.length < 2)
    redirectWithDraft(editPath, `${f.config.titleLabel}: mindestens 2 Zeichen erforderlich`, f)
  if (!f.startDate)
    redirectWithDraft(editPath, `${f.config.startLabel}: Datum ist erforderlich`, f)
  if (f.type === 'accommodation' && !f.endDate)
    redirectWithDraft(editPath, `${f.config.endLabel}: Datum ist erforderlich`, f)

  const supabase = await createClient()

  // §Regressionsschutz seit Entfernung des manuellen Etappe-Felds: eine
  // bereits gesetzte stage_id (manuell oder automatisch) darf beim Speichern
  // anderer Felder NIE stumm überschrieben werden — nur fehlende Zuordnungen
  // werden per suggestStageId nachträglich ergänzt.
  const { data: existing } = await supabase.from('bookings').select('trip_id, stage_id').eq('id', bookingId).maybeSingle()
  const tripId = existing?.trip_id ?? ''

  const startDatetime = combineDateTime(f.startDate, f.startTime)
  const endDatetime = f.config.showEnd ? combineDateTime(f.endDate, f.endTime) : null

  if (endDatetime && startDatetime && new Date(endDatetime) < new Date(startDatetime))
    redirectWithDraft(editPath, 'Enddatum darf nicht vor dem Startdatum liegen', f)

  let stageId = existing?.stage_id ?? null
  // §Wie in createBooking: für Unterkünfte keine breite Datumsbereich-
  // Überlappung nutzen, um Hotelwechsel am selben Tag nicht der vorherigen
  // Etappe zuzuschlagen.
  if (!stageId && tripId && f.type !== 'accommodation') stageId = await suggestStageId(supabase, tripId, f.startDate)

  if (!stageId && tripId) {
    stageId = await maybeCreateAccommodationStage(supabase, tripId, f.type, f.title, startDatetime, endDatetime)
  } else if (stageId) {
    // §Reparaturpfad: eine bereits verknüpfte, automatisch erzeugte Etappe
    // zieht korrigierte Check-in/-out-Daten nach (siehe maybeSyncAccommodationStage).
    await maybeSyncAccommodationStage(supabase, stageId, f.type, f.title, startDatetime, endDatetime)
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      stage_id: stageId,
      title: f.title,
      provider: f.provider || null,
      booking_reference: f.bookingReference || null,
      status: f.status,
      payment_status: f.paymentStatus,
      amount: f.amountRaw ? Number(f.amountRaw) : null,
      currency: f.currency,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      details: Object.keys(f.details).length > 0 ? f.details : null,
      notes: f.notes || null,
    })
    .eq('id', bookingId)

  if (error)
    redirectWithDraft(editPath, 'Speicherfehler: ' + error.message, f)

  if (tripId) await maybeCreateLayoverStage(supabase, tripId, f.type, f.details, endDatetime)

  redirect(`/trips/${slug}/bookings/${bookingId}`)
}

export async function deleteBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const supabase = await createClient()

  const { error } = await supabase.from('bookings').delete().eq('id', bookingId)

  if (error)
    redirect(`/trips/${slug}/bookings/${bookingId}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  redirect(`/trips/${slug}`)
}

/**
 * §Punkt 8 "Optional intern cancelled": kleiner Toggle für Buchungstypen ohne
 * sichtbares Status-Feld (Flug/Hotel/Mietwagen) -- schaltet nur zwischen
 * 'confirmed' und 'cancelled' um, ohne ein allgemeines Status-Dropdown
 * einzuführen. Reine Ergänzung zum bereits vorhandenen "Buchung löschen".
 */
export async function toggleBookingCancelled(formData: FormData) {
  const bookingId = String(formData.get('booking_id') ?? '')
  const slug       = String(formData.get('slug') ?? '')
  const currentlyCancelled = String(formData.get('currently_cancelled') ?? '') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('bookings')
    .update({ status: currentlyCancelled ? 'confirmed' : 'cancelled' })
    .eq('id', bookingId)

  if (error)
    redirect(`/trips/${slug}/bookings/${bookingId}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  redirect(`/trips/${slug}/bookings/${bookingId}`)
}
