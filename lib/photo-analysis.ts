/**
 * Gemeinsame Konstanten für das "Bilder analysieren"-Feature — ausgelagert
 * aus lib/actions/photo-analysis-generation.ts, da 'use server'-Dateien nur
 * async Funktionen exportieren dürfen (keine Konstanten/Werte).
 */
export const PHOTO_CATEGORIES = [
  'best_family_photo', 'most_emotional', 'landscape', 'drone', 'luxury', 'cover_image', 'story', 'reel', 'album',
] as const
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  best_family_photo: 'Bestes Familienfoto',
  most_emotional: 'Emotionalstes Bild',
  landscape: 'Landschaft',
  drone: 'Drohnenfoto',
  luxury: 'Luxuriösestes Bild',
  cover_image: 'Titelbild',
  story: 'Story-Bild',
  reel: 'Reel-Bild',
  album: 'Album-Bild',
}

export const RECOMMENDATIONS = ['post', 'story', 'reel', 'fotobuch', 'album'] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  post: 'Post', story: 'Story', reel: 'Reel', fotobuch: 'Fotobuch', album: 'Album',
}
