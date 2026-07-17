'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  QUICK_ACTIONS, buildWhatsMissingAnswer, buildExplainConflictAnswer, buildPlanTomorrowAnswer,
} from '@/lib/concierge'
import { normalizeQuestionKey, generateAndCacheConciergeMessage } from '@/lib/concierge-messages'
import { detectLumiIntent } from '@/lib/today'
import { detectLumiBrainIntent } from '@/lib/lumi-brain-intent'
import { listTripsForPicker, matchTripsFromText } from '@/lib/lumi-trip-picker'
import { buildLumiBrainContext, type LumiBrainScope } from '@/lib/lumi-brain-context'
import { generateLumiBrainAnswer } from '@/lib/lumi-brain-ai'
import { isLumiBrainLimitReached, incrementLumiBrainUsage } from '@/lib/lumi-brain-usage'
import { createPendingMemoryCandidate, hasDeclinedSimilarMemory } from '@/lib/family-memories'
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

/** Hängt einen Query-Parameter an eine Redirect-Ziel-URL an, egal ob sie bereits eine Query-String hat (z.B. `/concierge?trip=x`). */
function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${key}=${encodeURIComponent(value)}`
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

  // §"Allgemein"-Modus (Nutzervorgabe): kein tripId mehr zwingend erforderlich
  // -- nur die deterministischen, trip-gebundenen Schnellaktionen unten
  // brauchen weiterhin zwingend eine Reise (die UI zeigt sie im
  // Allgemein-Modus ohnehin nicht an).
  if (!ctx.familyId || !ctx.forDate) redirect(ctx.returnTo)
  const tripBoundKeys = ['today_important', 'plan_tomorrow', 'whats_missing', 'explain_conflict']
  if (tripBoundKeys.includes(questionKey) && !ctx.tripId) redirect(ctx.returnTo)

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

  // §"Strukturierte Empfehlungskarten statt Fließtext" (LUMI Intelligence v1,
  // §7): erkennt eine Freitext-Frage als Kategorie-/Tagesplan-Anfrage und
  // leitet auf die bereits mit echten Places-/Routes-Daten arbeitende Seite
  // um -- kein zweiter, paralleler KI-Textpfad für dasselbe Ergebnis.
  if (isFreetext) {
    const intent = detectLumiIntent(questionTextRaw)
    if (intent?.type === 'category') redirect(`/today/category/${intent.category}`)
    if (intent?.type === 'day_plan') redirect('/today/plan')

    // §"LUMI Brain / Frag LUMI" (Nutzervorgabe): Erklärung/Priorisierung/
    // Vergleich/Empfehlung auf Basis bereits bestehender Readiness-/Journey-/
    // Hotel-/Flug-Ergebnisse -- kein zweiter, paralleler Kontext- oder
    // Readiness-Aufbau (siehe lib/lumi-brain-context.ts::buildLumiBrainContext,
    // die ausschließlich buildLumiContext/buildTravelWorld wiederverwendet).
    const brainIntent = detectLumiBrainIntent(questionTextRaw)
    if (brainIntent) {
      const limitReached = await isLumiBrainLimitReached(ctx.familyId)
      if (limitReached) {
        redirect(`${ctx.returnTo}?error=${encodeURIComponent('Monatliches LUMI-Anfragelimit erreicht -- bitte später erneut versuchen.')}`)
      }

      // §"Automatische Erkennung aus Fragen" (Nutzervorgabe, wörtlich:
      // "lib/lumi-trip-picker.ts als einzige zentrale Quelle für Reiseauswahl
      // und Text-Matching verwenden -- keine parallele Matching-Logik in UI
      // und askConcierge"): dieselbe Liste/Matching-Funktion wie der Picker
      // in app/(app)/concierge/page.tsx, kein zweiter KI-Aufruf fürs Matching.
      const basePath = ctx.returnTo.split('?')[0] || '/concierge'
      const pickerTrips = await listTripsForPicker(ctx.familyId)
      const textMatches = matchTripsFromText(questionTextRaw, pickerTrips)

      let scope: LumiBrainScope = ctx.tripId ? { mode: 'trip', tripId: ctx.tripId } : { mode: 'general' }
      let matchedTrip: { id: string; slug: string } | null = null

      if (textMatches.length === 1 && textMatches[0].id !== ctx.tripId) {
        scope = { mode: 'trip', tripId: textMatches[0].id }
        matchedTrip = textMatches[0]
      } else if (textMatches.length > 1 && !textMatches.some((t) => t.id === ctx.tripId)) {
        // §"Bei Mehrdeutigkeit eine Auswahl anbieten, nicht raten" (Nutzervorgabe):
        // kein Rateversuch -- Hinweis, über den Picker die passende Reise zu wählen.
        const names = textMatches.map((t) => t.title).join(', ')
        redirect(`${basePath}?notice=${encodeURIComponent(`Mehrere Reisen passen zur Frage (${names}) -- bitte über "Reise auswählen" die passende Reise wählen.`)}`)
      }

      const brainContext = await buildLumiBrainContext(ctx.familyId, scope, brainIntent)
      // §"OpenAI-Ausfall erzeugt verständliche Fehlermeldung" (Nutzervorgabe):
      // vorher fiel ein Kontext-/Antwortfehler kommentarlos auf den
      // generischen Freitext-Pfad zurück -- der Nutzer bekam eine andere
      // Antwortqualität ohne erkennbaren Grund. Jetzt wird das ehrlich
      // benannt (bestehender ?notice=-Banner-Mechanismus), der Fallback
      // selbst bleibt unverändert bestehen.
      let fallbackNotice: string | null = null
      if (brainContext.ok) {
        const answer = await generateLumiBrainAnswer({ intent: brainIntent, context: brainContext, questionText: questionTextRaw })
        if (answer) {
          await incrementLumiBrainUsage(ctx.familyId)
          const supabase = await createClient()
          const effectiveTripId = matchedTrip?.id ?? ctx.tripId
          const combinedBody = [
            answer.basisLabel, answer.body,
            answer.recommendation ? `Empfehlung: ${answer.recommendation}` : null,
            answer.missingInfo ? `Fehlende Angabe: ${answer.missingInfo}` : null,
          ].filter(Boolean).join('\n\n')
          await supabase.from('concierge_messages').upsert(
            {
              family_id: ctx.familyId, trip_id: effectiveTripId || null, for_date: ctx.forDate, question_key: effectiveKey,
              question_text: questionTextRaw, answer_title: answer.title, answer_body: combinedBody,
              actions: [{ event_title: answer.title, links: answer.links }], context_fingerprint: null,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'family_id,trip_id,for_date,question_key' },
          )

          // §"Frag LUMI darf eine mögliche Erinnerung erkennen, aber nicht
          // ungefragt speichern" (Nutzervorgabe): legt NUR einen 'pending'-
          // Kandidaten an, niemals 'confirmed' -- die Seite zeigt ihn als
          // eigene Bestätigungskarte. "Ablehnung wird respektiert": vor dem
          // erneuten Vorschlagen wird auf einen bereits abgelehnten,
          // gleichartigen Kandidaten geprüft.
          if (answer.memoryCandidate) {
            const { memoryType, category, summary } = answer.memoryCandidate
            const alreadyDeclined = await hasDeclinedSimilarMemory(ctx.familyId, category, summary)
            if (!alreadyDeclined) {
              await createPendingMemoryCandidate({
                familyId: ctx.familyId, tripId: effectiveTripId || null,
                memoryType, category, summary, source: 'concierge_chat',
              })
            }
          }

          if (matchedTrip) {
            // §"Bei eindeutigem Treffer die UI-Auswahl sichtbar auf die
            // erkannte Reise umstellen" + "nur für diese Familie speichern"
            // (Nutzervorgabe): dieselbe familiengebundene Persistenz wie die
            // manuelle Auswahl im Picker (lib/actions/lumi-trip-selection.ts).
            await supabase.from('families').update({ last_lumi_trip_id: matchedTrip.id }).eq('id', ctx.familyId)
            redirect(`${basePath}?trip=${encodeURIComponent(matchedTrip.slug)}`)
          }
          redirect(ctx.returnTo)
        }
        fallbackNotice = 'Die spezialisierte LUMI-Antwort war gerade nicht verfügbar -- hier eine allgemeine Einschätzung.'
      } else {
        fallbackNotice = brainContext.message
      }
      // §"Bei Fehlern immer ehrlich zurückfallen, nie abstürzen": Kontext-/
      // Antwortfehler fallen bewusst durch auf den bestehenden freien
      // Fließtext-Pfad unten, statt die Seite scheitern zu lassen -- aber
      // mit sichtbarem Hinweis statt stillschweigend anderer Antwortqualität.
      await generateAndCacheConciergeMessage(
        ctx.familyId, ctx.tripId || null, ctx.forDate, effectiveKey, questionTextRaw,
        {
          dateLabel: ctx.dateLabel, locationLabel: ctx.locationLabel, weatherSummary: ctx.weatherSummary,
          knownPlanText: ctx.knownPlanText, highlightTitle: ctx.highlightTitle, memberNames: ctx.memberNames,
        },
        false,
      )
      redirect(appendQueryParam(ctx.returnTo, 'notice', fallbackNotice))
    }
  }

  await generateAndCacheConciergeMessage(
    ctx.familyId, ctx.tripId || null, ctx.forDate, effectiveKey, questionTextRaw,
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
