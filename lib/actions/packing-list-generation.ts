'use server'

import OpenAI from 'openai'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'
import { listHouseholdMembers } from '@/lib/household-members'
import { listTripMembers } from '@/lib/lumi-core-data/trip-members'
import { ageAtDate } from '@/lib/family-dna'
import { todayIsoInFamilyTimezone } from '@/lib/time'
import { getWeatherForLocation, formatDailyWeatherSummary } from '@/lib/weather'
import { loadRelevantMemories } from '@/lib/family-memories'
import { loadPackingItems } from '@/lib/packing-list'
import { computeTripRequirements } from '@/lib/travel-requirements'
import { deriveTripDateRange, tripDurationDays } from '@/lib/trip-dates'
import { createJob, completeJob, failJob } from '@/lib/ai-generation-jobs'
import {
  buildPackingPrompt, parseGeneratedItems, computeRegenerationDiff, needsCheckFlagToPersisted,
  buildReadyPassportPersonKeys, initialStatusForItem, reasoningWithReadinessNotice,
  youngestParticipant, sanitizeDiaperPersonKey,
  PACKING_ITEM_SCHEMA, type PackingFollowUpAnswers, type PackStyle, type PackingGenerationContext,
} from '@/lib/packing-list-generation'

/** §"Serverseitig konfigurierbares Modell" (Nutzervorgabe, wörtlich) -- exaktes Muster wie lib/photo-quality-analysis.ts (bisher das einzige Vorbild im Repo für ein per Env-Var überschreibbares OpenAI-Modell). */
const OPENAI_MODEL_PACKING_LIST = process.env.OPENAI_MODEL_PACKING_LIST ?? 'gpt-5.6-terra'
const OPENAI_REASONING_PACKING_LIST = (process.env.OPENAI_REASONING_PACKING_LIST ?? 'medium') as 'low' | 'medium' | 'high'

function packingPath(slug: string): string {
  return `/trips/${slug}/packing`
}

function generatePath(slug: string): string {
  return `/trips/${slug}/packing/generate`
}

function isPackStyle(value: string): value is PackStyle {
  return value === 'leicht' || value === 'ausgewogen'
}

function readFollowUp(formData: FormData): PackingFollowUpAnswers {
  const packStyleRaw = String(formData.get('pack_style') ?? 'ausgewogen')
  return {
    packStyle: isPackStyle(packStyleRaw) ? packStyleRaw : 'ausgewogen',
    laundryAvailable: formData.get('laundry_available') === 'on',
    specialEvents: String(formData.get('special_events') ?? '').trim(),
    needsStroller: formData.get('needs_stroller') === 'on',
    needsCarSeat: formData.get('needs_car_seat') === 'on',
    needsCarrier: formData.get('needs_carrier') === 'on',
    needsDiapers: formData.get('needs_diapers') === 'on',
    hasDrone: formData.get('has_drone') === 'on',
  }
}

/**
 * §"Die KI darf nur durch einen ausdrücklichen Klick gestartet werden ...
 * kein OpenAI-Aufruf beim bloßen Öffnen der Seite" (Nutzervorgabe, wörtlich):
 * diese Funktion ist ausschließlich über einen Formular-Submit erreichbar
 * (app/(app)/trips/[id]/packing/generate/page.tsx), niemals aus einem
 * Server Component beim Rendern aufgerufen -- gleiches Strukturprinzip wie
 * jede andere KI-Aktion in diesem Repo (z. B. lib/actions/booking-extraction.ts).
 */
