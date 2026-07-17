import OpenAI from 'openai'
import { buildJourneyOverview } from './journey-events-model'
import type { LumiBrainContextResult, LumiBrainTripContext, LumiBrainGeneralContext } from './lumi-brain-context'
import type { LumiBrainIntent } from './lumi-brain-intent'
import { extractMentionedDayMonth } from './lumi-brain-intent'
import { formatDateDE } from './demo-data'
import { splitDateTime } from './bookings'

const OPENAI_MODEL = 'gpt-5.4'

/**
 * §"LUMI Brain -- Fakten und KI-Bewertung klar trennen, fehlende
 * Informationen offen benennen, niemals ergänzen" (Nutzervorgabe, wörtlich):
 * `missing_info` ist ein PFLICHTFELD (nicht optional weglassbar) -- das
 * Modell muss aktiv "null"/leer zurückgeben, wenn nichts fehlt, statt das
 * Feld einfach zu ignorieren. `basisLabel` kommt NICHT von der KI (siehe
 * `buildBasisLabel` unten) -- deterministisch, damit die Datenbasis-Angabe
 * nie erfunden werden kann.
 */
export type LumiBrainAnswer = {
  title: string
  body: string
  recommendation: string | null
  missingInfo: string | null
  basisLabel: string
  links: Array<{ label: string; href: string }>
}

const LUMI_BRAIN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Kurze, klare Kernaussage (max. 12 Wörter).' },
    body: { type: 'string', description: 'Kurze, strukturierte Antwort (max. 80 Wörter) -- Stichpunkte statt langer Fließtext-Absätze, wo sinnvoll. Nutzt AUSSCHLIESSLICH die im Kontext gelieferten Fakten, erfindet nichts.' },
    recommendation: { type: ['string', 'null'], description: 'Kurze, konkrete Empfehlung mit Begründung (max. 40 Wörter) -- null, wenn keine sinnvolle Empfehlung möglich ist.' },
    missing_info: { type: ['string', 'null'], description: 'Explizit benannte fehlende/unbekannte Information, falls die Frage nicht vollständig aus dem Kontext beantwortbar ist -- null, wenn nichts fehlt. NIEMALS eine fehlende Angabe erfinden/schätzen, stattdessen hier benennen.' },
  },
  required: ['title', 'body', 'recommendation', 'missing_info'],
  additionalProperties: false,
}

function buildBasisLabel(intent: LumiBrainIntent, result: Extract<LumiBrainContextResult, { ok: true }>): string {
  if (result.trip) {
    if (intent.type === 'vergleich') return `Basierend auf eurer ${result.trip.title}-Reise und euren gespeicherten Vergleichsdaten`
    if (intent.type === 'reise_check') return `Basierend auf eurer ${result.trip.title}-Reise (Journey und Buchungen)`
    return `Basierend auf eurer ${result.trip.title}-Reise`
  }
  return 'Basierend auf euren bisherigen Reisen und euren Präferenzen'
}

function formatBookingLine(b: LumiBrainTripContext['lumi']['todaysBookings'][number]): string {
  const { time } = splitDateTime(b.start_datetime)
  return `${b.type}: ${b.title}${b.provider ? ` (${b.provider})` : ''}${time ? ` um ${time}` : ''}`
}

function buildReiseCheckPrompt(trip: LumiBrainTripContext, questionText: string): string {
  const findings = trip.lumi.readinessFindings
  const findingsText = findings.length > 0
    ? findings.map((f) => `- [${f.severity === 'conflict' ? 'Konflikt' : 'Hinweis'}/${f.theme}] ${f.message}`).join('\n')
    : 'Keine offenen Punkte bekannt -- die Reise ist laut aktueller Prüfung vollständig vorbereitet.'

  return `Du bist LUMI, der Reise-Assistent dieser Familie. Frage: "${questionText}" zur Reise "${trip.title}".
${trip.lumi.dnaText}

Bereits berechnete offene Punkte/Konflikte für diese Reise (NICHT selbst neu bewerten, nur zusammenfassen und priorisieren):
${findingsText}

Fasse diese Punkte verständlich zusammen und priorisiere die wichtigsten nächsten Schritte. Erfinde KEINE weiteren offenen Punkte, die nicht in der Liste stehen -- wenn die Liste leer ist, sage das ehrlich.`
}

