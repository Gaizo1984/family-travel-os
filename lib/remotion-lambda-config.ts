import { ALLOWED_REMOTION_AWS_REGION } from './server-env'

/**
 * §Content Studio 3.0, Remotion Lambda (eu-central-1) -- nicht-geheime
 * Konfigurationswerte, zentral an einer Stelle (analog zu
 * `lib/content-session-limits.ts` fürs bestehende Content Studio 2.0).
 * Enthält bewusst KEINE Zugangsdaten (siehe `lib/server-env.ts`).
 *
 * §Etappe 1 (Nutzervorgabe): reine Vorbereitung, noch keine AWS-Ressource
 * deployt. `siteName`/`functionNamePrefix` sind die Werte, die beim
 * tatsächlichen Deploy (`npx remotion lambda sites create`/`functions
 * deploy`, spätere Etappe) verwendet werden sollen -- hier schon
 * festgelegt, damit Deploy-Befehle und späterer Trigger-Code dieselben
 * Namen referenzieren, statt sie an zwei Stellen zu pflegen.
 */

export const REMOTION_LAMBDA_REGION = ALLOWED_REMOTION_AWS_REGION

/** Muss exakt zum `--site-name` beim Deploy passen (spätere Etappe). */
export const REMOTION_LAMBDA_SITE_NAME = 'family-travel-reel'

/** Wiederverwendet dieselbe minimale Testkomposition wie der Vercel-Sandbox-Spike -- siehe remotion/Root.tsx. */
export const REMOTION_LAMBDA_COMPOSITION_ID = 'ReelSpike'

/**
 * §"Lifecycle-Löschung nach spätestens 24 Stunden" (Nutzervorgabe): "1-day"
 * ist der kürzeste von Remotion Lambda unterstützte Wert
 * (Optionen: 1-day/3-days/7-days/30-days) -- reines Sicherheitsnetz, die
 * eigentliche Löschung passiert aktiv direkt nach der Übernahme nach
 * Supabase Storage (künftiger Render-Abschluss-Schritt).
 */
export const REMOTION_LAMBDA_DELETE_AFTER = '1-day' as const
