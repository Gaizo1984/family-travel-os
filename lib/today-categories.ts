import type { LucideIcon } from 'lucide-react'
import { Compass, UtensilsCrossed, Waves, Trees, Users } from 'lucide-react'
import { searchExcursions } from './providers/excursion-provider'
import { searchRestaurants } from './providers/restaurant-provider'

/**
 * §"Vollständig generisch, keine eigene Seite pro Kategorie": jede Kategorie
 * ist ausschließlich ein Eintrag in TODAY_CATEGORIES. Eine neue Kategorie
 * (Golf, Wellness, Tauchen, Rooftop Bars, ...) braucht später NUR einen
 * weiteren Eintrag hier — keine neue Route, keine neue Migration, keine
 * Änderung an app/(app)/today/category/[category]/page.tsx. `category` in
 * der concierge_category_suggestions-Tabelle ist deshalb bewusst TEXT statt
 * ENUM (siehe Migration 20260712000007). "Shopping" wurde entfernt (Bugfix-
 * Sprint), "Familie" bleibt als reine KI-Kategorie ohne Sonderbehandlung.
 */
export type TodayCategoryKey = 'activities' | 'restaurants' | 'beaches' | 'nature' | 'family'

export type CuratedResult = { id: string; name: string; description: string; photo: string }

export type TodayCategoryConfig = {
  key: TodayCategoryKey
  label: string
  Icon: LucideIcon
  /** Beschriftung des Buttons, der den einzigen, kostenpflichtigen KI-Aufruf auslöst -- nie automatisch. */
  aiButtonLabel: string
  aiQuestionTemplate: (locationLabel: string) => string
  /** Nur gesetzt, wenn echtes kuratiertes Datenmaterial existiert (Aktivitäten/Restaurants) -- kostenlos, sofort sichtbar, kein Klick nötig. */
  curatedSearch?: (destinationName: string) => Promise<CuratedResult[] | null>
}

export const TODAY_CATEGORIES: TodayCategoryConfig[] = [
  {
    key: 'activities', label: 'Aktivitäten', Icon: Compass,
    aiButtonLabel: 'Ausflug planen',
    aiQuestionTemplate: (loc) => `Welche Ausflüge und Aktivitäten empfiehlst du uns rund um ${loc}?`,
    curatedSearch: async (destinationName) => {
      const results = await searchExcursions({ destinationName })
      return results ? results.map((r) => ({ id: r.id, name: r.title, description: r.description, photo: r.photo })) : null
    },
  },
  {
    key: 'restaurants', label: 'Restaurants', Icon: UtensilsCrossed,
    aiButtonLabel: 'Restaurant finden',
    aiQuestionTemplate: (loc) => `Welche Restaurants empfiehlst du uns für unseren Aufenthalt in ${loc}?`,
    curatedSearch: async (destinationName) => {
      const results = await searchRestaurants({ destinationName })
      return results ? results.map((r) => ({ id: r.id, name: r.name, description: r.cuisine, photo: r.photo })) : null
    },
  },
  {
    key: 'beaches', label: 'Strände', Icon: Waves,
    aiButtonLabel: 'Die schönsten Strände',
    aiQuestionTemplate: (loc) => `Welche Strände empfiehlst du uns in der Nähe von ${loc}?`,
  },
  {
    key: 'nature', label: 'Natur', Icon: Trees,
    aiButtonLabel: 'Naturerlebnisse finden',
    aiQuestionTemplate: (loc) => `Welche Naturerlebnisse und Landschaften empfiehlst du uns rund um ${loc}?`,
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