function buildFamilienfitPrompt(trip: LumiBrainTripContext, questionText: string): string {
  const upcoming = [...trip.lumi.todaysBookings, ...trip.lumi.upcomingBookings.slice(0, 5)]
  const bookingsText = upcoming.length > 0 ? upcoming.map(formatBookingLine).join('\n') : 'Keine anstehenden Buchungen bekannt.'
  const activitiesText = trip.lumi.plannedActivities.length > 0
    ? trip.lumi.plannedActivities.slice(0, 10).map((a) => `- ${a.date}: ${a.title} [${a.category}]`).join('\n')
    : 'Keine geplanten Aktivitäten bekannt.'

  return `Du bist LUMI, der Reise-Assistent dieser Familie. Frage: "${questionText}" zur Reise "${trip.title}".
${trip.lumi.dnaText}

Anstehende Buchungen (Fakten, nicht erfinden):
${bookingsText}

Geplante Aktivitäten/Termine:
${activitiesText}

Die Frage bezieht sich vermutlich auf EINEN der oben genannten Punkte (z. B. "dieser Flug" = die nächste Flugbuchung). Benenne im Antworttext explizit, auf welchen konkreten Punkt du dich beziehst -- falls unklar, welcher Punkt gemeint ist, sage das ehrlich statt zu raten. Bewerte die Familientauglichkeit NUR anhand der oben gelieferten Fakten (Uhrzeiten, Transferzeiten, Kinderalter) und der Familien-DNA -- keine erfundenen Details zu Ausstattung/Komfort.`
}

function buildVergleichPrompt(trip: LumiBrainTripContext, questionText: string, subject: 'hotel' | 'flight' | 'general'): string {
  const parts: string[] = [`Du bist LUMI, der Reise-Assistent dieser Familie. Frage: "${questionText}" zur Reise "${trip.title}".`, trip.lumi.dnaText]

  if ((subject === 'hotel' || subject === 'general') && trip.hotelOptions && trip.hotelOptions.length > 0) {
    parts.push('Bereits verglichene Hotel-Optionen (bereits bewertet, NICHT neu einstufen, nur zitieren/zusammenfassen):')
    parts.push(trip.hotelOptions.map((h) => `- ${h.name} [${h.tier ?? 'unterhalb Mindeststandard'}${h.isIconic ? ', Iconic' : ''}]: ${h.familyFitReasoning}${h.transferMinutes !== null ? ` (${h.transferMinutes} Min Transfer)` : ''}`).join('\n'))
  } else if (subject === 'hotel' || subject === 'general') {
    parts.push('Keine gespeicherten Hotel-Vergleichsdaten für diese Reise vorhanden (noch keine Suche über /hotels durchgeführt für dieses Ziel).')
  }

  if ((subject === 'flight' || subject === 'general') && trip.flightOptions && trip.flightOptions.length > 0) {
    parts.push('Bereits verglichene Flugoptionen (bereits bewertet, NICHT neu einstufen, nur zitieren/zusammenfassen):')
    parts.push(trip.flightOptions.slice(0, 8).map((f) => `- ${f.price} ${f.currency}, ${Math.round(f.totalDurationMinutes / 60)}h${f.totalDurationMinutes % 60}min, ${f.maxStopCount} Umstiege, Badges: ${f.badges.join(', ') || 'keine'}${f.aiReasoning ? ` -- ${f.aiReasoning}` : ''}`).join('\n'))
  } else if (subject === 'flight' || subject === 'general') {
    parts.push('Keine gespeicherten Flugvergleichsdaten für diese Reise vorhanden.')
  }

  parts.push('Beantworte die Frage ausschließlich auf Basis der oben gelieferten, bereits bewerteten Optionen. Erfinde keine weiteren Hotels/Flüge. Wenn keine Vergleichsdaten vorliegen, sage das ehrlich und empfehle, eine Suche über die Hotel-/Flugsuche zu starten, statt zu raten.')
  return parts.join('\n\n')
}

