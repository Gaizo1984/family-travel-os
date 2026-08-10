/**
 * §"App-like Lumi Travel": muss exakt dem `basePath` in next.config.ts
 * entsprechen. Next.js hängt `basePath` automatisch an next/link, redirect()
 * und generierte Routen an -- diese eine Stelle ist nur für die wenigen
 * Fälle nötig, die NICHT automatisch umgeschrieben werden (Metadata-Route-
 * Inhalte wie manifest.ts, Service-Worker-Registrierungs-URL/-Scope).
 */
export const BASE_PATH = '/travel'
