/**
 * §"Reisebriefing, Zukunftssicherheit": bewusst generisch benannt (nicht
 * "trip-idea-..."), damit spätere Reiseanlage-/Buchungslogik dieselben
 * Enums/Labels ohne Umbau mitnutzen kann. Ein einziges gemeinsames
 * Vokabular -- verhindert eine zweite parallele Präferenzlogik.
 */

export type ClimatePreference = 'warm_beach' | 'mild' | 'cool' | 'no_preference'

export const CLIMATE_PREFERENCE_LABELS: Record<ClimatePreference, string> = {
  warm_beach: 'Warmes Meer / Strand',
  mild: 'Mild & angenehm',
  cool: 'Kühler / gemäßigt',
  no_preference: 'Keine Präferenz',
}

export const CLIMATE_PREFERENCE_ORDER: ClimatePreference[] = ['warm_beach', 'mild', 'cool', 'no_preference']

/** "erholung" bleibt der gespeicherte Wert (Datenmodell unverändert), Chip-Label lautet "Strand". */
export type TripTypePreference = 'natur' | 'stadt' | 'rundreise' | 'erholung' | 'mix'

export const TRIP_TYPE_PREFERENCE_LABELS: Record<TripTypePreference, string> = {
  erholung: 'Strand',
  natur: 'Natur',
  stadt: 'Stadt',
  rundreise: 'Rundreise',
  mix: 'Mischung',
}

export const TRIP_TYPE_PREFERENCE_ORDER: TripTypePreference[] = ['erholung', 'natur', 'stadt', 'rundreise', 'mix']

export type StopoverPreference = 'erwuenscht' | 'erlaubt' | 'ausgeschlossen'

export const STOPOVER_PREFERENCE_LABELS: Record<StopoverPreference, string> = {
  erwuenscht: 'Stopover erwünscht',
  erlaubt: 'Stopover erlaubt',
  ausgeschlossen: 'Kein Stopover',
}

export const STOPOVER_PREFERENCE_ORDER: StopoverPreference[] = ['erwuenscht', 'erlaubt', 'ausgeschlossen']

export type TravelDateMode = 'exact' | 'month' | 'school_holiday' | 'flexible' | 'open'

export const TRAVEL_DATE_MODE_LABELS: Record<TravelDateMode, string> = {
  exact: 'Konkretes Datum',
  month: 'Bestimmter Monat',
  school_holiday: 'Ferien',
  flexible: 'Flexibel',
  open: 'Zeitraum offen',
}

export const TRAVEL_DATE_MODE_ORDER: TravelDateMode[] = ['exact', 'month', 'school_holiday', 'flexible', 'open']