function buildJourneySupportPrompt(trip: LumiBrainTripContext, questionText: string, subject: 'plan_day' | 'today_important' | 'free_days' | 'combine_activities'): string {
  const tripDateRange = { startDate: trip.lumi.startDate, endDate: trip.lumi.endDate, source: 'stages' as const, isOpen: !trip.lumi.startDate }
  const overview = buildJourneyOverview({
    trip: { start_date: trip.lumi.startDate, end_date: trip.lumi.endDate },
    slug: trip.slug, stages: trip.lumi.stages, bookings: trip.lumi.allBookings, events: trip.lumi.allEvents,
    photos: [], readinessFindings: [], weatherByDate: new Map(), tripDateRange, todayIso: trip.lumi.todayIso,
  })

  const base = `Du bist LUMI, der Reise-Assistent dieser Familie. Frage: "${questionText}" zur Reise "${trip.title}".\n${trip.lumi.dnaText}`

  if (subject === 'today_important') {
    const todayBucket = overview.days.find((d) => d.isToday)
    const eventsText = todayBucket && todayBucket.events.length > 0
      ? todayBucket.events.map((e) => `- ${e.time ?? 'ganztägig'}: ${e.title}`).join('\n')
      : 'Kein festes Programm für heute bekannt.'
    return `${base}\n\nHeutiges Programm (Fakten, bereits geplant):\n${eventsText}\n\nFasse zusammen, was heute wichtig ist, priorisiere. Erfinde keine weiteren Termine.`
  }

  if (subject === 'free_days') {
    const freeDays = overview.days.filter((d) => !d.isPast && d.events.length === 0)
    const freeDaysText = freeDays.length > 0
      ? freeDays.map((d) => `${formatDateDE(d.date)}${d.stage ? ` (${d.stage.location ?? d.stage.title})` : ''}`).join(', ')
      : 'Keine freien Tage ohne Programm gefunden -- jeder kommende Tag hat bereits mindestens einen Eintrag.'
    return `${base}\n\nTage ohne festes Programm (Fakten, aus der Journey ermittelt): ${freeDaysText}\n\nBeantworte die Frage anhand dieser Liste. Erfinde keine weiteren freien Tage.`
  }

  if (subject === 'combine_activities') {
    const upcoming = overview.days.filter((d) => !d.isPast && d.events.length > 0).slice(0, 5)
    const text = upcoming.map((d) => `${formatDateDE(d.date)}: ${d.events.map((e) => e.title).join(', ')}`).join('\n')
    return `${base}\n\nGeplante Termine der nächsten Tage (Fakten):\n${text || 'Keine geplanten Termine bekannt.'}\n\nSchlage vor, welche Termine sich sinnvoll an einem Tag kombinieren ließen (z. B. gleicher Ort/gleiche Gegend). Für eine echte Routenoptimierung verweise auf den bestehenden Tagesplaner (Link wird separat angezeigt). Erfinde keine neuen Aktivitäten.`
  }

  // plan_day
  const mentioned = extractMentionedDayMonth(questionText)
  const questionLower = questionText.toLowerCase()
  // §"Plane uns einen freien Tag in Guanacaste" (Testfall): kein Datum
  // genannt, aber ein Etappen-/Ortsname -- einfache Teilstring-Erkennung
  // gegen die bekannten Etappenorte, bevor auf "irgendeinen freien Tag"
  // zurückgefallen wird. Kein volles NLU, nur ein pragmatischer Textabgleich.
  const mentionedStage = trip.lumi.stages.find((s) => {
    const label = (s.location ?? s.title).toLowerCase()
    return label.length > 2 && questionLower.includes(label)
  })

  const targetDay = mentioned
    ? overview.days.find((d) => {
        const [, month, day] = d.date.split('-').map(Number)
        return day === mentioned.day && month === mentioned.month
      })
    : mentionedStage
      ? overview.days.find((d) => !d.isPast && d.events.length === 0 && d.stage?.id === mentionedStage.id)
        ?? overview.days.find((d) => d.stage?.id === mentionedStage.id)
      : overview.days.find((d) => !d.isPast && d.events.length === 0)

  if (!targetDay) {
    return `${base}\n\nIm Fragetext wurde ein Datum genannt, das sich keinem Tag dieser Reise zuordnen lässt. Sage das ehrlich (missing_info) und empfehle, das Datum zu präzisieren oder den bestehenden Tagesplaner direkt zu nutzen.`
  }
  const existingText = targetDay.events.length > 0
    ? `Für diesen Tag ist bereits geplant: ${targetDay.events.map((e) => e.title).join(', ')}.`
    : 'Für diesen Tag ist noch nichts geplant -- ein freier Tag.'
  return `${base}\n\nGefragter Tag: ${formatDateDE(targetDay.date)}${targetDay.stage ? ` in ${targetDay.stage.location ?? targetDay.stage.title}` : ''}. ${existingText}\n\nBeschreibe den Status dieses Tages. Für einen vollständigen, familiengerechten Tagesvorschlag mit echten Orten/Fahrzeiten empfiehl den bestehenden Tagesplaner (Link wird separat angezeigt) -- erstelle selbst KEINEN erfundenen Stopp-Vorschlag mit Orten/Adressen, die nicht bereits als Fakt vorliegen.`
}

