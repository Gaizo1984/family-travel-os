import type { LucideIcon } from 'lucide-react'
import { UtensilsCrossed, Sparkles, Dumbbell, Baby, Compass, User, StickyNote } from 'lucide-react'

export type JourneyEventCategory =
  | 'restaurant' | 'spa' | 'golf_sport' | 'kids_club' | 'activity' | 'personal' | 'note'

// §"Geplant entfernt, Reserviert -> Gebucht, dauerhaft" (Nutzervorgabe,
// wörtlich): 'planned' entfernt (siehe Migration
// 20260801000001_normalize_booking_journey_status.sql, bestehende Zeilen
// wurden vorher auf 'reserved' migriert); 'reserved' heißt jetzt "Gebucht".
export type JourneyEventStatus = 'idea' | 'reserved'

export type JourneyEventCategoryConfig = {
  value: JourneyEventCategory
  label: string
  icon: LucideIcon
}

export const JOURNEY_EVENT_CATEGORY_ORDER: JourneyEventCategory[] = [
  'restaurant', 'spa', 'golf_sport', 'kids_club', 'activity', 'personal', 'note',
]

export const JOURNEY_EVENT_CATEGORIES: Record<JourneyEventCategory, JourneyEventCategoryConfig> = {
  restaurant:  { value: 'restaurant',  label: 'Restaurant',        icon: UtensilsCrossed },
  spa:         { value: 'spa',         label: 'Spa & Wellness',    icon: Sparkles },
  golf_sport:  { value: 'golf_sport',  label: 'Golf / Sport',      icon: Dumbbell },
  kids_club:   { value: 'kids_club',   label: 'Kids Club',         icon: Baby },
  activity:    { value: 'activity',    label: 'Aktivität',         icon: Compass },
  personal:    { value: 'personal',    label: 'Persönlicher Plan', icon: User },
  note:        { value: 'note',        label: 'Freie Notiz',       icon: StickyNote },
}

export const JOURNEY_EVENT_STATUS_ORDER: JourneyEventStatus[] = ['idea', 'reserved']

export const JOURNEY_EVENT_STATUS_LABELS: Record<JourneyEventStatus, string> = {
  idea: 'Idee',
  reserved: 'Gebucht',
}

export const JOURNEY_EVENT_STATUS_COLORS: Record<JourneyEventStatus, string> = {
  idea: 'var(--muted)',
  reserved: '#4C7A5D',
}

export function formatEventTime(time: string | null): string | null {
  if (!time) return null
  return time.slice(0, 5)
}
