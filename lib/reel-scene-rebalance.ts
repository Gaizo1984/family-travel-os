import { MIN_SCENE_DURATION_SECONDS, MAX_SCENE_DURATION_SECONDS } from './reel-timeline-options'
import type { ReelTimelineScene } from './reel-storyboard-types'

/**
 * §"Gesamtdauer muss exakt 15, 30 oder 60 Sekunden bleiben" + "Funktion
 * 'Dauer automatisch ausgleichen'" (Nutzervorgabe, wörtlich): verteilt die
 * Differenz zwischen Ist- und Zielsumme proportional zur aktuellen Dauer auf
 * alle Szenen, geklemmt an MIN/MAX_SCENE_DURATION_SECONDS, mehrere Runden
 * falls einzelne Szenen dabei an eine Grenze stoßen. Der verbleibende
 * Rundungsrest geht komplett auf die erste Szene, damit die Summe TATSÄCHLICH
 * exakt dem Zielwert entspricht (nicht nur näherungsweise).
 *
 * §Aus lib/actions/reel-timeline.ts ausgelagert (Content Studio 3.0, manuelle
 * Video-Löschung): eine 'use server'-Datei darf nur async Functions
 * exportieren, aber lib/actions/content-reel-media.ts::deleteReelVideo
 * braucht dieselbe Rebalance-Logik, um eine gelöschte Video-Szene aus
 * bestehenden Storyboards zu entfernen -- keine zweite, abweichende Kopie.
 */
export function rebalanceScenes(scenes: ReelTimelineScene[], targetTotal: number): ReelTimelineScene[] {
  if (scenes.length === 0) return scenes
  const adjustable = scenes.map((s) => ({ ...s }))
  let remaining = targetTotal - adjustable.reduce((sum, s) => sum + s.duration_seconds, 0)

  for (let iter = 0; iter < 6 && Math.abs(remaining) > 0.01; iter++) {
    const room = adjustable.map((s) => (
      remaining > 0 ? MAX_SCENE_DURATION_SECONDS - s.duration_seconds : s.duration_seconds - MIN_SCENE_DURATION_SECONDS
    ))
    const totalRoom = room.reduce((sum, r) => sum + Math.max(0, r), 0)
    if (totalRoom <= 0.001) break

    let appliedThisRound = 0
    for (let i = 0; i < adjustable.length; i++) {
      if (room[i] <= 0) continue
      const rawShare = (room[i] / totalRoom) * remaining
      const clampedShare = remaining > 0 ? Math.min(rawShare, room[i]) : Math.max(rawShare, -room[i])
      adjustable[i].duration_seconds = Math.round((adjustable[i].duration_seconds + clampedShare) * 10) / 10
      appliedThisRound += clampedShare
    }
    remaining -= appliedThisRound
  }

  const finalTotal = adjustable.reduce((sum, s) => sum + s.duration_seconds, 0)
  const roundingRemainder = Math.round((targetTotal - finalTotal) * 10) / 10
  if (Math.abs(roundingRemainder) > 0.001) {
    const clamped = Math.max(MIN_SCENE_DURATION_SECONDS, Math.min(MAX_SCENE_DURATION_SECONDS, adjustable[0].duration_seconds + roundingRemainder))
    adjustable[0].duration_seconds = Math.round(clamped * 10) / 10
  }
  return adjustable
}