function buildInspirationPrompt(questionText: string, general: LumiBrainGeneralContext | null, dnaText: string): string {
  const hotelsText = general && general.pastAccommodationTitles.length > 0
    ? general.pastAccommodationTitles.join(', ')
    : 'Keine bisherigen Unterkunfts-Buchungen gefunden.'
  const criteriaText = general?.hotelCriteria.length ? general.hotelCriteria.join(', ') : (dnaText.includes('Hotelkriterien') ? dnaText : 'keine erklärten Hotelkriterien hinterlegt')

  return `Du bist LUMI, der Reise-Assistent dieser Familie. Frage: "${questionText}".
${dnaText}

Bisherige Unterkünfte dieser Familie (Fakten, nur Namen -- KEINE gespeicherten Bewertungen dazu vorhanden): ${hotelsText}
Erklärte Hotelkriterien: ${criteriaText}

Beantworte die Frage auf Basis dieser Fakten. WICHTIG: es gibt keine gespeicherten Bewertungen/Sterne zu den bisherigen Hotels -- benenne das explizit als fehlende Information (missing_info), erfinde keine Bewertung. Nutze die erklärten Kriterien für eine sinnvolle, ehrliche Einschätzung/Empfehlung.`
}

function buildPrompt(intent: LumiBrainIntent, result: Extract<LumiBrainContextResult, { ok: true }>, questionText: string): string {
  if (intent.type === 'inspiration') return buildInspirationPrompt(questionText, result.general, result.trip?.lumi.dnaText ?? result.general?.dnaText ?? '')
  if (!result.trip) {
    // Alle anderen Intents brauchen eine ausgewählte Reise -- im Allgemein-Modus ehrlich benennen statt zu raten.
    return `Du bist LUMI, der Reise-Assistent dieser Familie. Frage: "${questionText}" (kein konkretes Reise ausgewählt).
${result.general?.dnaText ?? ''}
Bekannte anstehende Reisen: ${result.general?.upcomingTrips.map((t) => t.title).join(', ') || 'keine'}.

Diese Frage bezieht sich vermutlich auf eine konkrete Reise, aber es ist "Allgemein" ausgewählt. Beantworte nur, was allgemein aus den obigen Fakten möglich ist, und benenne in missing_info, dass für eine genaue Antwort eine konkrete Reise ausgewählt werden sollte.`
  }
  switch (intent.type) {
    case 'reise_check': return buildReiseCheckPrompt(result.trip, questionText)
    case 'familienfit': return buildFamilienfitPrompt(result.trip, questionText)
    case 'vergleich': return buildVergleichPrompt(result.trip, questionText, intent.subject)
    case 'journey_support': return buildJourneySupportPrompt(result.trip, questionText, intent.subject)
  }
}

function buildLinks(intent: LumiBrainIntent, result: Extract<LumiBrainContextResult, { ok: true }>): Array<{ label: string; href: string }> {
  if (!result.trip) return []
  const slug = result.trip.slug
  if (intent.type === 'reise_check') return [{ label: 'Zur Journey', href: `/trips/${slug}/journey` }]
  if (intent.type === 'vergleich' && intent.subject !== 'flight') return [{ label: 'Hotelvergleich öffnen', href: '/hotels' }]
  if (intent.type === 'vergleich') return [{ label: 'Flugvergleich öffnen', href: '/discover/flights' }]
  if (intent.type === 'journey_support' && (intent.subject === 'plan_day' || intent.subject === 'combine_activities')) {
    return [{ label: 'Tagesplaner öffnen', href: '/today/plan' }]
  }
  if (intent.type === 'journey_support') return [{ label: 'Zur Journey', href: `/trips/${slug}/journey` }]
  return []
}

/**
 * §"LUMI Brain": EIN Aufruf pro Frage, gleiches Muster wie
 * `generateConciergeAnswer`/`generateFiveRecommendations` (Modell, Schema-
 * Stil). Bekommt bereits vollständig zusammengestellten Kontext (siehe
 * `buildLumiBrainContext`) -- berechnet selbst NICHTS neu (kein Readiness-,
 * Journey- oder Familienlogik-Duplikat), formuliert nur die Antwort.
 */
export async function generateLumiBrainAnswer(params: {
  intent: LumiBrainIntent
  context: Extract<LumiBrainContextResult, { ok: true }>
  questionText: string
}): Promise<LumiBrainAnswer | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[provider:config-missing]', { provider: 'openai', requestType: 'lumi_brain_answer' })
    return null
  }

  const prompt = buildPrompt(params.intent, params.context, params.questionText)

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'lumi_brain_answer', schema: LUMI_BRAIN_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text)
    return {
      title: parsed.title, body: parsed.body,
      recommendation: parsed.recommendation, missingInfo: parsed.missing_info,
      basisLabel: buildBasisLabel(params.intent, params.context),
      links: buildLinks(params.intent, params.context),
    }
  } catch (e) {
    console.error('[provider:request-failed]', { provider: 'openai', requestType: 'lumi_brain_answer', httpStatus: (e as { status?: number })?.status ?? 0 })
    return null
  }
}
