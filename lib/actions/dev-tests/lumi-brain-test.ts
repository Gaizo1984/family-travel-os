'use server'

import { redirect } from 'next/navigation'
import { getFamily } from '@/lib/family'
import { recordTestRun } from '@/lib/dev-test-runs'
import { detectLumiBrainIntent } from '@/lib/lumi-brain-intent'
import { buildLumiBrainContext } from '@/lib/lumi-brain-context'
import { generateLumiBrainAnswer } from '@/lib/lumi-brain-ai'

/**
 * §"Automatisierte Tests" für LUMI Brain v1 (Nutzervorgabe, Qualitätsabschluss):
 * reiner Struktur-/Regressionscheck, keine semantische Bewertung (die braucht
 * einen Menschen). Erst ein kostenloser, synchroner Check aller 5 Intent-
 * Keyword-Zuordnungen, danach EIN echter OpenAI-Aufruf (Allgemein-Scope,
 * "inspiration") als Rauchtest für den vollen Antwortpfad -- bewusst nur
 * einer, nicht fünf, um Kosten/Tokens nicht unnötig zu vervielfachen.
 */
const INTENT_SAMPLES: Array<{ question: string; expectedType: string }> = [
  { question: 'Was fehlt für die Reise noch?', expectedType: 'reise_check' },
  { question: 'Ist dieser Flug mit unseren Kindern sinnvoll?', expectedType: 'familienfit' },
  { question: 'Welches Hotel passt besser zu uns?', expectedType: 'vergleich' },
  { question: 'Wo gibt es noch freie Tage?', expectedType: 'journey_support' },
  { question: 'Welche Hotels ähneln unseren bisherigen?', expectedType: 'inspiration' },
]

export async function runLumiBrainTest() {
  const mismatches = INTENT_SAMPLES
    .map((s) => ({ ...s, actual: detectLumiBrainIntent(s.question)?.type ?? null }))
    .filter((s) => s.actual !== s.expectedType)

  if (mismatches.length > 0) {
    await recordTestRun('lumi_brain', {
      success: false,
      errorMessage: `Intent-Erkennung fehlgeschlagen bei: ${mismatches.map((m) => `"${m.question}" -> ${m.actual ?? 'kein Treffer'}`).join('; ')}`,
    })
    redirect('/mehr/developer')
  }

  const { id: familyId } = await getFamily()
  const context = await buildLumiBrainContext(familyId, { mode: 'general' }, { type: 'inspiration' })
  if (!context.ok) {
    await recordTestRun('lumi_brain', { success: false, errorMessage: `Kontextaufbau fehlgeschlagen: ${context.message}` })
    redirect('/mehr/developer')
  }

  const answer = await generateLumiBrainAnswer({
    intent: { type: 'inspiration' },
    context,
    questionText: 'Welche Reiseziele passen zu unseren bisherigen Reisen?',
  })

  if (!answer || !answer.title || !answer.body || !answer.basisLabel) {
    await recordTestRun('lumi_brain', { success: false, errorMessage: 'KI-Antwort fehlt oder ist unvollständig (Titel/Text/Basis-Label).' })
    redirect('/mehr/developer')
  }

  await recordTestRun('lumi_brain', {
    success: true,
    summary: `5 Intents korrekt erkannt, Beispielantwort erhalten ("${answer.title}").`,
    result: { title: answer.title, basisLabel: answer.basisLabel, missingInfo: answer.missingInfo },
  })
  redirect('/mehr/developer')
}
