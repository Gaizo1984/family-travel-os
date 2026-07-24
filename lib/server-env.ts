import 'server-only'

/**
 * §Content Studio 3.0, Remotion Lambda (eu-central-1): "sämtliche
 * Environment-Variablen zentral typisieren und serverseitig validieren"
 * (Nutzervorgabe, wörtlich) -- einzige Stelle im Projekt, die diese vier
 * Variablen liest. Kein Aufrufer prüft `process.env` selbst (anders als das
 * bisherige, verstreute `if (!process.env.X) ...`-Muster an einzelnen
 * Call-Sites, z. B. `lib/photo-quality-analysis.ts`). Wirft bei
 * Aufruf eine klare Fehlermeldung mit dem betroffenen Variablennamen, statt
 * eines kryptischen Fehlers tief in der AWS-SDK-/Supabase-Aufrufkette.
 *
 * `import 'server-only'` lässt den Next.js-Build hart fehlschlagen, falls
 * dieses Modul (auch nur transitiv) je in ein Client-Bundle gerät --
 * zusätzliche Absicherung neben der ohnehin serverseitigen Nutzung.
 *
 * Bewusst nur Validierung, kein AWS-/Supabase-Client selbst -- der Client
 * für den Service-Role-Zugriff liegt separat in `lib/supabase/admin.ts`,
 * der Render-Trigger-Code (noch nicht gebaut, spätere Etappe) wird
 * `getRemotionLambdaEnv()` von dort aus konsumieren.
 */

export const ALLOWED_REMOTION_AWS_REGION = 'eu-central-1'

export type RemotionLambdaEnv = {
  awsAccessKeyId: string
  awsSecretAccessKey: string
  /** §"eu-central-1 verbindlich" (Nutzervorgabe): Vercel Sandbox wurde wegen ausschließlicher US-Verarbeitung für Produktivdaten verworfen -- ein versehentliches Abweichen von Frankfurt (z. B. durch die Remotion-Standardregion us-east-1) darf nicht durch bloßes Weglassen/Vertippen der Variable passieren. */
  awsRegion: typeof ALLOWED_REMOTION_AWS_REGION
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Fehlende Environment-Variable: ${name}`)
  }
  return value
}

let cachedRemotionLambdaEnv: RemotionLambdaEnv | null = null

/** Wirft, falls eine der drei AWS-Variablen fehlt ODER die Region von eu-central-1 abweicht. */
export function getRemotionLambdaEnv(): RemotionLambdaEnv {
  if (cachedRemotionLambdaEnv) return cachedRemotionLambdaEnv

  const awsAccessKeyId = requireEnv('REMOTION_AWS_ACCESS_KEY_ID')
  const awsSecretAccessKey = requireEnv('REMOTION_AWS_SECRET_ACCESS_KEY')
  const awsRegion = requireEnv('REMOTION_AWS_REGION')

  if (awsRegion !== ALLOWED_REMOTION_AWS_REGION) {
    throw new Error(
      `REMOTION_AWS_REGION ist auf "${awsRegion}" gesetzt -- erlaubt ist ausschließlich "${ALLOWED_REMOTION_AWS_REGION}" (Datenschutz-Entscheidung: Familienmedien dürfen ausschließlich in Frankfurt verarbeitet werden).`,
    )
  }

  cachedRemotionLambdaEnv = { awsAccessKeyId, awsSecretAccessKey, awsRegion: ALLOWED_REMOTION_AWS_REGION }
  return cachedRemotionLambdaEnv
}

/** Wirft, falls SUPABASE_SERVICE_ROLE_KEY fehlt. Der Wert selbst wird nie in eine Fehlermeldung/ein Log geschrieben. */
export function getSupabaseServiceRoleKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
}
