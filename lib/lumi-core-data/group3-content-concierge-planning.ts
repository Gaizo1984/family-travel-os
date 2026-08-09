import { createCrud } from './_generic'

/**
 * Phase 3, Gruppe 3: Content Studio / Reels / Concierge / Planning / Rest.
 * Vorbereitet, NICHT aktiv -- siehe lib/lumi-core-data/README.md. Keine
 * Tabelle in dieser Gruppe hat einen zusammengesetzten Primärschlüssel.
 */

export const contentProjects = createCrud('travel_content_projects')
export const contentIdeas = createCrud('travel_content_ideas')
export const contentDrafts = createCrud('travel_content_drafts')
export const contentProjectPhotos = createCrud('travel_content_project_photos')
export const contentPhotoAnalyses = createCrud('travel_content_photo_analyses')
export const contentReelMediaItems = createCrud('travel_content_reel_media_items')
export const contentReelRenders = createCrud('travel_content_reel_renders')
export const contentStrategies = createCrud('travel_content_strategies')
export const tripIdeaSessions = createCrud('travel_trip_idea_sessions')
export const tripIdeas = createCrud('travel_trip_ideas')
export const savedFlightOptions = createCrud('travel_saved_flight_options')
export const savedHotelOptions = createCrud('travel_saved_hotel_options')
export const conciergeMessages = createCrud('travel_concierge_messages')

export async function listContentProjectsForTrip(tripId: string) {
  return contentProjects.listBy('trip_id', tripId)
}
export async function listContentIdeasForProject(projectId: string) {
  return contentIdeas.listBy('project_id', projectId)
}
export async function listContentDraftsForProject(projectId: string) {
  return contentDrafts.listBy('project_id', projectId)
}
export async function listContentProjectPhotos(projectId: string) {
  return contentProjectPhotos.listBy('project_id', projectId)
}
export async function listContentReelMediaItems(projectId: string) {
  return contentReelMediaItems.listBy('project_id', projectId, 'sort_order')
}
export async function listContentReelRendersForDraft(draftId: string) {
  return contentReelRenders.listBy('draft_id', draftId)
}
export async function listContentStrategiesForTrip(tripId: string) {
  return contentStrategies.listBy('trip_id', tripId)
}
export async function listTripIdeasForSession(sessionId: string) {
  return tripIdeas.listBy('session_id', sessionId)
}
export async function listConciergeMessagesForTrip(tripId: string) {
  return conciergeMessages.listBy('trip_id', tripId)
}