export async function generatePackingList(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const followUp = readFollowUp(formData)

  if (!process.env.OPENAI_API_KEY) {
    redirect(`${generatePath(slug)}?error=${encodeURIComponent('Die automatische Erstellung ist aktuell nicht konfiguriert.')}`)
  }

  const supabase = await createClient()
  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()

  const { data: trip } = await lumiCore
    .from('travel_trips')
    .select('id, slug, title, start_date, end_date')
    .eq('id', tripId)
    .maybeSingle()
  if (!trip) redirect(packingPath(slug))

  // §"KI-Aufrufe hintergrundfest machen" (Nutzervorgabe): Job sofort
  // anlegen und redirecten -- die eigentliche Arbeit (Kontext sammeln,
  // KI-Aufruf, Schreiben) läuft danach über after() weiter, exakt das
  // in lib/actions/memories.ts etablierte Prinzip, verallgemeinert auf
  // ai_generation_jobs.
  const jobId = await createJob(familyId, 'packing_list_generate', supabase)

  after(async () => {
    try {
      const [tripMembers, allHouseholdMembers, { data: stagesRaw }, { data: bookingsRaw }, confirmedMemories] = await Promise.all([
        listTripMembers(tripId),
        listHouseholdMembers(),
        lumiCore.from('travel_stages').select('title, location, start_date, end_date, nights, accommodation, is_transit').eq('trip_id', tripId).order('sort_order'),
        lumiCore.from('travel_bookings').select('type, title').eq('trip_id', tripId).in('type', ['activity', 'restaurant']).neq('status', 'cancelled'),
        loadRelevantMemories(familyId, ['packing']),
      ])

      const tripMemberIds = new Set(tripMembers.map((m) => m.householdMemberId))
      const participants = allHouseholdMembers
        .filter((m) => tripMemberIds.has(m.id))
        .map((p) => ({ id: p.id, name: p.name, ageAtTrip: trip.start_date ? ageAtDate(p.birthDate, trip.start_date) : ageAtDate(p.birthDate, todayIsoInFamilyTimezone()), isMinor: p.isMinor }))

      const stages = stagesRaw ?? []
      const nonTransitAccommodationStages = stages.filter((s) => !s.is_transit && s.accommodation)
      const stageSummaries = stages.map((s) => `- ${s.title}${s.location ? ` (${s.location})` : ''}${s.nights ? `, ${s.nights} Nächte` : ''}${s.accommodation ? `, Unterkunft: ${s.accommodation}` : ''}`)

      let weatherSummary: string | null = null
      const todayIso = todayIsoInFamilyTimezone()
      if (trip.start_date) {
        const daysUntilStart = Math.round((new Date(trip.start_date + 'T00:00:00Z').getTime() - new Date(todayIso + 'T00:00:00Z').getTime()) / 86400000)
        // §"Wetter-Vorhersagefenster passt nicht zur üblichen Packlisten-
        // Erstellungszeit" (Architekturplan-Risiko): nur bei einer echten
        // Vorhersage für die Reisetage source:'wetter' ansetzen -- sonst bleibt
        // weatherSummary null und der Prompt fällt auf eine klar gekennzeichnete
        // Schätzung zurück (siehe buildPackingPrompt).
        if (daysUntilStart >= 0 && daysUntilStart <= 4) {
          const candidates = [
            ...nonTransitAccommodationStages.map((s) => ({ query: s.accommodation as string })),
            ...stages.filter((s) => !s.is_transit).map((s) => ({ query: s.location ?? s.title })),
            { query: trip.title },
          ]
          try {
            const weather = await getWeatherForLocation(candidates)
            if (weather) weatherSummary = weather.daily.slice(0, Math.max(1, 5 - daysUntilStart)).map((d) => formatDailyWeatherSummary(d)).join(' ')
          } catch {
            // Wetter bleibt optionale Anreicherung, siehe lib/weather.ts -- kein Abbruch der Generierung.
          }
        }
      }

      const activityTitles = (bookingsRaw ?? []).map((b) => b.title).filter((t): t is string => Boolean(t))

      // §"Windelanzahl fehlt, bitte realistische Anzahl" (Nutzer-Feedback):
      // dieselbe zentrale Ableitungslogik wie überall sonst in der App
      // (lib/trip-dates.ts), nicht die rohe trips.end_date-Spalte -- siehe
      // Root-Cause-Fix in travel-requirements.ts für denselben Datenpunkt.
      const dateRange = deriveTripDateRange({ start_date: trip.start_date, end_date: trip.end_date }, [], stages)
      const tripNights = dateRange.isOpen ? null : tripDurationDays(dateRange)

      const context: PackingGenerationContext = {
        tripTitle: trip.title,
        participants,
        stageSummaries,
        hotelChangeCount: nonTransitAccommodationStages.length,
        weatherSummary,
        activityTitles,
        confirmedMemories: confirmedMemories.map((m) => m.summary),
        followUp,
        tripNights,
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const response = await openai.responses.create({
        model: OPENAI_MODEL_PACKING_LIST,
        reasoning: { effort: OPENAI_REASONING_PACKING_LIST },
        input: [{ role: 'user', content: [{ type: 'input_text', text: buildPackingPrompt(context) }] }],
        text: { format: { type: 'json_schema', name: 'packing_list', schema: PACKING_ITEM_SCHEMA, strict: true } },
      })
      // §"Windeln dürfen natürlich nur für [das jüngste Kind] übernommen
      // werden" (Nutzer-Feedback): strukturelle Absicherung nach dem Parsen,
      // verlässt sich nicht allein auf Prompt-Befolgung -- siehe
      // sanitizeDiaperPersonKey (lib/packing-list-generation.ts).
      const diaperChildName = followUp.needsDiapers ? youngestParticipant(participants)?.name ?? null : null
      const parsedItems = parseGeneratedItems(JSON.parse(response.output_text)).map((item) => ({
        ...item, personKey: sanitizeDiaperPersonKey(item.label, item.personKey, diaperChildName),
      }))

      if (parsedItems.length === 0) {
        await failJob(jobId, 'Es konnten keine Vorschläge erzeugt werden. Bitte erneut versuchen.', supabase)
        return
      }

      const existingItems = await loadPackingItems(lumiCore, tripId)
      const hasExistingGenerated = existingItems.some((i) => i.sourceKey !== null)

      if (!hasExistingGenerated) {
        // §"Erststart: reines Einfügen, noch kein Abgleich nötig" (Architekturplan) -- keine bestehenden KI-Zeilen, mit denen kollidiert werden könnte.
        const personIdByName = new Map(participants.map((p) => [p.name.toLowerCase(), p.id]))
        // §"Reisepässe können bereits abgehakt sein, wenn diese in der App
        // hinterlegt und aktuell sind" (Nutzer-Feedback): dieselbe Travel-
        // Requirements-Engine wie Ready to Travel, keine zweite Prüfung.
        const requirements = await computeTripRequirements(tripId)
        const readyPassportPersonKeys = buildReadyPassportPersonKeys(requirements, participants)
        const rows = parsedItems.map((item, index) => {
          const status = initialStatusForItem(item, readyPassportPersonKeys)
          return {
            trip_id: tripId,
            household_member_id: item.personKey.toLowerCase() === 'gemeinsam' ? null : (personIdByName.get(item.personKey.toLowerCase()) ?? null),
            label: item.label, category: item.category, quantity: item.quantity,
            priority: item.priority, is_last_minute: item.isLastMinute,
            // travel_packing_items.needs_check ist in Lumi Core ein reines boolean-Flag
            // (anders als Travels bisheriges Grund-Enum) -- die konkrete Prüf-Ursache
            // steckt weiterhin im reasoning-Text, siehe needsCheckFlagToPersisted.
            needs_check: needsCheckFlagToPersisted(item.needsCheckFlag) !== null,
            reasoning: reasoningWithReadinessNotice(item.reasoning, status === 'eingepackt'),
            source: item.source, source_key: item.sourceKey,
            status, luggage_assignment: 'unassigned', sort_order: index,
          }
        })
        const { error: insertError } = await lumiCore.from('travel_packing_items').insert(rows)
        if (insertError) {
          console.error('[packing-list-generation] Insert fehlgeschlagen:', insertError.message)
          await failJob(jobId, 'Die Packliste konnte nicht gespeichert werden. Bitte erneut versuchen.', supabase)
          return
        }
        await completeJob(jobId, packingPath(slug), supabase)
        return
      }

      // §Aktualisierung: Entwurf zwischenspeichern, Diff-Ansicht entscheidet über die Übernahme (siehe app/(app)/trips/[id]/packing/diff/page.tsx).
      const { error: draftError } = await lumiCore.from('travel_packing_list_drafts').upsert(
        { trip_id: tripId, household_id: familyId, items: parsedItems, created_at: new Date().toISOString() },
        { onConflict: 'trip_id' },
      )
      if (draftError) {
        console.error('[packing-list-generation] Entwurf-Upsert fehlgeschlagen:', draftError.message)
        await failJob(jobId, 'Die aktualisierte Packliste konnte nicht gespeichert werden. Bitte erneut versuchen.', supabase)
        return
      }
      await completeJob(jobId, `${packingPath(slug)}/diff`, supabase)
    } catch (e) {
      console.error('[packing-list-generation] KI-Aufruf fehlgeschlagen:', e instanceof Error ? e.message : e)
      await failJob(jobId, 'Die Packlisten-Erstellung ist gerade nicht verfügbar. Bitte später erneut versuchen.', supabase)
    }
  })

  redirect(`${packingPath(slug)}?job=${jobId}`)
}

/** §"Nichts wird geschrieben, bevor der zweite Klick erfolgt" (Architekturplan): wendet nur die vom Nutzer bestätigte Teilmenge des Diffs an. */
export async function applyPackingListDiff(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const approvedKeys = new Set(formData.getAll('approved_keys').map(String))

  const lumiCore = await createLumiCoreClient()
  const { data: draft } = await lumiCore.from('travel_packing_list_drafts').select('items').eq('trip_id', tripId).maybeSingle()
  if (!draft) redirect(packingPath(slug))

  const [tripMembers, allHouseholdMembers] = await Promise.all([listTripMembers(tripId), listHouseholdMembers()])
  const tripMemberIds = new Set(tripMembers.map((m) => m.householdMemberId))
  const participants = allHouseholdMembers
    .filter((m) => tripMemberIds.has(m.id))
    .map((p) => ({ id: p.id, name: p.name }))

  const existingItems = await loadPackingItems(lumiCore, tripId)
  const generated = draft.items as Awaited<ReturnType<typeof parseGeneratedItems>>
  const diff = computeRegenerationDiff(existingItems, generated, participants)

  const toInsert = diff.filter((d) => d.bucket === 'neu_vorgeschlagen' && approvedKeys.has(d.key))
  const toUpdate = diff.filter((d) => d.bucket === 'geaendert' && approvedKeys.has(d.key) && d.existingItemId)
  const toRemove = diff.filter((d) => d.bucket === 'nicht_mehr_erforderlich' && approvedKeys.has(d.key) && d.existingItemId)

  if (toInsert.length > 0) {
    const requirements = await computeTripRequirements(tripId)
    const readyPassportPersonKeys = buildReadyPassportPersonKeys(requirements, participants)
    await lumiCore.from('travel_packing_items').insert(toInsert.map((d) => {
      const status = initialStatusForItem({ category: d.category, label: d.label, personKey: d.personLabel }, readyPassportPersonKeys)
      return {
        trip_id: tripId, household_member_id: d.personId, label: d.label, category: d.category, quantity: d.quantity,
        // s. o.: travel_packing_items.needs_check ist in Lumi Core boolean, nicht das Grund-Enum.
        priority: d.priority, is_last_minute: d.isLastMinute, needs_check: d.needsCheck !== null,
        reasoning: reasoningWithReadinessNotice(d.reasoning, status === 'eingepackt'),
        source: d.source, source_key: d.sourceKey,
        status, luggage_assignment: 'unassigned',
      }
    }))
  }
  for (const d of toUpdate) {
    await lumiCore.from('travel_packing_items').update({
      label: d.label, category: d.category, quantity: d.quantity, reasoning: d.reasoning,
      priority: d.priority, is_last_minute: d.isLastMinute, needs_check: d.needsCheck !== null,
    }).eq('id', d.existingItemId as string)
  }
  if (toRemove.length > 0) {
    await lumiCore.from('travel_packing_items').update({ status: 'nicht_benoetigt' }).in('id', toRemove.map((d) => d.existingItemId as string))
  }

  await lumiCore.from('travel_packing_list_drafts').delete().eq('trip_id', tripId)
  redirect(packingPath(slug))
}

export async function discardPackingListDraft(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const slug = String(formData.get('slug') ?? '')

  const lumiCore = await createLumiCoreClient()
  await lumiCore.from('travel_packing_list_drafts').delete().eq('trip_id', tripId)

  redirect(packingPath(slug))
}
