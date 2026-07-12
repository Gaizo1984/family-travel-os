'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  QUICK_ACTIONS, buildWhatsMissingAnswer, buildExplainConflictAnswer, buildPlanTomorrowAnswer,
} from '@/lib/concierge'
import { normalizeQuestionKey, generateAndCacheConciergeMessage } from '@/lib/concierge-messages'
import { getCachedTodayRecommendation, generateAndCacheTodayRecommendation } from '@/lib/today-recommendation'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { sortStagesChronologically, buildJourneyTimeline } from '@/lib/journey'
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from '@/lib/journey'
import { sortBookingsChronologically } from '@/lib/bookings'
import type { BookingType, BookingStatus } from '@/lib/supabase/types'

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

type StageRow = {
  id: string; title: string; location: string | null; nights: number | null
  start_date: string | null; end_date: string | null; accommodation: string | null
  sort_order: number; country_code: string | null
}
type BookingRow = {
  id: string; type: BookingType; title: string; provider: string | null; status: BookingStatus
  start_datetime: string | null; end_datetime: string | null; stage_id: string | null
  details: Record<string, string> | null; created_at: string
}

function readContext(formData: FormData) {
  return {
    familyId: String(formData.get('family_id') ?? ''),
    tripId: String(formData.get('trip_id') ?? ''),
    tripSlug: String(formData.get('trip_slug') ?? ''),
    forDate: String(formData.get('for_date') ?? ''),
    dateLabel: String(formData.get('date_label') ?? ''),
    locationLabel: String(formData.get('location_label') ?? ''),
    weatherSummary: String(formData.get('weather_summary') ?? '').trim() || null,
    knownPlanText: String(formData.get('known_plan_text') ?? ''),
    highlightTitle: String(formData.get('highlight_title') ?? '').trim() || null,
    memberNames: String(formData.get('member_names') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    // §"Frag LUMI" hat keinen festen Ort mehr (eigener Menüpunkt /concierge
    // UND Auslöser innerhalb der Kategorie-Seiten) -- die aufrufende Seite
    // bestimmt per return_to, wohin nach dem Absenden zurückgeleitet wird.
    returnTo: String(formData.get('return_to') ?? '').trim() || '/today',
  }
}

/**
 * Zentrale Einstiegs-Aktion für Schnellaktionen UND Freitext-Fragen.
 * §"KI-Aufruf nur bei neuer Frage, neuem Kalendertag oder wesentlichen
 * Änderungen": deterministische Fragen (Plane morgen/Was fehlt/Konflikt
 * erklären) rufen nie die KI auf; "Was ist heute wichtig?" liest/erzeugt die
 * bereits bestehende Tagesplanung (dieselbe Datenbasis wie die Heute-Seite);
 * nur "Wetter anpassen"/"Alternative finden"/Freitext gehen über die KI.
 */
export async function askConcierge(formData: FormData) {
  const ctx = readContext(formData)
  const questionKey = String(formData.get('question_key') ?? '')
  const questionTextRaw = String(formData.get('question_text') ?? '').trim()

  if (!ctx.familyId || !ctx.tripId || !ctx.forDate) redirect(ctx.returnTo)

  if (questionKey === 'today_important') {
    let rec = await getCachedTodayRecommendation(ctx.familyId, ctx.tripId, ctx.forDate)
    if (!rec) {
      const dna = await buildFamilyDnaSummary(ctx.familyId)
      rec = await generateAndCacheTodayRecommendation(
        ctx.familyId, ctx.tripId, ctx.forDate,
        {
          dateLabel: ctx.dateLabel, locationLabel: ctx.locationLabel, weatherSummary: ctx.weatherSummary,
          familyDnaText: formatFamilyDnaForPrompt(dna, ctx.forDate), knownPlanText: ctx.knownPlanText,
        },
        ctx.highlightTitle, null,
      )
    }
    redirect(ctx.returnTo)
    return
  }

  if (questionKey === 'plan_tomorrow') {
    const supabase = await createClient()
    const { data: trip } = await supabase
      .from('trips')
      .select(`
        start_date, end_date,
        stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code ),
        bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at ),
        journey_events ( id, stage_id, date, time, category, title, location, status )
      `)
      .eq('id', ctx.tripId)
      .maybeSingle()

    if (trip) {
      const stages = sortStagesChronologically((trip.stages ?? []) as StageRow[]) as StageInput[]
      const bookings = sortBookingsChronologically((trip.bookings ?? []) as BookingRow[]) as TimelineBooking[]
      const events = (trip.journey_events ?? []) as unknown as TimelineEvent[]
      const tomorrowIso = addDaysIso(ctx.forDate, 1)
      const timeline = buildJourneyTimeline({ start_date: trip.start_date, end_date: trip.end_date }, stages, bookings, events)
      const allDays: TimelineDay[] = timeline.flatMap((seg) => (seg.kind === 'stay' ? seg.days : [seg.day]))
      const tomorrowDay = allDays.find((d) => d.date === tomorrowIso) ?? null

      const answer = buildPlanTomorrowAnswer(tomorrowDay, stages, tomorrowIso, ctx.tripSlug)
      await supabase.from('concierge_messages').upsert(
        {
          family_id: ctx.familyId, trip_id: ctx.tripId, for_date: ctx.forDate, question_key: questionKey,
          question_text: questionTextRaw, answer_title: answer.title, answer_body: answer.body,
          actions: [{ event_title: answer.title, links: answer.links }], context_fingerprint: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'family_id,trip_id,for_date,question_key' },
      )
    }
    redirect(ctx.returnTo)
    return
  }

  if (questionKey === 'whats_missing' || questionKey === 'explain_conflict') {
    const supabase = await createClient()
    const { data: trip } = await supabase.from('trips').select('slug').eq('id', ctx.tripId).maybeSingle()
    const answer = questionKey === 'whats_missing'
      ? await buildWhatsMissingAnswer(ctx.tripId, trip?.slug ?? ctx.tripSlug)
      : await buildExplainConflictAnswer(ctx.tripId)

    await supabase.from('concierge_messages').upsert(
      {
        family_id: ctx.familyId, trip_id: ctx.tripId, for_date: ctx.forDate, question_key: questionKey,
        question_text: questionTextRaw, answer_title: answer.title, answer_body: answer.body,
        actions: [{ event_title: answer.title, links: answer.links }], context_fingerprint: null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'family_id,trip_id,for_date,question_key' },
    )
    redirect(ctx.returnTo)
    return
  }

  // KI-basiert: adjust_weather, find_alternative, Freitext
  const isFreetext = !QUICK_ACTIONS.some((a) => a.key === questionKey)
  const effectiveKey = isFreetext ? normalizeQuestionKey(questionTextRaw) : questionKey
  if (!questionTextRaw) redirect(ctx.returnTo)

  await generateAndCacheConciergeMessage(
    ctx.familyId, ctx.tripId, ctx.forDate, effectiveKey, questionTextRaw,
    {
      dateLabel: ctx.dateLabel, locationLabel: ctx.locationLabel, weatherSummary: ctx.weatherSummary,
      knownPlanText: ctx.knownPlanText, highlightTitle: ctx.highlightTitle, memberNames: ctx.memberNames,
    },
    false,
  )
  redirect(ctx.returnTo)
}

/** §"Hinweis 'Empfehlung aktualisieren' anzeigen statt automatisch neu zu rechnen": bewusster, manueller Regenerier-Schritt. */
export async function refreshConciergeMessage(formData: FormData) {
  const ctx = readContext(formData)
  const questionKey = String(formData.get('question_key') ?? '')
  const questionText = String(formData.get('question_text') ?? '')
  if (!ctx.familyId || !ctx.tripId || !ctx.forDate || !questionKey) redirect(ctx.returnTo)

  await generateAndCacheConciergeMessage(
    ctx.familyId, ctx.tripId, ctx.forDate, questionKey, questionText,
    {
      dateLabel: ctx.dateLabel, locationLabel: ctx.locationLabel, weatherSummary: ctx.weatherSummary,
      knownPlanText: ctx.knownPlanText, highlightTitle: ctx.highlightTitle, memberNames: ctx.memberNames,
    },
    true,
  )
  redirect(ctx.returnTo)
}

/**
 * §"Nie automatisch Daten ändern – immer Bestätigung verlangen": erst der
 * bewusste Klick auf "In Journey übernehmen"/"Alternative speichern" legt
 * einen echten journey_events-Eintrag an (status 'idea' — bewusst zurück-
 * haltend, die Familie kann ihn später wie jeden anderen Termin bearbeiten).
 */
export async function commitConciergeAction(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const tripSlug = String(formData.get('trip_slug') ?? '')
  const forDate = String(formData.get('for_date') ?? '')
  const eventTitle = String(formData.get('event_title') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/today'

  if (!tripId || !forDate || !eventTitle) redirect(`${returnTo}?error=${encodeURIComponent('Konnte nicht übernommen werden')}`)

  const supabase = await createClient()
  const { error } = await supabase.from('journey_events').insert({
    trip_id: tripId,
    date: forDate,
    category: 'note',
    title: eventTitle,
    status: 'idea',
  })

  if (error) redirect(`${returnTo}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)
  redirect(`/trips/${tripSlug}`)
}
