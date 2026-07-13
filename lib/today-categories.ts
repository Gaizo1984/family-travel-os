import type { LucideIcon } from 'lucide-react'
import { Compass, UtensilsCrossed, Waves, Trees, Users } from 'lucide-react'
import type { PlacesCategory } from './providers/places-provider'

/**
 * §"Vollständig generisch, keine eigene Seite pro Kategorie": jede Kategorie
 * ist ausschließlich ein Eintrag in TODAY_CATEGORIES. Eine neue Kategorie
 * (Golf, Wellness, Tauchen, Rooftop Bars, ...) braucht später NUR einen
 * weiteren Eintrag hier — keine neue Route, keine neue Migration, keine
 * Änderung an app/(app)/today/category/[category]/page.tsx. `category` in
 * der concierge_category_suggestions-Tabelle ist deshalb bewusst TEXT statt
 * ENUM (siehe Migration 20260712000007). "Shopping" wurde entfernt (Bugfix-
 * Sprint), "Familie" bleibt als reine KI-Kategorie ohne Places-Anbindung
 * (es gibt keine passende Places-Kategorie für "familienfreundlich").
 */
export type TodayCategoryKey = 'activities' | 'restaurants' | 'beaches' | 'nature' | 'family'

export type TodayCategoryConfig = {
  key: TodayCategoryKey
  label: string
  Icon: LucideIcon
  /** Beschriftung des Buttons, der den einzigen, kostenpflichtigen Aufruf (Places/Routes/KI) auslöst -- nie automatisch. */
  aiButtonLabel: string
  aiQuestionTemplate: (locationLabel: string) => string
  /**
   * §"LUMI Intelligence v1": nur gesetzt für Kategorien mit echter
   * Places-Anbindung (Aktivitäten/Restaurants/Strände/Natur) --
   * `lib/actions/category-places.ts` nutzt dies für `searchPlaces` und die
   * Fahrzeit-Filterung. "Familie" bleibt ohne Places-Kategorie auf dem
   * bisherigen reinen KI-Textpfad (`generateCategorySuggestion`).
   */
  placesCategory?: PlacesCategory
  /** Bevorzugte Fahrzeit-Obergrenze (Minuten) -- Treffer darüber werden nachrangig gezeigt, nicht ausgeschlossen. */
  preferredMaxMinutes?: number
  /** Harte Fahrzeit-Obergrenze (Minuten) -- Treffer darüber werden gar nicht erst angezeigt. */
  hardMaxMinutes?: number
}

export const TODAY_CATEGORIES: TodayCategoryConfig[] = [
  {
    key: 'activities', label: 'Aktivitäten', Icon: Compass,
    aiButtonLabel: 'Vorschläge ermitteln',
    aiQuestionTemplate: (loc) => `Welche Ausflüge und Aktivitäten empfiehlst du uns rund um ${loc}?`,
    placesCategory: 'attraction', preferredMaxMinutes: 90, hardMaxMinutes: 150,
  },
  {
    key: 'restaurants', label: 'Restaurants', Icon: UtensilsCrossed,
    aiButtonLabel: 'Vorschläge ermitteln',
    aiQuestionTemplate: (loc) => `Welche Restaurants empfiehlst du uns für unseren Aufenthalt in ${loc}?`,
    placesCategory: 'restaurant', preferredMaxMinutes: 30, hardMaxMinutes: 60,
  },
  {
    key: 'beaches', label: 'Strände', Icon: Waves,
    aiButtonLabel: 'Vorschläge ermitteln',
    aiQuestionTemplate: (loc) => `Welche Strände empfiehlst du uns in der Nähe von ${loc}?`,
    placesCategory: 'beach', preferredMaxMinutes: 60, hardMaxMinutes: 90,
  },
  {
    key: 'nature', label: 'Natur', Icon: Trees,
    aiButtonLabel: 'Vorschläge ermitteln',
    aiQuestionTemplate: (loc) => `Welche Naturerlebnisse und Landschaften empfiehlst du uns rund um ${loc}?`,
    placesCategory: 'nature', preferredMaxMinutes: 90, hardMaxMinutes: 150,
  },
  {
    key: 'family', label: 'Familie & Kinder', Icon: Users,
    aiButtonLabel: 'Kinderaktivitäten suchen',
    aiQuestionTemplate: (loc) => `Welche familien- und kinderfreundlichen Aktivitäten empfiehlst du uns in ${loc}?`,
  },
]

export function getTodayCategoryConfig(key: string): TodayCategoryConfig | null {
  return TODAY_CATEGORIES.find((c) => c.key === key) ?? null
}
