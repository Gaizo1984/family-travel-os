'use server'

import { redirect } from 'next/navigation'
import { generateFiveRecommendations } from '@/lib/concierge-ai'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt } from '@/lib/family-dna'
import { getFamily } from '@/lib/family'
import { getLastTestRun, recordTestRun } from '@/lib/dev-test-runs'
import type { PlacesTestResult } from '@/lib/actions/dev-tests/places-test'

export type OpenAiRecommendationTestResult = {
  locationLabel: string
  recommendations: { title: string; reason: string }[]
}

export async function runOpenAiRecommendationTest() {
  const placesRun = await getLastTestRun('places')
  const placesResult = placesRun?.success ? (placesRun.result as unknown as PlacesTestResult) : null

  if (!placesResult) {
    await recordTestRun('openai_recommendations', {
      success: false,
      errorMessage: 'Bitte zuerst den Places-Test erfolgreich ausführen -- die Empfehlungen bauen auf dessen Ergebnissen auf.',
    })
    redirect('/mehr/developer')
  }

  const placeNames = Object.values(placesResult.categories).flat().map((p) => p.name)
  if (placeNames.length === 0) {
    await recordTestRun('openai_recommendations', { success: false, errorMessage: 'Der letzte Places-Test enthält keine Treffer.' })
    redirect('/mehr/developer')
  }

  const family = await getFamily()
  const dna = await buildFamilyDnaSummary(family.id)
  const familyDnaText = formatFamilyDnaForPrompt(dna)

  const recommendations = await generateFiveRecommendations({
    locationLabel: placesResult.formattedAddress,
    placeNames,
    familyDnaText,
  })

  if (!recommendations) {
    await recordTestRun('openai_recommendations', { success: false, errorMessage: 'Die KI ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.' })
    redirect('/mehr/developer')
  }

  const result: OpenAiRecommendationTestResult = { locationLabel: placesResult.formattedAddress, recommendations }
  await recordTestRun('openai_recommendations', {
    success: true,
    summary: `5 Empfehlungen für ${placesResult.formattedAddress}`,
    result,
  })
  redirect('/mehr/developer')
}
