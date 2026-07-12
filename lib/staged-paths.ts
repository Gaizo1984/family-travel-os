/** Parst das vom Client gesendete JSON-Array staged Speicherpfade (lib/actions/photo-staging.ts) — robust gegen leere/kaputte Eingaben. */
export function parseStagedPaths(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((p) => typeof p === 'string') ? parsed : []
  } catch {
    return []
  }
}
