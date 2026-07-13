'use server'

import { redirect } from 'next/navigation'
import { generateFiveRecommendations } from '@/lib/concierge-ai'
import { buildFamilyDnaSummary, formatFamilyDnaForPrompt, ageAtDate } from '@/lib/family-dna'
import { getFamily } from '@/lib/family'
import { getLastTestRun, recordTestRun } from '@/lib/dev-test-runs'
import type { PlacesTestResult, CompactPlace } from '@/lib/actions/dev-tests/places-test'
import type { WeatherTestResult } from '@/lib/actions/dev-tests/weather-test'
import { MAX_LEG_MINUTES } from '@/lib/dev-test-config'

export type OpenAiRecommendationItem = {
  name: string; category: string; why: string
  travelTimeMinutes: number | null; distanceKm: number | null
  rating: number | null; reviewCount: number | null; openNow: boolean | null
  kinderEignung: string; wetterEignung: string; tripLength: string; besondereHinweise: string
}

export type OpenAiRecommendationTestResult = {
  locationLabel: string
  recommendations: OpenAiRecommendationItem[]
}

/**
 * §"Faktenbasiert, keine Informationen erfinden": die KI liefert nur ihre
 * qualitative Auswahl/Einschätzung (siehe `generateFiveRecommendations`),
 * die tatsächlichen Fakten (Fahrzeit, Bewertung, Öffnungsstatus, ...) werden
 * HIER aus den bereits geladenen Places-Daten gemerged, nie aus der
 * KI-Antwort übernommen. Kandidaten außerhalb des Tagestrip-Radius
 * (`MAX_LEG_MINUTES`, dieselbe Konstante wie im Tagestrip-Testmodul) werden
 * der KI erst gar nicht zur Auswahl angeboten.
 */
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

  const allPlaces = Object.values(placesResult.categories).flat() as CompactPlace[]
  const candidates = allPlaces.filter((p) => p.durationMinutes === null || p.durationMinutes <= MAX_LEG_MINUTES)

  if (candidates.length === 0) {
    await recordTestRun('openai_recommendations', { success: false, errorMessage: 'Der letzte Places-Test enthält keine (ausreichend nahen) Treffer.' })
    redirect('/mehr/developer')
  }

  const family = await getFamily()
  const dna = await buildFamilyDnaSummary(family.id)
  const familyDnaText = formatFamilyDnaForPrompt(dna)
  const today = new Date().toISOString().slice(0, 10)
  const members = dna.persons.map((p) => ({ name: p.name, age: ageAtDate(p.birth_date, today), isMinor: p.is_minor }))

  const weatherRun = await getLastTestRun('weather')
  const weatherResult = weatherRun?.success ? (weatherRun.result as unknown as WeatherTestResult) : null
  const weatherSummary = weatherResult ? `${weatherResult.currentTemp}°C in ${weatherResult.resolvedLocationName}` : null

  const picks = await generateFiveRecommendations({
    locationLabel: placesResult.origin.formattedAddress,
    candidates: candidates.map((p) => ({
      name: p.name, category: p.category,
      rating: p.rating, userRatingCount: p.userRatingCount, openNow: p.openNow,
      durationMinutes: p.durationMinutes, distanceKm: p.distanceKm,
    })),
    familyDnaText, members, weatherSummary,
  })

  if (!picks) {
    await recordTestRun('openai_recommendations', { success: false, errorMessage: 'Die KI ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.' })
    redirect('/mehr/developer')
  }

  const byName = new Map(candidates.map((p) => [p.name, p]))
  const recommendations: OpenAiRecommendationItem[] = picks
    .filter((pick) => byName.has(pick.placeName))
    .map((pick) => {
      const p = byName.get(pick.placeName)!
      return {
        name: p.name, category: p.category, why: pick.why,
        travelTimeMinutes: p.durationMinutes, distanceKm: p.distanceKm,
        rating: p.rating, reviewCount: p.userRatingCount, openNow: p.openNow,
        kinderEignung: pick.kinderEignung, wetterEignung: pick.wetterEignung,
        tripLength: pick.tripLength, besondereHinweise: pick.besondereHinweise,
      }
    })

  if (recommendations.length === 0) {
    await recordTestRun('openai_recommendations', { success: false, errorMessage: 'Die KI hat keine gültigen Treffer aus der Kandidatenliste ausgewählt.' })
    redirect('/mehr/developer')
  }

  const result: OpenAiRecommendationTestResult = { locationLabel: placesResult.origin.formattedAddress, recommendations }
  await recordTestRun('openai_recommendations', {
    success: true,
    summary: `${recommendations.length} Empfehlungen für ${placesResult.origin.formattedAddress}`,
    result,
  })
  redirect('/mehr/developer')
}
